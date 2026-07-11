"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateRsProduct(formData: FormData) {
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supplier = (formData.get("supplier") as string)?.trim() || "Unknown";
  const ibsaProductId = (formData.get("ibsaProductId") as string)?.trim() || null;
  const rsCode = (formData.get("rsCode") as string)?.trim() || null;
  const rsDescription = (formData.get("rsDescription") as string)?.trim() || null;
  const rsVariant = (formData.get("rsVariant") as string)?.trim() || null;
  const cartonSizeStr = (formData.get("cartonSize") as string)?.trim();
  const cartonPriceStr = (formData.get("cartonPrice") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;

  await prisma.rsProduct.update({
    where: { id },
    data: {
      supplier,
      ibsaProductId: ibsaProductId || null,
      rsCode,
      rsDescription,
      rsVariant,
      cartonSize: cartonSizeStr ? parseInt(cartonSizeStr, 10) : null,
      cartonPrice: cartonPriceStr ? parseFloat(cartonPriceStr) : null,
      notes,
    },
  });

  revalidatePath("/ibsa/suppliers");
  revalidatePath("/ibsa/purchasing");
}

export async function deleteRsProduct(formData: FormData) {
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  await prisma.rsProduct.delete({ where: { id } });

  revalidatePath("/ibsa/suppliers");
  revalidatePath("/ibsa/purchasing");
}

export async function createRsProduct(formData: FormData) {
  const supplier = (formData.get("supplier") as string)?.trim() || "Unknown";
  const ibsaProductId = (formData.get("ibsaProductId") as string)?.trim() || null;
  const rsCode = (formData.get("rsCode") as string)?.trim() || null;
  const rsDescription = (formData.get("rsDescription") as string)?.trim() || null;
  const rsVariant = (formData.get("rsVariant") as string)?.trim() || null;
  const cartonSizeStr = (formData.get("cartonSize") as string)?.trim();
  const cartonPriceStr = (formData.get("cartonPrice") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;

  await prisma.rsProduct.create({
    data: {
      supplier,
      ibsaProductId: ibsaProductId || null,
      rsCode,
      rsDescription,
      rsVariant,
      cartonSize: cartonSizeStr ? parseInt(cartonSizeStr, 10) : null,
      cartonPrice: cartonPriceStr ? parseFloat(cartonPriceStr) : null,
      notes,
    },
  });

  revalidatePath("/ibsa/suppliers");
  revalidatePath("/ibsa/purchasing");
}
