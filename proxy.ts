import { NextRequest, NextResponse } from "next/server";
import { CONV_COOKIE, GROUP_COOKIE, IBSA_COOKIE, MAIN_COOKIE, verifySession } from "./src/lib/session";

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

const publicPaths = ["/ollie-maddy", "/", "/login", "/unsubscribe", "/favicon.ico", "/api/webhooks", "/api/track", "/api/agent", "/api/internal", "/api/cron", "/ibsa/login", "/convention", "/convention/check-email", "/convention/verify", "/order", "/xylo", "/account/login", "/account/verify"];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Track every real page visit (fire and forget)
  fireTrack(request, hostname, pathname);

  // Ollie & Maddy wedding countdown — ollieandmaddy.xylouk.co.uk serves /ollie-maddy (public, no login)
  if (hostname === "ollieandmaddy.xylouk.co.uk") {
    if (pathname.startsWith("/ollie-maddy") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = `/ollie-maddy${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  const isXylo = hostname === "www.xylouk.co.uk" || hostname === "xylouk.co.uk";

  if (isXylo) {
    const url = request.nextUrl.clone();
    const xyloPath = request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname;
    url.pathname = `/xylo${xyloPath}`;
    return NextResponse.rewrite(url);
  }

  // Signed session cookies — a forged or expired cookie verifies as null
  const [mainUser, ibsaUser] = await Promise.all([
    verifySession(request.cookies.get(MAIN_COOKIE)?.value, "main"),
    verifySession(request.cookies.get(IBSA_COOKIE)?.value, "ibsa"),
  ]);
  const isMainLoggedIn = !!mainUser;
  const isIbsaLoggedIn = !!ibsaUser;

  // Logged-in users hitting the homepage go straight to the dashboard
  if (pathname === "/" && isMainLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublicPath(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // ── API route auth — return 401 JSON, never a redirect ──────────────────
  if (
    pathname.startsWith("/api/campaigns/") ||
    pathname.startsWith("/api/contacts/") ||
    pathname.startsWith("/api/lists")
  ) {
    if (!isMainLoggedIn) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/ibsa/")) {
    if (!isMainLoggedIn && !isIbsaLoggedIn) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Group account portal: accessible with group_auth cookie only
  if (pathname.startsWith("/account")) {
    const isGroupLoggedIn = await verifySession(request.cookies.get(GROUP_COOKIE)?.value, "group");
    if (isGroupLoggedIn) return NextResponse.next();
    return NextResponse.redirect(new URL("/account/login", request.url));
  }

  // Convention order form: protected by a signed convention_auth cookie for this conventionId
  if (pathname.startsWith("/convention/") && !pathname.startsWith("/convention/check-email") && !pathname.startsWith("/convention/verify")) {
    const conventionAuth = await verifySession(request.cookies.get(CONV_COOKIE)?.value, "conv");
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
    // Redirect to main login so the admin lands on the right page.
    // IBSA-only users can still reach /ibsa/login directly (it's in publicPaths).
    return NextResponse.redirect(new URL("/login", request.url));
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
