"use server";

import { prisma } from "../../../src/lib/prisma";
import { redirect } from "next/navigation";

export async function createCampaign(formData: FormData) {
  const name = formData.get("name")?.toString().trim() || "";
  const subject = formData.get("subject")?.toString().trim() || "";
  const body = formData.get("body")?.toString().trim() || "";
  const html = formData.get("html")?.toString().trim() || "";
  const listId = formData.get("listId")?.toString().trim() || "";

  if (!name || !subject || !body || !listId) {
    throw new Error(
      "Campaign name, subject, body and target list are required"
    );
  }

  const list = await prisma.list.findUnique({
    where: {
      id: listId,
    },
  });

  if (!list) {
    throw new Error("Selected list could not be found");
  }

  await prisma.campaign.create({
    data: {
      name,
      subject,
      body,
      html: html || null,
      listId,
      status: "draft",
    },
  });

  redirect("/campaigns");
}
