import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/account/login?error=invalid-token", request.url));
  }

  const record = await prisma.groupAccountToken.findUnique({
    where: { token },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/account/login?error=invalid-token", request.url));
  }

  // Mark token as used
  await prisma.groupAccountToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

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
