/**
 * Shared rules for saving a campaign (UI forms and the agent API).
 * On a branded list: the From address is forced to the brand's, the requested send time becomes
 * `plannedSendAt` (it only becomes `scheduledAt` after final approval), and any change to approved
 * content/audience/time revokes the final approval.
 */
import { prisma } from "./prisma";
import { audit, brandFrom, invalidateIfChanged } from "./brand-rules";

export type CampaignInput = {
  name: string;
  subject: string;
  preheader: string | null;
  fromEmail: string | null;
  body: string;
  html: string | null;
  listId: string;
  cohort: string | null;
  sendAt: Date | null | undefined; // requested send time; undefined = keep current (updates), null = clear
  conceptNotes?: string | null;
};

const MAX_HTML_BYTES = 90 * 1024;

export class CampaignInputError extends Error {
  name = "CampaignInputError";
}

export function parseCohort(raw: unknown): string | null {
  const v = String(raw ?? "").trim().toUpperCase();
  if (!v) return null;
  if (!["A", "B", "C"].includes(v)) throw new CampaignInputError("Group must be A, B, C or blank");
  return v;
}

async function resolve(input: CampaignInput, requireBrand?: string) {
  if (!input.name || !input.subject || !input.body || !input.listId) {
    throw new CampaignInputError("Campaign name, subject, plain-text body and target list are required");
  }
  const list = await prisma.list.findUnique({ where: { id: input.listId }, include: { brand: true } });
  if (!list) throw new CampaignInputError("Selected list could not be found");
  if (requireBrand && list.brandKey !== requireBrand) {
    throw new CampaignInputError(`List "${list.name}" is not a ${requireBrand.toUpperCase()} list`);
  }
  if (input.sendAt && Number.isNaN(input.sendAt.getTime())) throw new CampaignInputError("Invalid send time");
  const htmlBytes = Buffer.byteLength(input.html ?? "", "utf8");
  if (htmlBytes > MAX_HTML_BYTES) {
    throw new CampaignInputError(
      `HTML is ${Math.round(htmlBytes / 1024)} KB — keep it under ${MAX_HTML_BYTES / 1024} KB (Gmail clips emails over ~102 KB). Use hosted image URLs, not embedded images.`
    );
  }
  if (/src\s*=\s*["']?\s*data:/i.test(input.html ?? "")) {
    throw new CampaignInputError("Embedded (data:) images aren't allowed — use hosted image URLs, e.g. from the product pages on the website.");
  }
  return list;
}

export async function createCampaignRecord(input: CampaignInput, actor: string, opts: { requireBrand?: string } = {}) {
  const list = await resolve(input, opts.requireBrand);
  const brand = list.brand;

  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      subject: input.subject,
      preheader: input.preheader,
      body: input.body,
      html: input.html,
      listId: list.id,
      cohort: brand ? input.cohort : null,
      conceptNotes: input.conceptNotes ?? null,
      createdBy: actor,
      ...(brand
        ? { brandKey: brand.key, fromEmail: brandFrom(brand), plannedSendAt: input.sendAt ?? null, status: "draft", scheduledAt: null }
        : { fromEmail: input.fromEmail, status: input.sendAt ? "scheduled" : "draft", scheduledAt: input.sendAt ?? null }),
    },
  });
  await audit(actor, "campaign_created", { campaignId: campaign.id, brandKey: campaign.brandKey, detail: { name: campaign.name, listId: list.id } });
  return campaign;
}

export async function updateCampaignRecord(campaignId: string, input: CampaignInput, actor: string, opts: { requireBrand?: string } = {}) {
  const existing = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new CampaignInputError("Campaign could not be found");
  if (["sending", "sent", "cancelled"].includes(existing.status)) {
    throw new CampaignInputError(`A ${existing.status} campaign can't be edited`);
  }
  if (opts.requireBrand && existing.brandKey !== opts.requireBrand) {
    throw new CampaignInputError("This campaign belongs to a different brand");
  }
  const list = await resolve(input, opts.requireBrand);
  const brand = list.brand;

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name: input.name,
      subject: input.subject,
      preheader: input.preheader,
      body: input.body,
      html: input.html,
      listId: list.id,
      ...(input.conceptNotes !== undefined ? { conceptNotes: input.conceptNotes } : {}),
      ...(brand
        ? {
            brandKey: brand.key,
            cohort: input.cohort,
            fromEmail: brandFrom(brand),
            plannedSendAt: input.sendAt === undefined ? existing.plannedSendAt : input.sendAt,
            blockedReason: null,
            // Newly branded or previously blocked → back to draft; it needs final approval to be scheduled
            ...(existing.status === "blocked" || (!existing.brandKey && existing.status === "scheduled")
              ? { status: "draft", scheduledAt: null }
              : {}),
          }
        : {
            brandKey: null,
            cohort: null,
            fromEmail: input.fromEmail,
            scheduledAt: input.sendAt ?? existing.scheduledAt,
            status: input.sendAt ? "scheduled" : existing.status === "blocked" ? "draft" : existing.status,
          }),
    },
  });
  await audit(actor, "campaign_updated", { campaignId, brandKey: campaign.brandKey });
  if (brand) await invalidateIfChanged(campaignId, actor);
  return campaign;
}
