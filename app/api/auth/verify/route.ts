import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", request.url));
  }

  // Atomic update — prevents double-use if the link is clicked twice concurrently
  const now = new Date();
  const updated = await prisma.loginToken.updateMany({
    where: { token, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  if (updated.count === 0) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", request.url));
  }

  // Set the auth cookie directly on the redirect response
  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
