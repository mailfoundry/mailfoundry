"use server";

import { redirect } from "next/navigation";
import { requireMain } from "../../../../src/lib/auth";
import { parseCohort, updateCampaignRecord } from "../../../../src/lib/campaign-save";

export async function updateCampaign(campaignId: string, formData: FormData) {
  const user = await requireMain();
  const get = (k: string) => formData.get(k)?.toString().trim() || "";
  const sendAtStr = get("scheduledAtUtc") || get("scheduledAt");

  try {
  await updateCampaignRecord(
    campaignId,
    {
      name: get("name"),
      subject: get("subject"),
      preheader: get("preheader") || null,
      fromEmail: get("fromEmail") || null,
      body: get("body"),
      html: get("html") || null,
      listId: get("listId"),
      cohort: parseCohort(get("cohort")),
      sendAt: sendAtStr ? new Date(sendAtStr) : undefined,
    },
    user
  );
  } catch (err) {
    // Show the reason on the campaign page instead of crashing the editor
    if (err instanceof Error && err.name === "CampaignInputError") {
      redirect(`/campaigns/${campaignId}?flash=${encodeURIComponent(`Not saved: ${err.message}`)}`);
    }
    throw err;
  }

  redirect(`/campaigns/${campaignId}`);
}
