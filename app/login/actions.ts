"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const password = String(formData.get("password") || "");
  const expectedPassword = process.env.APP_LOGIN_PASSWORD;

  if (!expectedPassword) {
    redirect("/login?error=missing-config");
  }

  if (password !== expectedPassword) {
    redirect("/login?error=invalid");
  }

  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  const cookieStore = await cookies();

  cookieStore.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/");
}

export async function logout() {
  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  const cookieStore = await cookies();

  cookieStore.delete(cookieName);

  redirect("/login");
}
