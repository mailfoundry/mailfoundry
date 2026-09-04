import { NextRequest, NextResponse } from "next/server";

const MAILFOUNDRY_COOKIE = process.env.APP_AUTH_COOKIE ?? "mailfoundry_auth";
const IBSA_COOKIE = "ibsa_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── MailFoundry API routes — require mailfoundry_auth ────────────────────
  if (
    pathname.startsWith("/api/campaigns/") ||
    pathname.startsWith("/api/contacts/") ||
    pathname.startsWith("/api/lists")
  ) {
    const auth = request.cookies.get(MAILFOUNDRY_COOKIE);
    if (!auth?.value) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── IBSA API routes — require ibsa_auth ──────────────────────────────────
  if (
    pathname.startsWith("/api/ibsa/")
  ) {
    const auth = request.cookies.get(IBSA_COOKIE);
    if (!auth?.value) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/campaigns/:path*",
    "/api/contacts/:path*",
    "/api/lists/:path*",
    "/api/ibsa/:path*",
  ],
};
