import { NextResponse } from "next/server";
import { agentRoute } from "@/src/lib/agent-auth";
import { refreshBrandStatus } from "@/src/lib/brand-rules";
import { brandSummary, weekRange } from "@/src/lib/agent-views";

// Weekly planning summary per brand. ?week=2026-W43 (default: last full Mon–Sun week, UK). ?brand=scs|swf
export const GET = agentRoute("summary", async ({ req }) => {
  const q = new URL(req.url).searchParams;
  const range = weekRange(q.get("week"));
  const keys = q.get("brand") ? [q.get("brand")!] : ["scs", "swf"];
  const brands = [];
  for (const k of keys) {
    await refreshBrandStatus(k);
    const s = await brandSummary(k, range);
    if (s) brands.push(s);
  }
  return NextResponse.json({
    week: range.label,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    generatedAt: new Date().toISOString(),
    brands,
  });
});
