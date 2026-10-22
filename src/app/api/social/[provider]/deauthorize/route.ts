import type { NextRequest } from "next/server";
import { isSocialProvider } from "@/lib/social/meta";
import { db } from "@/lib/server/db";
import { clientAddress, rateLimit } from "@/lib/server/rate-limit";
import { handleDeauthorize, socialConfig } from "@/lib/server/social";

/*
 * POST /api/social/{facebook|instagram}/deauthorize — Meta's deauthorize
 * callback, called server-to-server when someone removes the app from their
 * Facebook or Instagram settings. The `signed_request` is verified with the
 * app secret before anything changes; a matching connection then has its
 * token erased and shows "access removed" in the dashboard.
 */

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest, { params }: RouteContext<"/api/social/[provider]/deauthorize">) {
  const { provider } = await params;
  if (!isSocialProvider(provider)) return json({ ok: false }, 404);
  if (!rateLimit(`social-deauthorize:${clientAddress(request.headers)}`, 30, 60_000)) return json({ ok: false }, 429);
  let signedRequest = "";
  try {
    const form = await request.formData();
    const value = form.get("signed_request");
    signedRequest = typeof value === "string" ? value : "";
  } catch {
    return json({ ok: false }, 400);
  }
  const ok = await handleDeauthorize(db, socialConfig(), provider, signedRequest);
  return ok ? json({ ok: true }) : json({ ok: false }, 400);
}
