"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

type BreakdownItem = { ibsaProductId: string; name: string; units: number };

/** Distribute `totalUnits` across breakdown products proportionally, no rounding loss */
function applyBreakdown(
  breakdown: BreakdownItem[],
  totalUnits: number,
  delta: Map<string, number>,
  sign: 1 | -1,
) {
  if (breakdown.length === 0 || totalUnits === 0) return;
  const totalNeeded = breakdown.reduce((s, p) => s + p.units, 0);
  if (totalNeeded === 0) return;
  let remaining = totalUnits;
  for (let i = 0; i < breakdown.length; i++) {
    const p = breakdown[i];
    const share =
      i === breakdown.length - 1
        ? remaining
        : Math.floor((p.units / totalNeeded) * totalUnits);
    remaining -= share;
    if (share > 0) delta.set(p.ibsaProductId, (delta.get(p.ibsaProductId) ?? 0) + sign * share);
  }
}

async function clampGitAtZero(productIds: string[]) {
  if (productIds.length === 0) return;
  const neg = await prisma.ibsaProduct.findMany({
    where: { id: { in: productIds }, git: { lt: 0 } },
    select: { id: true },
  });
  if (neg.length > 0) {
    await prisma.$transaction(
      neg.map((p) => prisma.ibsaProduct.update({ where: { id: p.id }, data: { git: 0 } }))
    );
  }
}

// ─── Edit PO lines ─────────────────────────────────────────────────────────

export type LineEdit = {
  id: string;
  cartonsOrdered: number;
  pricePerCarton: number | null;
  totalCost: number | null;
};

/**
 * Save edits to PO lines (corrected quantities / prices).
 * Adjusts GIT for any change in cartonsOrdered so in-transit stock stays accurate.
 */
export async function updatePoLines(poId: string, edits: LineEdit[]) {
  // Fetch current lines so we can diff cartonsOrdered
  const po = await prisma.ibsaPurchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: true },
  });
  if (!po) throw new Error("PO not found");

  const gitDelta = new Map<string, number>(); // +ve = increment GIT, -ve = decrement

  for (const edit of edits) {
    const current = po.lines.find((l) => l.id === edit.id);
    if (!current) continue;

    const diff = edit.cartonsOrdered - current.cartonsOrdered;
    if (diff !== 0) {
      const breakdown: BreakdownItem[] = JSON.parse(current.productBreakdown || "[]");
      const totalNeeded = breakdown.reduce((s, p) => s + p.units, 0);

      // Units delta: use cartonSize if known, else scale proportionally from demand
      const scaleUnits = (cartons: number) =>
        current.cartonSize != null ? cartons * current.cartonSize : totalNeeded === 0 ? 0 : (cartons / current.cartonsOrdered) * totalNeeded;

      const unitDiff = Math.round(scaleUnits(Math.abs(diff)));
      applyBreakdown(breakdown, unitDiff, gitDelta, diff > 0 ? 1 : -1);
    }
  }

  // New PO total = sum of line totalCosts
  const newTotal = edits.reduce((s, e) => s + (e.totalCost ?? 0), 0);

  await prisma.$transaction([
    prisma.ibsaPurchaseOrder.update({
      where: { id: poId },
      data: { totalExVat: newTotal },
    }),
    ...edits.map((e) =>
      prisma.ibsaPurchaseOrderLine.update({
        where: { id: e.id },
        data: {
          cartonsOrdered: e.cartonsOrdered,
          pricePerCarton: e.pricePerCarton,
          totalCost: e.totalCost,
        },
      })
    ),
    ...Array.from(gitDelta.entries()).map(([productId, delta]) =>
      prisma.ibsaProduct.update({
        where: { id: productId },
        data: { git: { increment: delta } },
      })
    ),
  ]);

  await clampGitAtZero(Array.from(gitDelta.keys()));

  revalidatePath("/ibsa/pos");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/products");
}

// ─── Receive lines (partial or full) ──────────────────────────────────────

export type LineReceipt = {
  lineId: string;
  cartonsReceiving: number; // quantity arriving NOW (added on top of cartonsReceived)
};

