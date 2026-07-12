"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

type LineInput = {
  rsCode: string | null;
  description: string;
  variant: string | null;
  cartonSize: number | null;
  cartonsOrdered: number;
  pricePerCarton: number | null;
  totalCost: number | null;
  productBreakdown: Array<{ ibsaProductId: string; name: string; units: number }>;
};

/**
 * Saves a purchase order snapshot.
 * Does NOT automatically adjust stock or GIT — the Orders page handles booking in.
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

  revalidatePath("/ibsa/orders");
  revalidatePath("/ibsa/purchasing");
}
