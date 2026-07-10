"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateProductStock(formData: FormData) {
  const productId = formData.get("productId")?.toString() ?? "";
  const inStock = parseInt(formData.get("inStock")?.toString() ?? "0") || 0;
  const git = parseInt(formData.get("git")?.toString() ?? "0") || 0;

  if (!productId) return;

  await prisma.ibsaProduct.update({
    where: { id: productId },
    data: { inStock, git },
  });

  revalidatePath("/ibsa/products");
}

export async function bulkUpdateInStock(
  updates: { id: string; inStock: number }[]
) {
  if (!updates.length) return;

  await prisma.$transaction(
    updates.map(({ id, inStock }) =>
      prisma.ibsaProduct.update({
        where: { id },
        data: { inStock },
      })
    )
  );

  revalidatePath("/ibsa/products");
}
