"use server";

import { prisma } from "../../../src/lib/prisma";
import { redirect } from "next/navigation";

export async function createCampaign(formData: FormData) {
  const name        = formData.get("name")?.toString().trim() || "";
  const subject     = formData.get("subject")?.toString().trim() || "";
  const fromEmail   = formData.get("fromEmail")?.toString().trim() || "";
  const body        = formData.get("body")?.toString().trim() || "";
  const html        = formData.get("html")?.toString().trim() || "";
  const listId      = formData.get("listId")?.toString().trim() || "";
  const scheduledAtRaw    = formData.get("scheduledAt")?.toString().trim() || "";
  const scheduledAtUtcRaw = formData.get("scheduledAtUtc")?.toString().trim() || "";

  if (!name || !subject || !body || !listId) {
    throw new Error("Campaign name, subject, body and target list are required");
  }

  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) throw new Error("Selected list could not be found");

  // scheduledAtUtc is populated by client JS as a proper ISO string (with timezone).
  // Fall back to scheduledAtRaw only if JS was disabled (treats it as UTC).
  const scheduledAtStr = scheduledAtUtcRaw || scheduledAtRaw;
  const scheduledAt = scheduledAtStr ? new Date(scheduledAtStr) : null;

  await prisma.campaign.create({
    data: {
      name,
      subject,
      fromEmail: fromEmail || null,
      body,
      html: html || null,
      listId,
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt,
    },
  });

  redirect("/campaigns");
}
