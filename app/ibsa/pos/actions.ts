"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

type BreakdownItem = { ibsaProductId: string; name: string; units: number };

/**
 * Mark a purchase order as fully received.
 * - Sets PO status → "received", stamps receivedAt
 * - For each line: cartonsReceived = cartonsOrdered
 * - For each product in breakdown: inStock += units, git -= units (floored at 0)
 */
export async function markPoReceived(poId: string) {
  const po = await prisma.ibsaPurchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: true },
  });
  if (!po) throw new Error("PO not found");

  // Aggregate stock changes across all lines
  const stockDelta = new Map<string, number>(); // productId → units to add to inStock

  for (const line of po.lines) {
    const breakdown: BreakdownItem[] = JSON.parse(line.productBreakdown || "[]");
    const totalNeeded = breakdown.reduce((s, p) => s + p.units, 0);
    if (totalNeeded === 0 || breakdown.length === 0) continue;

    const unitsReceived =
      line.cartonSize != null
        ? line.cartonsOrdered * line.cartonSize
        : totalNeeded;

    let remaining = unitsReceived;
    for (let i = 0; i < breakdown.length; i++) {
      const p = breakdown[i];
      const share =
        i === breakdown.length - 1
          ? remaining
          : Math.floor((p.units / totalNeeded) * unitsReceived);
      remaining -= share;
      if (share > 0) {
        stockDelta.set(p.ibsaProductId, (stockDelta.get(p.ibsaProductId) ?? 0) + share);
      }
    }
  }

  await prisma.$transaction([
    // Update the PO itself
    prisma.ibsaPurchaseOrder.update({
      where: { id: poId },
      data: { status: "received", receivedAt: new Date() },
    }),
    // Mark all lines as fully received
    prisma.ibsaPurchaseOrderLine.updateMany({
      where: { purchaseOrderId: poId },
      data: { cartonsReceived: { set: 0 } }, // will overwrite per-line below
    }),
    // Adjust stock for each product
    ...Array.from(stockDelta.entries()).map(([productId, units]) =>
      prisma.ibsaProduct.update({
        where: { id: productId },
        data: {
          inStock: { increment: units },
          // Decrement GIT but never below 0
          git: { decrement: units },
        },
      })
    ),
  ]);

  // Clamp any git values that went negative (Prisma doesn't do MAX(0,x) in one step)
  const negatives = await prisma.ibsaProduct.findMany({
    where: {
      id: { in: Array.from(stockDelta.keys()) },
      git: { lt: 0 },
    },
    select: { id: true },
  });
  if (negatives.length > 0) {
    await prisma.$transaction(
      negatives.map((p) =>
        prisma.ibsaProduct.update({ where: { id: p.id }, data: { git: 0 } })
      )
    );
  }

  revalidatePath("/ibsa/pos");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/products");
}

/**
 * Cancel a purchase order.
 * - Sets status → "cancelled"
 * - Reverses any GIT increments that were applied when the PO was raised
 */
export async function cancelPo(poId: string) {
  const po = await prisma.ibsaPurchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: true },
  });
  if (!po) throw new Error("PO not found");

  const gitDelta = new Map<string, number>();

  for (const line of po.lines) {
    const breakdown: BreakdownItem[] = JSON.parse(line.productBreakdown || "[]");
    const totalNeeded = breakdown.reduce((s, p) => s + p.units, 0);
    if (totalNeeded === 0 || breakdown.length === 0) continue;

    const unitsOrdered =
      line.cartonSize != null
        ? line.cartonsOrdered * line.cartonSize
        : totalNeeded;

    let remaining = unitsOrdered;
    for (let i = 0; i < breakdown.length; i++) {
      const p = breakdown[i];
      const share =
        i === breakdown.length - 1
          ? remaining
          : Math.floor((p.units / totalNeeded) * unitsOrdered);
      remaining -= share;
      if (share > 0) {
        gitDelta.set(p.ibsaProductId, (gitDelta.get(p.ibsaProductId) ?? 0) + share);
      }
    }
  }

  await prisma.$transaction([
    prisma.ibsaPurchaseOrder.update({
      where: { id: poId },
      data: { status: "cancelled" },
    }),
    ...Array.from(gitDelta.entries()).map(([productId, units]) =>
      prisma.ibsaProduct.update({
        where: { id: productId },
        data: { git: { decrement: units } },
      })
    ),
  ]);

  // Clamp GIT at 0
  const negatives = await prisma.ibsaProduct.findMany({
    where: {
      id: { in: Array.from(gitDelta.keys()) },
      git: { lt: 0 },
    },
    select: { id: true },
  });
  if (negatives.length > 0) {
    await prisma.$transaction(
      negatives.map((p) =>
        prisma.ibsaProduct.update({ where: { id: p.id }, data: { git: 0 } })
      )
    );
  }

  revalidatePath("/ibsa/pos");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/products");
}
