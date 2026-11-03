import { NextResponse } from "next/server";
import { syncCustomerPurchases } from "@/src/lib/customer-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Nightly (scripts/cron-worker.mjs): copy web-shop purchase history onto contacts for segments. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    const result = await syncCustomerPurchases();
    console.log("[customer-sync]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[customer-sync] failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
