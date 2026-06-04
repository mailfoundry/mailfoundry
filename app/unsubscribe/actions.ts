"use server";

import { prisma } from "@/src/lib/prisma";
import { redirect } from "next/navigation";

export async function unsubscribeContact(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/unsubscribe?error=missing-email");
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
