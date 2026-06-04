"use server";

import { prisma } from "../../../../src/lib/prisma";
import { redirect } from "next/navigation";

export async function updateCampaign(campaignId: string, formData: FormData) {
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

  const [campaign, list] = await Promise.all([
    prisma.campaign.findUnique({
      where: {
        id: campaignId,
      },
    }),
    prisma.list.findUnique({
      where: {
        id: listId,
      },
    }),
  ]);

  if (!campaign) {
    throw new Error("Campaign could not be found");
  }

  if (!list) {
    throw new Error("Selected list could not be found");
  }

  await prisma.campaign.update({
    where: {
      id: campaignId,
    },
    data: {
      name,
      subject,
      body,
      html: html || null,
      listId,
      status: "draft",
    },
  });

  redirect(`/campaigns/${campaignId}`);
}
