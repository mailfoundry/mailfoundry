"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../src/lib/prisma";
import { requireMain } from "../../../src/lib/auth";
import {
  activeApproval,
  audit,
  conceptFingerprint,
  finalFingerprint,
  preflight,
  refreshBrandStatus,
} from "../../../src/lib/brand-rules";

// Approvals can only be given here — behind Jason's signed MailFoundry login — never through the agent API.

function done(id: string, flash: string): never {
  revalidatePath(`/campaigns/${id}`);
  redirect(`/campaigns/${id}?flash=${encodeURIComponent(flash)}`);
}

async function load(id: string) {
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) throw new Error("Campaign not found");
  if (!c.brandKey) throw new Error("Approvals apply to SCS/SWF campaigns only");
  return c;
}

export async function approveConcept(id: string) {
  const user = await requireMain();
  const c = await load(id);
  if (["sending", "sent", "cancelled"].includes(c.status)) done(id, `Can't approve a ${c.status} campaign`);
  await prisma.campaignApproval.create({
    data: { campaignId: id, kind: "concept", fingerprint: conceptFingerprint(c), approvedBy: user, sendAt: c.plannedSendAt },
  });
  await audit(user, "concept_approved", { campaignId: id, brandKey: c.brandKey, detail: { subject: c.subject, plannedSendAt: c.plannedSendAt } });
  done(id, "Concept approved");
}

export async function approveFinal(id: string) {
  const user = await requireMain();
  const c = await load(id);
  if (["sending", "sent", "cancelled"].includes(c.status)) done(id, `Can't approve a ${c.status} campaign`);
  if (c.createdBy?.startsWith("agent:") && !(await activeApproval(id, "concept"))) {
    done(id, "Approve the concept first");
  }
  await refreshBrandStatus(c.brandKey!);
  const pf = await preflight(id, "approve");
  if (!pf.ok) done(id, `Not approved: ${pf.errors.join(" · ")}`);

  await prisma.campaignApproval.updateMany({
    where: { campaignId: id, kind: "final", revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: "superseded by a newer approval" },
  });
  await prisma.campaignApproval.create({
    data: {
      campaignId: id,
      kind: "final",
      fingerprint: finalFingerprint(c),
      audienceSize: pf.audienceSize,
      sendAt: c.plannedSendAt,
      approvedBy: user,
    },
  });
  await audit(user, "final_approved", {
    campaignId: id,
    brandKey: c.brandKey,
    detail: { audienceSize: pf.audienceSize, sendAt: c.plannedSendAt, subject: c.subject },
  });
  done(id, `Final approval recorded for ${pf.audienceSize} contacts`);
}

export async function revokeFinal(id: string) {
  const user = await requireMain();
  const c = await load(id);
  await prisma.campaignApproval.updateMany({
    where: { campaignId: id, kind: "final", revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: `revoked by ${user}` },
  });
  if (c.status === "scheduled") await prisma.campaign.update({ where: { id }, data: { status: "draft", scheduledAt: null } });
  await audit(user, "final_revoked", { campaignId: id, brandKey: c.brandKey });
  done(id, "Final approval revoked");
}

export async function scheduleApproved(id: string) {
  const user = await requireMain();
  const c = await load(id);
  if (!["draft", "blocked"].includes(c.status)) done(id, `Can't schedule a ${c.status} campaign`);
  await refreshBrandStatus(c.brandKey!);
  const pf = await preflight(id, "schedule");
  if (!pf.ok) done(id, `Not scheduled: ${pf.errors.join(" · ")}`);
  await prisma.campaign.update({ where: { id }, data: { status: "scheduled", scheduledAt: c.plannedSendAt, blockedReason: null } });
  await audit(user, "scheduled", { campaignId: id, brandKey: c.brandKey, detail: { scheduledAt: c.plannedSendAt, audienceSize: pf.audienceSize } });
  done(id, "Scheduled");
}

export async function unschedule(id: string) {
  const user = await requireMain();
  const c = await load(id);
  if (c.status !== "scheduled") done(id, "Not scheduled");
  await prisma.campaign.update({ where: { id }, data: { status: "draft", scheduledAt: null } });
  await audit(user, "unscheduled", { campaignId: id, brandKey: c.brandKey });
  done(id, "Unscheduled (approval kept)");
}

export async function cancelCampaign(id: string) {
  const user = await requireMain();
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) throw new Error("Campaign not found");
  if (["sending", "sent"].includes(c.status)) done(id, `Can't cancel a ${c.status} campaign`);
  await prisma.campaign.update({ where: { id }, data: { status: "cancelled", scheduledAt: null, cancelledAt: new Date() } });
  await audit(user, "cancelled", { campaignId: id, brandKey: c.brandKey });
  done(id, "Campaign cancelled");
}
