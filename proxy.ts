import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/login", "/unsubscribe", "/favicon.ico", "/api/webhooks", "/api/track", "/api/auth"];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  const isLoggedIn = request.cookies.get(cookieName)?.value === "1";

  // Logged-in users hitting the homepage go straight to the dashboard
  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublicPath(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
