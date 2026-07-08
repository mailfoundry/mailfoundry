import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/login", "/unsubscribe", "/favicon.ico", "/api/webhooks", "/api/track", "/api/auth", "/ibsa/login"];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // IBSA routes: accessible with either main auth or ibsa_auth cookie
  if (pathname.startsWith("/ibsa")) {
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
