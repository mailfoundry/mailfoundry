"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

type BreakdownItem = { ibsaProductId: string; name: string; units: number };

/**
 * Records cartons received for a single PO line and adjusts inStock proportionally.
 * Uses delta logic so re-confirming (including corrections downward) is safe.
 * Positive delta: stock increases, GIT decreases (goods arriving).
 * Negative delta: stock decreases, GIT increases (correcting an over-count).
 */
export async function bookInLine(formData: FormData) {
  const lineId = formData.get("lineId") as string;
  const cartonsReceived = parseInt(formData.get("cartonsReceived") as string, 10);

  const line = await prisma.ibsaPurchaseOrderLine.findUnique({
    where: { id: lineId },
    select: {
      id: true,
      purchaseOrderId: true,
      cartonsOrdered: true,
      cartonsReceived: true,
      cartonSize: true,
      productBreakdown: true,
    },
  });
  if (!line) throw new Error("Line not found");

  // ── Stock adjustment (delta — handles both increases and corrections) ──
  const deltaCartons = cartonsReceived - line.cartonsReceived;

  const stockUpdates: Array<{ id: string; delta: number }> = [];

  if (deltaCartons !== 0 && line.cartonSize) {
    const deltaUnits = deltaCartons * line.cartonSize; // negative when correcting down
    const absUnits   = Math.abs(deltaUnits);
    const sign       = deltaUnits > 0 ? 1 : -1;
    const breakdown: BreakdownItem[] = JSON.parse(line.productBreakdown as string);

    if (breakdown.length > 0) {
      const totalNeeded = breakdown.reduce((s, p) => s + p.units, 0);
      let remaining = absUnits;

      for (let i = 0; i < breakdown.length; i++) {
        const p = breakdown[i];
        const share =
          i === breakdown.length - 1
            ? remaining
            : Math.floor((p.units / totalNeeded) * absUnits);
        remaining -= share;
        if (share > 0) stockUpdates.push({ id: p.ibsaProductId, delta: sign * share });
      }
    }
  }

  // ── Persist: line + stock/GIT changes in one transaction ─────────────
  // Positive delta: inStock up, GIT down (goods arriving).
  // Negative delta: inStock down, GIT up (reversing an over-count).
  // GREATEST(0, ...) prevents either value going negative.
  await prisma.$transaction(async (tx) => {
    await tx.ibsaPurchaseOrderLine.update({
      where: { id: lineId },
      data: { cartonsReceived },
    });
    for (const u of stockUpdates) {
      await tx.$executeRaw`
        UPDATE "IbsaProduct"
        SET "inStock" = GREATEST(0, "inStock" + ${u.delta}),
            "git"     = GREATEST(0, "git"     - ${u.delta})
        WHERE "id" = ${u.id}
      `;
    }
  });

  // ── Recalculate PO status ───────────────────────────────────────────────
  const allLines = await prisma.ibsaPurchaseOrderLine.findMany({
    where: { purchaseOrderId: line.purchaseOrderId },
    select: { id: true, cartonsOrdered: true, cartonsReceived: true },
  });

  const linesWithUpdate = allLines.map((l) =>
    l.id === lineId ? { ...l, cartonsReceived } : l
  );

  const anyReceived  = linesWithUpdate.some((l) => l.cartonsReceived > 0);
  const allReceived  = linesWithUpdate.every((l) => l.cartonsReceived >= l.cartonsOrdered);
  const newStatus    = allReceived ? "received" : anyReceived ? "partial" : "ordered";

  await prisma.ibsaPurchaseOrder.update({
    where: { id: line.purchaseOrderId },
    data: {
      status: newStatus,
      receivedAt: allReceived ? new Date() : null,
    },
  });

  revalidatePath("/ibsa/orders");
  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
}

// ── Group order (congregation / circuit / regional) ───────────────────────

export async function updateGroupOrderStatus(formData: FormData) {
  const id     = (formData.get("id") as string).trim();
  const status = (formData.get("status") as string).trim();
  if (!id || !status) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).ibsaGroupOrder.update({ where: { id }, data: { status } });
  revalidatePath("/ibsa/orders");
}

export async function deleteGroupOrder(formData: FormData) {
  const id = (formData.get("id") as string).trim();
  if (!id) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).ibsaGroupOrder.delete({ where: { id } });
  revalidatePath("/ibsa/orders");
}
