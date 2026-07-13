"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

type BreakdownItem = { ibsaProductId: string; name: string; units: number };

/**
 * Records cartons received for a single PO line and increments inStock proportionally.
 * Only the DELTA (new - old cartonsReceived) triggers stock changes, so re-confirming is safe.
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

  // ── Stock increment (delta only) ────────────────────────────────────────
  const deltaCartons = cartonsReceived - line.cartonsReceived;

  const stockUpdates: Array<{ id: string; delta: number }> = [];

  if (deltaCartons > 0 && line.cartonSize) {
    const deltaUnits = deltaCartons * line.cartonSize;
    const breakdown: BreakdownItem[] = JSON.parse(line.productBreakdown as string);

    if (breakdown.length > 0) {
      const totalNeeded = breakdown.reduce((s, p) => s + p.units, 0);
      let remaining = deltaUnits;

      for (let i = 0; i < breakdown.length; i++) {
        const p = breakdown[i];
        const share =
          i === breakdown.length - 1
            ? remaining
            : Math.floor((p.units / totalNeeded) * deltaUnits);
        remaining -= share;
        if (share > 0) stockUpdates.push({ id: p.ibsaProductId, delta: share });
      }
    }
  }

  // ── Persist: line + stock changes in one transaction ──────────────────
  await prisma.$transaction([
    prisma.ibsaPurchaseOrderLine.update({
      where: { id: lineId },
      data: { cartonsReceived },
    }),
    ...stockUpdates.map((u) =>
      prisma.ibsaProduct.update({
        where: { id: u.id },
        data: { inStock: { increment: u.delta } },
      })
    ),
  ]);

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
