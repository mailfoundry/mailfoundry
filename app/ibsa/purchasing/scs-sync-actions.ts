"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { syncScsOrders, type ScsSyncResult } from "../../../src/lib/scs-sync";

export async function syncScsNow(): Promise<{ ok: true; result: ScsSyncResult } | { ok: false; error: string }> {
  const jar = await cookies();
  const authed = jar.get(process.env.APP_AUTH_COOKIE ?? "mailfoundry_auth")?.value === "1" || !!jar.get("ibsa_auth")?.value;
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
