"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../src/lib/prisma";
import { scryptVerify } from "../../../src/lib/scrypt";

export async function ibsaLogin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/ibsa/login?error=missing");
  }

  const user = await prisma.ibsaUser.findUnique({ where: { email } });

  if (!user) {
    redirect("/ibsa/login?error=invalid");
  }

  const valid = await scryptVerify(password, user.hashedPassword);
  if (!valid) {
    redirect("/ibsa/login?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set("ibsa_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });

  redirect("/ibsa");
}

export async function ibsaLogout() {
  const cookieStore = await cookies();
  cookieStore.delete("ibsa_auth");
  redirect("/ibsa/login");
}
