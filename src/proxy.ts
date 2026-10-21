import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, localeCookie } from "@/i18n/config";

/**
 * Every public route lives under a locale prefix (/mn, /en). Unprefixed
 * requests are redirected to the visitor's last chosen language, falling back
 * to Mongolian — the product default — rather than Accept-Language.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1];

  if (hasLocale(firstSegment)) return;

  const remembered = request.cookies.get(localeCookie)?.value;
  const locale = hasLocale(remembered) ? remembered : defaultLocale;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, API routes and any file with an extension.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
