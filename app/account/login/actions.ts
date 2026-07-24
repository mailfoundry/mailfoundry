"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "../../../src/lib/prisma";
import { sendEmail } from "../../../src/lib/sendEmail";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";
const IBSA_NOTIFY_EMAIL = "ibsa@xylouk.co.uk";

export async function requestLoginLink(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";

  if (!email) redirect("/account/login?error=missing-email");

  const account = await prisma.groupAccount.findUnique({ where: { contactEmail: email } });

  // Always show the same success page regardless of whether the email exists
  // (prevents email enumeration)
  if (account) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.groupAccountToken.create({
      data: {
        token: rawToken,
        groupAccountId: account.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const loginUrl = `${BASE_URL}/account/verify?token=${rawToken}`;

    await sendEmail({
      to: email,
      subject: "Your Xylo account login link",
      text: `Hi ${account.contactName},\n\nClick the link below to access your Xylo account (${account.groupName}):\n\n${loginUrl}\n\nThis link expires in 7 days. If you didn't request this, you can ignore this email.\n\nIBSA · Xylo (UK) Ltd`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <div style="background:#0f172a;padding:32px;border-radius:12px;">
            <p style="color:#f97316;font-size:14px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>
            <h1 style="color:#fff;font-size:20px;margin:0 0 8px;">Your login link</h1>
            <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Hi ${account.contactName}, click below to access your account for <strong style="color:#f1f5f9;">${account.groupName}</strong>.</p>
            <a href="${loginUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:13px;font-weight:bold;padding:12px 24px;border-radius:8px;text-decoration:none;">Access your account →</a>
            <p style="color:#475569;font-size:11px;margin:16px 0 0;">Link valid for 7 days. If you didn't request this, ignore this email.</p>
          </div>
        </div>`,
    });
  }

  redirect("/account/login?sent=1");
}
