import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BOT_PATTERN =
  /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|semrushbot|ahrefsbot|ia_archiver|mj12bot|dotbot/i;

export function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl;

  // Only track real page loads — skip static assets and API routes
  const isPage =
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api") &&
    !/\.(ico|png|svg|jpg|jpeg|gif|webp|css|js|mjs|woff2?|txt|xml|json|map)$/.test(
      pathname
    );

  const ua = request.headers.get("user-agent") ?? "";
  const isBot = BOT_PATTERN.test(ua);

  if (isPage && !isBot && ua) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const referer = request.headers.get("referer") ?? "";

    // Fire and forget — don't block the response
    fetch(new URL("/api/track", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pathname,
        hostname,
        ip,
        userAgent: ua,
        referer,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
