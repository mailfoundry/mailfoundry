import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentRoute } from "@/src/lib/agent-auth";
import { computeBrandHealth, describeDays, refreshBrandStatus } from "@/src/lib/brand-rules";

export const GET = agentRoute("brands", async () => {
  const brands = await prisma.brand.findMany({ orderBy: { key: "asc" }, include: { lists: { select: { id: true, name: true, isTest: true } } } });
  const out = [];
  for (const b of brands) {
    await refreshBrandStatus(b.key);
    const fresh = await prisma.brand.findUnique({ where: { key: b.key } });
    out.push({
      brand: b.key,
      name: b.name,
      from: `${b.fromName} <${b.fromEmail}>`,
      status: fresh?.status ?? b.status,
      statusReason: fresh?.statusReason ?? b.statusReason,
      maxEmailsPerContactPer7Days: b.weeklyCapPerContact,
      maxAudiencePerSend: b.maxAudiencePerSend,
      sendDays: describeDays(b.sendDays),
      sendWindowUk: `${b.sendWindowStart}–${b.sendWindowEnd}`,
      agentSchedulingEnabled: b.agentSchedulingEnabled,
      lists: b.lists,
      health: await computeBrandHealth(b.key),
    });
  }
  return NextResponse.json({ brands: out });
});
