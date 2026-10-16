import { NextResponse } from "next/server";
import { syncScsOrders } from "@/src/lib/scs-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Every 15 min (scripts/cron-worker.mjs): pull paid SCS web orders into IBSA purchasing/stock. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    const result = await syncScsOrders();
    if (result.created || result.completed || result.cancelled || result.unmatched.length) {
      console.log("[scs-sync]", JSON.stringify(result));
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[scs-sync] failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
