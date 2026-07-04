import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/login", "/unsubscribe", "/favicon.ico", "/api/webhooks", "/api/track"];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  const isLoggedIn = request.cookies.get(cookieName)?.value === "1";

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