/**
 * Book in stock for one or more lines on a PO.
 * - `cartonsReceiving` is the quantity arriving in THIS delivery (not a cumulative total).
 * - Updates cartonsReceived, increments inStock, decrements GIT.
 * - Sets PO status to "partial" or "received" depending on whether all lines are now fulfilled.
 */
export async function receivePoLines(poId: string, receipts: LineReceipt[]) {
  const po = await prisma.ibsaPurchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: true },
  });
  if (!po) throw new Error("PO not found");

  // Only process lines where something is actually being received
  const active = receipts.filter((r) => r.cartonsReceiving > 0);
  if (active.length === 0) return;

  const stockDelta = new Map<string, number>();

  for (const receipt of active) {
    const line = po.lines.find((l) => l.id === receipt.lineId);
    if (!line) continue;

    const breakdown: BreakdownItem[] = JSON.parse(line.productBreakdown || "[]");
    const totalNeeded = breakdown.reduce((s, p) => s + p.units, 0);

    const unitsReceiving =
      line.cartonSize != null
        ? receipt.cartonsReceiving * line.cartonSize
        : totalNeeded === 0
        ? 0
        : Math.round((receipt.cartonsReceiving / line.cartonsOrdered) * totalNeeded);

    applyBreakdown(breakdown, unitsReceiving, stockDelta, 1);
  }

  // Work out new cartonsReceived per line, then decide PO status
  const updatedReceived = new Map<string, number>();
  for (const line of po.lines) {
    const r = active.find((x) => x.lineId === line.id);
    updatedReceived.set(line.id, line.cartonsReceived + (r?.cartonsReceiving ?? 0));
  }

  const allFulfilled = po.lines.every(
    (l) => (updatedReceived.get(l.id) ?? 0) >= l.cartonsOrdered
  );
  const newStatus = allFulfilled ? "received" : "partial";
  const receivedAt = allFulfilled ? new Date() : po.receivedAt;

  await prisma.$transaction([
    prisma.ibsaPurchaseOrder.update({
      where: { id: poId },
      data: { status: newStatus, ...(receivedAt ? { receivedAt } : {}) },
    }),
    ...active.map((r) =>
      prisma.ibsaPurchaseOrderLine.update({
        where: { id: r.lineId },
        data: { cartonsReceived: { increment: r.cartonsReceiving } },
      })
    ),
    ...Array.from(stockDelta.entries()).map(([productId, units]) =>
      prisma.ibsaProduct.update({
        where: { id: productId },
        data: { inStock: { increment: units }, git: { decrement: units } },
      })
    ),
  ]);

  await clampGitAtZero(Array.from(stockDelta.keys()));

  revalidatePath("/ibsa/pos");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/products");
}

// ─── Cancel PO ────────────────────────────────────────────────────────────

/**
 * Cancel a PO — reverses any GIT that hasn't yet been received.
 */
export async function cancelPo(poId: string) {
  const po = await prisma.ibsaPurchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: true },
  });
  if (!po) throw new Error("PO not found");

  const gitDelta = new Map<string, number>();

  for (const line of po.lines) {
    // Only reverse the portion not yet received
    const outstanding = line.cartonsOrdered - line.cartonsReceived;
    if (outstanding <= 0) continue;

    const breakdown: BreakdownItem[] = JSON.parse(line.productBreakdown || "[]");
    const totalNeeded = breakdown.reduce((s, p) => s + p.units, 0);
    const unitsOutstanding =
      line.cartonSize != null
        ? outstanding * line.cartonSize
        : totalNeeded === 0
        ? 0
        : Math.round((outstanding / line.cartonsOrdered) * totalNeeded);

    applyBreakdown(breakdown, unitsOutstanding, gitDelta, -1);
  }

  await prisma.$transaction([
    prisma.ibsaPurchaseOrder.update({
      where: { id: poId },
      data: { status: "cancelled" },
    }),
    ...Array.from(gitDelta.entries()).map(([productId, delta]) =>
      prisma.ibsaProduct.update({
        where: { id: productId },
        data: { git: { increment: delta } }, // delta is already negative
      })
    ),
  ]);

  await clampGitAtZero(Array.from(gitDelta.keys()));

  revalidatePath("/ibsa/pos");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/products");
}
