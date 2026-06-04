"use server";

import { prisma } from "../../../src/lib/prisma";
import { redirect } from "next/navigation";

export async function createContact(formData: FormData) {
  const email = formData.get("email")?.toString().trim().toLowerCase() || "";
  const firstName = formData.get("firstName")?.toString().trim() || "";
  const lastName = formData.get("lastName")?.toString().trim() || "";
  const contactStatus = formData.get("contactStatus")?.toString() || "unknown";

  if (!email) {
    throw new Error("Email is required");
  }

  const existingContact = await prisma.contact.findUnique({
    where: {
      email,
    },
  });

  if (existingContact) {
    throw new Error("A contact with this email address already exists");
  }

  await prisma.contact.create({
    data: {
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      source: "manual",
      subscribedAt: contactStatus === "subscribed" ? new Date() : null,
      unsubscribedAt: null,
      archivedAt: null,
      bouncedAt: null,
      complainedAt: null,
    },
  });

  redirect("/contacts");
}
