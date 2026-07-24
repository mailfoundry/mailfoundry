import { NextRequest, NextResponse } from "next/server";

const BOT_PATTERN =
  /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|semrushbot|ahrefsbot|ia_archiver|mj12bot|dotbot/i;

function fireTrack(request: NextRequest, hostname: string, pathname: string) {
  // Skip API routes and internal paths
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) return;
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_PATTERN.test(ua)) return;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const referer = request.headers.get("referer") ?? "";

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

const publicPaths = ["/", "/login", "/unsubscribe", "/favicon.ico", "/api/webhooks", "/api/track", "/api/auth", "/ibsa/login", "/convention", "/convention/check-email", "/convention/verify", "/order", "/xylo", "/account/login", "/account/verify"];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Track every real page visit (fire and forget)
  fireTrack(request, hostname, pathname);

  const isXylo = hostname === "www.xylouk.co.uk" || hostname === "xylouk.co.uk";

  if (isXylo) {
    const url = request.nextUrl.clone();
    const xyloPath = request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname;
    url.pathname = `/xylo${xyloPath}`;
    return NextResponse.rewrite(url);
  }

  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  const isMainLoggedIn = request.cookies.get(cookieName)?.value === "1";
  const isIbsaLoggedIn = request.cookies.get("ibsa_auth")?.value === "1";

  // Logged-in users hitting the homepage go straight to the dashboard
  if (pathname === "/" && isMainLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublicPath(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Group account portal: accessible with group_auth cookie only
  if (pathname.startsWith("/account")) {
    const isGroupLoggedIn = request.cookies.get("group_auth")?.value;
    if (isGroupLoggedIn) return NextResponse.next();
    return NextResponse.redirect(new URL("/account/login", request.url));
  }

  // Convention order form: protected by convention_auth cookie (contains the conventionId)
  if (pathname.startsWith("/convention/") && !pathname.startsWith("/convention/check-email") && !pathname.startsWith("/convention/verify")) {
    const conventionAuth = request.cookies.get("convention_auth")?.value;
    const conventionId = pathname.split("/")[2];
    if (!conventionAuth || conventionAuth !== conventionId) {
      return NextResponse.redirect(new URL("/convention?error=invalid-token", request.url));
    }
    return NextResponse.next();
  }

  // IBSA routes: accessible with either main auth or ibsa_auth cookie
  if (pathname.startsWith("/ibsa") || pathname.startsWith("/api/ibsa")) {
    if (isMainLoggedIn || isIbsaLoggedIn) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/ibsa/login", request.url));
  }

  // All other routes require main auth
  if (!isMainLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
