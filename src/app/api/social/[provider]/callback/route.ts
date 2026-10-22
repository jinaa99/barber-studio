import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, localeCookie, localizedPath } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { can } from "@/lib/admin/permissions";
import { cleanCode, isSocialProvider, parseOrigin } from "@/lib/social/meta";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { completeConnection, metaApi, socialConfig } from "@/lib/server/social";

/*
 * GET /api/social/{facebook|instagram}/callback — where Meta sends the browser
 * back after the authorization dialog. Requires the staff session that
 * started the flow (`social.manage`) and its single-use state; only then is
 * the code exchanged, server-side. The browser is always redirected on to the
 * settings page with a result code: the code and state never reach the page,
 * and no token is ever part of a response.
 */

function respond(request: NextRequest, path: string) {
  const origin = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? request.nextUrl.origin;
  const response = NextResponse.redirect(new URL(path, origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** The request must have arrived on the configured public origin: the one registered with Meta as the redirect URI. */
function onConfiguredHost(request: NextRequest): boolean {
  const origin = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host");
  return new URL(origin).host === host;
}

export async function GET(request: NextRequest, { params }: RouteContext<"/api/social/[provider]/callback">) {
  const { provider } = await params;
  const remembered = request.cookies.get(localeCookie)?.value;
  const fallbackLocale = hasLocale(remembered) ? remembered : defaultLocale;
  if (!isSocialProvider(provider)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const user = await getCurrentUser();
  if (!user) return respond(request, localizedPath(fallbackLocale, routes.adminLogin));
  const page = (locale: string, query: string) => respond(request, `${localizedPath(hasLocale(locale) ? locale : fallbackLocale, routes.adminSocial)}?${query}`);
  if (!can(user, "social.manage")) return page(fallbackLocale, "");
  if (!rateLimit(`social-callback:${user.id}`, 20, 10 * 60_000)) return page(fallbackLocale, "result=rate_limited");
  if (!onConfiguredHost(request)) return page(fallbackLocale, "result=invalid_state");

  const query = request.nextUrl.searchParams;
  const config = socialConfig();
  const outcome = await completeConnection(db, metaApi(config), config, {
    provider,
    userId: user.id,
    state: query.get("state"),
    code: query.get("code") ? cleanCode(query.get("code")!) : null,
    error: query.get("error"),
  });
  const locale = outcome.locale ?? fallbackLocale;
  if (outcome.result === "choose" && outcome.pendingId) return page(locale, `choose=${encodeURIComponent(outcome.pendingId)}`);
  return page(locale, `result=${outcome.result}&provider=${provider}`);
}
