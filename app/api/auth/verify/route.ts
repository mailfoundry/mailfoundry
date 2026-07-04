import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", request.url));
  }

  const loginToken = await prisma.loginToken.findUnique({ where: { token } });

  // Invalid, already used, or expired
  if (!loginToken || loginToken.usedAt || loginToken.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", request.url));
  }

  // Mark token as used
  await prisma.loginToken.update({
    where: { id: loginToken.id },
    data: { usedAt: new Date() },
  });

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
