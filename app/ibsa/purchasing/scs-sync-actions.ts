"use server";

import { isMainOrIbsa } from "@/src/lib/auth";
import { revalidatePath } from "next/cache";
import { syncScsOrders, type ScsSyncResult } from "../../../src/lib/scs-sync";

export async function syncScsNow(): Promise<{ ok: true; result: ScsSyncResult } | { ok: false; error: string }> {
  const authed = await isMainOrIbsa();
  if (!authed) return { ok: false, error: "Not signed in" };
  try {
    // Manual sync looks back further than the 15-min cron, to catch anything missed
    const result = await syncScsOrders({ days: 90 });
    revalidatePath("/ibsa/purchasing");
    revalidatePath("/ibsa/orders");
    revalidatePath("/ibsa/products");
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}
