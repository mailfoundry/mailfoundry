import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/account/login?error=invalid-token", request.url));
  }

  // Atomic update — prevents double-use if the link is clicked twice concurrently
  const now = new Date();
  const updated = await prisma.groupAccountToken.updateMany({
    where: { token, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  if (updated.count === 0) {
    return NextResponse.redirect(new URL("/account/login?error=invalid-token", request.url));
  }

  // Fetch the record to get the groupAccountId (safe — we just won the atomic race above)
  const record = await prisma.groupAccountToken.findUnique({ where: { token } });
  if (!record) {
    return NextResponse.redirect(new URL("/account/login?error=invalid-token", request.url));
  }

  // Set session cookie and redirect to portal
  const response = NextResponse.redirect(new URL("/account", request.url));
  response.cookies.set("group_auth", record.groupAccountId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
