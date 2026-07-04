"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { sendEmail } from "@/src/lib/sendEmail";

export async function login(formData: FormData) {
  const password = String(formData.get("password") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const expectedPassword = process.env.APP_LOGIN_PASSWORD;

  if (!expectedPassword) {
    redirect("/login?error=missing-config");
  }

  if (!email) {
    redirect("/login?error=missing-email");
  }

  if (password !== expectedPassword) {
    redirect("/login?error=invalid");
  }

  // Create a single-use verification token (expires in 15 minutes)
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.loginToken.create({
    data: { token, email, expiresAt },
  });

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  // Link goes to a confirmation PAGE — not a GET API route.
  // This prevents email scanners from consuming the token before the user clicks.
  const verifyUrl = `${appBaseUrl}/login/verify?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Your MailFoundry sign-in link",
    text: `Click the link below to sign in to MailFoundry. This link expires in 15 minutes.\n\n${verifyUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0f172a; padding: 32px; border-radius: 12px;">
          <p style="color: #f97316; font-size: 20px; font-weight: bold; margin: 0 0 8px;">MailFoundry</p>
          <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px;">Sign in to your account</h1>
          <p style="color: #94a3b8; margin: 0 0 24px;">
            Click the button below to sign in. This link expires in 15 minutes and can only be used once.
          </p>
          <a href="${verifyUrl}"
             style="display: inline-block; background: #f97316; color: #ffffff; text-decoration: none;
                    padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px;">
            Sign in to MailFoundry
          </a>
          <p style="color: #475569; font-size: 12px; margin: 24px 0 0;">
            If you didn't request this email you can safely ignore it.
          </p>
        </div>
      </div>
    `,
  });

  redirect(`/login/check-email?email=${encodeURIComponent(email)}`);
}

// Called when the user clicks "Sign in to MailFoundry" on the verify page.
// Using a Server Action guarantees cookies().set() works correctly.
export async function confirmVerify(formData: FormData) {
  const token = String(formData.get("token") || "");

  if (!token) {
    redirect("/login?error=invalid-token");
  }

  const loginToken = await prisma.loginToken.findUnique({ where: { token } });

  if (!loginToken || loginToken.usedAt || loginToken.expiresAt < new Date()) {
    redirect("/login?error=invalid-token");
  }

  // Mark as used
  await prisma.loginToken.update({
    where: { id: loginToken.id },
    data: { usedAt: new Date() },
  });

  // Set auth cookie — this works correctly inside a Server Action
  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  const cookieStore = await cookies();
  cookieStore.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/dashboard");
}

export async function logout() {
  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
  redirect("/login");
}
