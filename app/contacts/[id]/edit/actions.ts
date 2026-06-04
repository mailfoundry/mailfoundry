"use server";

import { prisma } from "@/src/lib/prisma";
import { redirect } from "next/navigation";

export async function updateContact(contactId: string, formData: FormData) {
  const firstName = formData.get("firstName")?.toString().trim() || "";
  const lastName = formData.get("lastName")?.toString().trim() || "";
  const source = formData.get("source")?.toString().trim() || "";
  const contactStatus = formData.get("contactStatus")?.toString() || "unknown";

  let subscribedAt: Date | null = null;
  let unsubscribedAt: Date | null = null;
  let archivedAt: Date | null = null;
  let bouncedAt: Date | null = null;
  let complainedAt: Date | null = null;

  if (contactStatus === "subscribed") {
    subscribedAt = new Date();
  }

  if (contactStatus === "unsubscribed") {
    unsubscribedAt = new Date();
  }

  if (contactStatus === "archived") {
    archivedAt = new Date();
  }

  if (contactStatus === "bounced") {
    bouncedAt = new Date();
  }

  if (contactStatus === "complained") {
    complainedAt = new Date();
  }

  await prisma.contact.update({
    where: {
      id: contactId,
    },
    data: {
      firstName: firstName || null,
      lastName: lastName || null,
      source: source || null,
      subscribedAt,
      unsubscribedAt,
      archivedAt,
      bouncedAt,
      complainedAt,
    },
  });

  redirect(`/contacts/${contactId}`);
}
