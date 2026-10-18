"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../src/lib/prisma";
import { scryptVerify } from "../../../src/lib/scrypt";
import { verifyTotp } from "../../../src/lib/totp";
import { endSession, startSession } from "../../../src/lib/auth";
import { signSession, verifySession } from "../../../src/lib/session";

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
    await startSession("ibsa", user.id);
    redirect("/ibsa");
  }

  // Set pending cookie and move to TOTP step
  const jar = await cookies();
  // Signed + 5-minute expiry, bound to this user (a forged "1" no longer skips the password step)
  jar.set(TOTP_PENDING_COOKIE, await signSession("ibsa", `pending:${user.id}`, 5 * 60), {
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
  const pending = await verifySession(jar.get(TOTP_PENDING_COOKIE)?.value, "ibsa");
  if (!pending || !pending.startsWith("pending:")) redirect("/ibsa/login");
  const userId = pending.slice("pending:".length);

  if (!code || !verifyTotp(totpSecret, code)) {
    redirect("/ibsa/login?step=totp&error=code");
  }

  jar.delete(TOTP_PENDING_COOKIE);
  await startSession("ibsa", userId);
  redirect("/ibsa");
}

export async function ibsaLogout() {
  await endSession("ibsa");
  redirect("/ibsa/login");
}
