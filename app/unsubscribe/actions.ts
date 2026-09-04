"use server";

import { createHmac } from "crypto";
import { prisma } from "@/src/lib/prisma";
import { redirect } from "next/navigation";

function verifySignature(email: string, sig: string): boolean {
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET ?? "change-me-in-production";
  const expected = createHmac("sha256", secret).update(email).digest("hex");
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

export async function unsubscribeContact(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const sig = String(formData.get("sig") || "").trim();

  if (!email) {
    redirect("/unsubscribe?error=missing-email");
  }

  if (!sig || !verifySignature(email, sig)) {
    redirect("/unsubscribe?error=invalid-link");
  }

  const contact = await prisma.contact.findUnique({
    where: {
      email,
    },
  });

  if (!contact) {
    redirect(`/unsubscribe?email=${encodeURIComponent(email)}&error=not-found`);
  }

  await prisma.contact.update({
    where: {
      email,
    },
    data: {
      unsubscribedAt: new Date(),
    },
  });

  redirect(`/unsubscribe?email=${encodeURIComponent(email)}&success=1`);
}
