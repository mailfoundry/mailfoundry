import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentRoute, apiError, readJson } from "@/src/lib/agent-auth";
import { parseUkDateTime } from "@/src/lib/brand-rules";
import { createCampaignRecord, parseCohort } from "@/src/lib/campaign-save";
import { campaignView, loadCampaign } from "@/src/lib/agent-views";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const GET = agentRoute("campaigns.list", async ({ req }) => {
  const q = new URL(req.url).searchParams;
  const brand = q.get("brand");
  const status = q.get("status");
  const limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 50));
  const rows = await prisma.campaign.findMany({
    where: { brandKey: brand ? brand : { not: null }, ...(status ? { status } : {}) },
    include: { list: true, brand: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ campaigns: await Promise.all(rows.map((c) => campaignView(c))) });
});

// Create a DRAFT. Never schedules or sends.
export const POST = agentRoute("campaigns.create", async ({ req, agent }) => {
  const b = await readJson(req);
  const brand = str(b.brand).toLowerCase();
  if (!["scs", "swf"].includes(brand)) return apiError("invalid_input", "brand must be \"scs\" or \"swf\"", 422);
  const plannedSendAt = b.plannedSendAt ? parseUkDateTime(b.plannedSendAt) : null;
  if (b.plannedSendAt && !plannedSendAt) return apiError("invalid_input", "plannedSendAt must be e.g. 2026-10-27T10:00 (UK time)", 422);

  const created = await createCampaignRecord(
    {
      name: str(b.name),
      subject: str(b.subject),
      preheader: str(b.previewText) || null,
      fromEmail: null, // forced to the brand's sender
      body: str(b.text),
      html: str(b.html) || null,
      listId: str(b.listId),
      cohort: parseCohort(b.group),
      sendAt: plannedSendAt,
      conceptNotes: str(b.conceptNotes) || null,
    },
    agent.actor,
    { requireBrand: brand }
  );
  const c = await loadCampaign(created.id);
  return NextResponse.json({ campaign: await campaignView(c!, { full: true }) }, { status: 201 });
});
