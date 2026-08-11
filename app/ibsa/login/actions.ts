"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../src/lib/prisma";
import { scryptVerify } from "../../../src/lib/scrypt";
import { verifyTotp } from "../../../src/lib/totp";

const TOTP_PENDING_COOKIE = "_ibsa_2fa_pending";

export async function ibsaLogin(formData: FormData) {
  const email    = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) redirect("/ibsa/login?error=missing");

  const user = await prisma.ibsaUser.findUnique({ where: { email } });
  if (!user) redirect("/ibsa/login?error=invalid");

  const valid = await scryptVerify(password, user.hashedPassword);
  if (!valid) redirect("/ibsa/login?error=invalid");

  const totpSecret = process.env.IBSA_TOTP_SECRET;

  // No TOTP secret configured → skip 2FA and log straight in
  if (!totpSecret) {
    const jar = await cookies();
    jar.set("ibsa_auth", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure:   process.env.NODE_ENV === "production",
      path:     "/",
      maxAge:   60 * 60 * 12,
    });
    redirect("/ibsa");
  }

  // Set pending cookie and move to TOTP step
  const jar = await cookies();
  jar.set(TOTP_PENDING_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   5 * 60,
  });
  redirect("/ibsa/login?step=totp");
}

export async function ibsaVerifyTotp(formData: FormData) {
  const code       = String(formData.get("code") || "").trim();
  const totpSecret = process.env.IBSA_TOTP_SECRET ?? "";

  const jar     = await cookies();
  const pending = jar.get(TOTP_PENDING_COOKIE)?.value;
  if (!pending) redirect("/ibsa/login");

  if (!code || !verifyTotp(totpSecret, code)) {
    redirect("/ibsa/login?step=totp&error=code");
  }

  jar.delete(TOTP_PENDING_COOKIE);
  jar.set("ibsa_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   60 * 60 * 12,
  });
  redirect("/ibsa");
}

export async function ibsaLogout() {
  const cookieStore = await cookies();
  cookieStore.delete("ibsa_auth");
  redirect("/ibsa/login");
}
