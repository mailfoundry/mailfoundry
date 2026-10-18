import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentRoute } from "@/src/lib/agent-auth";
import { campaignAudience, cohortOf } from "@/src/lib/brand-rules";

// Only brand-assigned lists are visible to the agent.
export const GET = agentRoute("lists", async ({ req }) => {
  const brand = new URL(req.url).searchParams.get("brand");
  const lists = await prisma.list.findMany({
    where: { brandKey: brand ? brand : { not: null } },
    orderBy: { name: "asc" },
  });
  const out = [];
  for (const l of lists) {
    const audience = await campaignAudience({ listId: l.id, cohort: null });
    const groups = { A: 0, B: 0, C: 0 };
    for (const a of audience) groups[cohortOf(a.id)]++;
    out.push({ id: l.id, name: l.name, brand: l.brandKey, testList: l.isTest, eligible: audience.length, groups });
  }
  return NextResponse.json({ lists: out });
});
