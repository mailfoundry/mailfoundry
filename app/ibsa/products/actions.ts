"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

export async function uploadProductImage(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "No file provided" };
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { error: "BLOB_READ_WRITE_TOKEN is not set" };
    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `product-images/${Date.now()}.${ext}`;
    const blob = await put(filename, file, { access: "public", token });
    return { url: blob.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

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
  const description = (formData.get("description") as string | null)?.trim() || null;
  const imageUrl = (formData.get("imageUrl") as string | null)?.trim() || null;
  const groupImageUrl = (formData.get("groupImageUrl") as string | null)?.trim() || null;
  const groupWithVariants = formData.get("groupWithVariants") === "true";

  // Supplier changes: [{id: rsProductId, supplier: newName}]
  const supplierChangesRaw = (formData.get("supplierChanges") as string | null) ?? "[]";
  const supplierChanges: Array<{ id: string; supplier: string }> = JSON.parse(supplierChangesRaw);

  if (!id || !name || !code || !category || !type) return;

  await prisma.$transaction([
    prisma.ibsaProduct.update({
      where: { id },
      data: { name, variant, code, category, type, unitCost, xyloCost, description, imageUrl, groupImageUrl, groupWithVariants },
    }),
    ...supplierChanges
      .filter((sc) => sc.supplier.trim())
      .map((sc) =>
        prisma.rsProduct.update({
          where: { id: sc.id },
          data: { supplier: sc.supplier.trim() },
        })
      ),
  ]);

  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/suppliers");
}

/** Create a new RS product link for a product */
export async function createRsProductLink(formData: FormData) {
  const ibsaProductId = (formData.get("ibsaProductId") as string).trim();
  const supplier      = (formData.get("supplier") as string).trim();

  if (!ibsaProductId || !supplier) return;

  await prisma.rsProduct.create({
    data: {
      ibsaProductId,
      supplier,
      rsCode:        (formData.get("rsCode") as string)?.trim() || null,
      rsVariant:     (formData.get("rsVariant") as string)?.trim() || null,
      rsDescription: (formData.get("rsDescription") as string)?.trim() || null,
      cartonSize:    parseInt(formData.get("cartonSize") as string) || null,
      cartonPrice:   parseFloat(formData.get("cartonPrice") as string) || null,
    },
  });

  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/suppliers");
}

/** Delete an RS product link */
export async function deleteRsProductLink(formData: FormData) {
  const id = (formData.get("id") as string).trim();
  if (!id) return;
  await prisma.rsProduct.delete({ where: { id } });
  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/suppliers");
}

/** Add a BOM component line to a composite product */
export async function addBomLine(formData: FormData) {
  const compositeId = (formData.get("compositeId") as string).trim();
  const componentId = (formData.get("componentId") as string).trim();
  const qty = Math.max(1, parseInt(formData.get("qty") as string) || 1);

  if (!compositeId || !componentId || compositeId === componentId) return;

  await prisma.ibsaProductBom.upsert({
    where: { compositeId_componentId: { compositeId, componentId } },
    create: { compositeId, componentId, qty },
    update: { qty },
  });

  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
}

/** Remove a BOM line by its id */
export async function removeBomLine(formData: FormData) {
  const id = (formData.get("id") as string).trim();
  if (!id) return;
  await prisma.ibsaProductBom.delete({ where: { id } });
  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
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
