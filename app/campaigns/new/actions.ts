"use server";

import { redirect } from "next/navigation";
import { requireMain } from "../../../src/lib/auth";
import { createCampaignRecord, parseCohort } from "../../../src/lib/campaign-save";

export async function createCampaign(formData: FormData) {
  const user = await requireMain();
  const get = (k: string) => formData.get(k)?.toString().trim() || "";
  // scheduledAtUtc is populated by client JS as an ISO string; fall back to the raw value if JS was disabled.
  const sendAtStr = get("scheduledAtUtc") || get("scheduledAt");

  const campaign = await createCampaignRecord(
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

  redirect(campaign.brandKey ? `/campaigns/${campaign.id}` : "/campaigns");
}
