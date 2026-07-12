"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateProduct(formData: FormData) {
  const id       = (formData.get("id") as string).trim();
  const name     = (formData.get("name") as string).trim();
  const variant  = (formData.get("variant") as string).trim() || null;
  const code     = (formData.get("code") as string).trim();
  const category = (formData.get("category") as string).trim();
  const type     = (formData.get("type") as string).trim();
  const unitCost = parseFloat(formData.get("unitCost") as string) || 0;
  const xyloCostRaw = (formData.get("xyloCost") as string).trim();
  const xyloCost = xyloCostRaw !== "" ? parseFloat(xyloCostRaw) : null;

  if (!id || !name || !code || !category || !type) return;

  await prisma.ibsaProduct.update({
    where: { id },
    data: { name, variant, code, category, type, unitCost, xyloCost },
  });

  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/suppliers");
}

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
