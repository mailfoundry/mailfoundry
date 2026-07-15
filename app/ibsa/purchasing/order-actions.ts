"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

type BreakdownItem = { ibsaProductId: string; name: string; units: number };

type LineInput = {
  rsCode: string | null;
  description: string;
  variant: string | null;
  cartonSize: number | null;
  cartonsOrdered: number;
  pricePerCarton: number | null;
  totalCost: number | null;
  productBreakdown: BreakdownItem[];
};

/**
 * Saves a purchase order snapshot and increments GIT for each product in the
 * breakdown so the purchasing deficit calculation reflects stock in transit.
 */
export async function markAsOrdered(formData: FormData) {
  const supplier = formData.get("supplier") as string;
  const poNumber = formData.get("poNumber") as string;
  const totalExVat = parseFloat(formData.get("totalExVat") as string) || 0;
  const lines: LineInput[] = JSON.parse(formData.get("lines") as string);

  await prisma.ibsaPurchaseOrder.create({
    data: {
      poNumber,
      supplier,
      status: "ordered",
      totalExVat,
      lines: {
        create: lines.map((l) => ({
          rsCode: l.rsCode,
          description: l.description,
          variant: l.variant,
          cartonSize: l.cartonSize,
          cartonsOrdered: l.cartonsOrdered,
          pricePerCarton: l.pricePerCarton,
          totalCost: l.totalCost,
          productBreakdown: JSON.stringify(l.productBreakdown),
        })),
      },
    },
  });

  // ── Increment GIT for each product in the order ─────────────────────────
  // Units ordered = cartonsOrdered × cartonSize; fall back to breakdown demand
  // total when cartonSize is null (catalog data not yet entered).
  const gitByProduct = new Map<string, number>();

  for (const line of lines) {
    if (line.productBreakdown.length === 0) continue;

    const totalNeeded = line.productBreakdown.reduce((s, p) => s + p.units, 0);
    if (totalNeeded === 0) continue;

    const unitsOrdered =
      line.cartonSize != null
        ? line.cartonsOrdered * line.cartonSize
        : totalNeeded; // best estimate when carton size unknown

    let remaining = unitsOrdered;
    for (let i = 0; i < line.productBreakdown.length; i++) {
      const p = line.productBreakdown[i];
      const share =
        i === line.productBreakdown.length - 1
          ? remaining
          : Math.floor((p.units / totalNeeded) * unitsOrdered);
      remaining -= share;
      if (share > 0) {
        gitByProduct.set(p.ibsaProductId, (gitByProduct.get(p.ibsaProductId) ?? 0) + share);
      }
    }
  }

  if (gitByProduct.size > 0) {
    await prisma.$transaction(
      Array.from(gitByProduct.entries()).map(([id, delta]) =>
        prisma.ibsaProduct.update({
          where: { id },
          data: { git: { increment: delta } },
        })
      )
    );
  }

  revalidatePath("/ibsa/orders");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/products");
}
