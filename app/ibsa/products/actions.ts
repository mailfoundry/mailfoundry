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

export async function createProduct(formData: FormData) {
  const name     = (formData.get("name") as string).trim();
  const variant  = (formData.get("variant") as string).trim() || null;
  const code     = (formData.get("code") as string).trim();
  const category = (formData.get("category") as string).trim();
  const type     = (formData.get("type") as string).trim();
  const unitCost = parseFloat(formData.get("unitCost") as string) || 0;
  const xyloCostRaw = (formData.get("xyloCost") as string).trim();
  const xyloCost = xyloCostRaw !== "" ? parseFloat(xyloCostRaw) : null;
  const description   = (formData.get("description") as string | null)?.trim() || null;
  const groupDescription = (formData.get("groupDescription") as string | null)?.trim() || null;
  const imageUrl      = (formData.get("imageUrl") as string | null)?.trim() || null;
  const groupImageUrl = (formData.get("groupImageUrl") as string | null)?.trim() || null;
  const groupWithVariants = formData.get("groupWithVariants") === "true";
  const venueType = (formData.get("venueType") as string | null)?.trim() || "all";
  const sectionLabel = (formData.get("sectionLabel") as string | null)?.trim() || null;

  if (!name || !code || !category || !type) return;

  await prisma.ibsaProduct.create({
    data: { name, variant, code, category, type, unitCost, xyloCost, description, groupDescription, imageUrl, groupImageUrl, groupWithVariants, venueType, sectionLabel },
  });

  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
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
  const groupDescription = (formData.get("groupDescription") as string | null)?.trim() || null;
  const imageUrl = (formData.get("imageUrl") as string | null)?.trim() || null;
  const groupImageUrl = (formData.get("groupImageUrl") as string | null)?.trim() || null;
  const groupWithVariants = formData.get("groupWithVariants") === "true";
  const venueType = (formData.get("venueType") as string | null)?.trim() || "all";
  const sectionLabel = (formData.get("sectionLabel") as string | null)?.trim() || null;

  // Supplier changes: [{id: rsProductId, supplier: newName}]
  const supplierChangesRaw = (formData.get("supplierChanges") as string | null) ?? "[]";
  const supplierChanges: Array<{ id: string; supplier: string }> = JSON.parse(supplierChangesRaw);

  if (!id || !name || !code || !category || !type) return;

  await prisma.$transaction([
    prisma.ibsaProduct.update({
      where: { id },
      data: { name, variant, code, category, type, unitCost, xyloCost, description, groupDescription, imageUrl, groupImageUrl, groupWithVariants, venueType, sectionLabel },
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

/** Update an existing RS product link */
export async function updateRsProductLink(formData: FormData) {
  const id = (formData.get("id") as string).trim();
  if (!id) return;

  await prisma.rsProduct.update({
    where: { id },
    data: {
      supplier:      (formData.get("supplier") as string)?.trim() || undefined,
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

/**
 * Delete a product. If it's already used (on an order, convention order or as a kit component) it can't
 * simply be deleted — pass mergeIntoId to move everything onto another product first:
 * order lines (qty summed if the target is already on that order), kit components, SKU links,
 * In Stock / GIT, and its code is kept as an SKU link so SCS sales of it still find the target.
 */
export async function deleteProduct(formData: FormData): Promise<{ ok: boolean; error?: string; needsMerge?: boolean }> {
  const id = (formData.get("id") as string)?.trim();
  const mergeIntoId = (formData.get("mergeIntoId") as string | null)?.trim() || "";
  if (!id) return { ok: false, error: "No product selected" };

  try {
    const [orderItems, groupLines, bomComponents] = await Promise.all([
      prisma.ibsaOrderItem.count({ where: { productId: id } }),
      prisma.ibsaGroupOrderLine.count({ where: { productId: id } }),
      prisma.ibsaProductBom.count({ where: { componentId: id } }),
    ]);
    const used = orderItems + groupLines + bomComponents;

    if (used && !mergeIntoId) {
      const parts = [
        groupLines ? `${groupLines} order line${groupLines === 1 ? "" : "s"}` : null,
        orderItems ? `${orderItems} convention order line${orderItems === 1 ? "" : "s"}` : null,
        bomComponents ? `${bomComponents} kit${bomComponents === 1 ? "" : "s"}` : null,
      ].filter(Boolean).join(", ");
      return { ok: false, needsMerge: true, error: `This product is used on ${parts}. Choose the product to merge it into — its orders, stock and SKU will move across — then delete.` };
    }

    if (!mergeIntoId) {
      await prisma.ibsaProduct.delete({ where: { id } });
    } else {
      if (mergeIntoId === id) return { ok: false, needsMerge: true, error: "Pick a different product to merge into." };
      const [source, target] = await Promise.all([
        prisma.ibsaProduct.findUnique({ where: { id }, select: { code: true, inStock: true, git: true } }),
        prisma.ibsaProduct.findUnique({ where: { id: mergeIntoId }, select: { id: true } }),
      ]);
      if (!source || !target) return { ok: false, error: "Product not found" };

      await prisma.$transaction(async (tx) => {
        // Group / SCS order lines
        for (const l of await tx.ibsaGroupOrderLine.findMany({ where: { productId: id } })) {
          const clash = await tx.ibsaGroupOrderLine.findUnique({
            where: { orderId_productId_dept: { orderId: l.orderId, productId: mergeIntoId, dept: l.dept } },
          });
          if (clash) {
            await tx.ibsaGroupOrderLine.update({ where: { id: clash.id }, data: { qty: clash.qty + l.qty } });
            await tx.ibsaGroupOrderLine.delete({ where: { id: l.id } });
          } else {
            await tx.ibsaGroupOrderLine.update({ where: { id: l.id }, data: { productId: mergeIntoId } });
          }
        }
        // Convention order lines
        for (const i of await tx.ibsaOrderItem.findMany({ where: { productId: id } })) {
          const clash = await tx.ibsaOrderItem.findUnique({
            where: { conventionId_productId_dept: { conventionId: i.conventionId, productId: mergeIntoId, dept: i.dept } },
          });
          if (clash) {
            await tx.ibsaOrderItem.update({ where: { id: clash.id }, data: { qty: clash.qty + i.qty } });
            await tx.ibsaOrderItem.delete({ where: { id: i.id } });
          } else {
            await tx.ibsaOrderItem.update({ where: { id: i.id }, data: { productId: mergeIntoId } });
          }
        }
        // Kit components
        for (const b of await tx.ibsaProductBom.findMany({ where: { componentId: id } })) {
          const clash = await tx.ibsaProductBom.findUnique({
            where: { compositeId_componentId: { compositeId: b.compositeId, componentId: mergeIntoId } },
          });
          if (clash) {
            await tx.ibsaProductBom.update({ where: { id: clash.id }, data: { qty: clash.qty + b.qty } });
            await tx.ibsaProductBom.delete({ where: { id: b.id } });
          } else if (b.compositeId !== mergeIntoId) {
            await tx.ibsaProductBom.update({ where: { id: b.id }, data: { componentId: mergeIntoId } });
          } else {
            await tx.ibsaProductBom.delete({ where: { id: b.id } });
          }
        }
        // SKU links + keep the deleted product's code pointing at the target (so SCS sales still match)
        await tx.ibsaSkuAlias.updateMany({ where: { productId: id }, data: { productId: mergeIntoId } });
        // Stock moves across
        await tx.ibsaProduct.update({
          where: { id: mergeIntoId },
          data: { inStock: { increment: source.inStock }, git: { increment: source.git } },
        });
        await tx.ibsaProduct.delete({ where: { id } });
        await tx.ibsaSkuAlias.upsert({
          where: { sku: source.code },
          create: { sku: source.code, productId: mergeIntoId },
          update: { productId: mergeIntoId },
        });
      }, { timeout: 20000 });
    }

    revalidatePath("/ibsa/products");
    revalidatePath("/ibsa/purchasing");
    revalidatePath("/ibsa/orders");
    revalidatePath("/order");
    return { ok: true };
  } catch (err) {
    console.error("deleteProduct error:", err);
    return { ok: false, error: "Couldn't delete this product — it may be linked to other records. Try merging it into another product." , needsMerge: true };
  }
}

export async function toggleProductVisibility(formData: FormData) {
  const id = (formData.get("id") as string).trim();
  const visible = formData.get("visible") === "true";
  if (!id) return;
  await prisma.ibsaProduct.update({ where: { id }, data: { visibleInOrderForm: !visible } });
  revalidatePath("/ibsa/products");
  revalidatePath("/order");
  revalidatePath("/convention");
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

export async function duplicateProduct(id: string) {
  try {
  const source = await prisma.ibsaProduct.findUnique({
    where: { id },
    include: { rsProducts: true },
  });
  if (!source) return;

  const copy = await prisma.ibsaProduct.create({
    data: {
      name:              source.name + " (Copy)",
      variant:           source.variant,
      code:              source.code + "-COPY-" + Date.now(),
      category:          source.category,
      type:              source.type,
      unitCost:          source.unitCost,
      xyloCost:          source.xyloCost,
      description:       source.description,
      groupDescription:  source.groupDescription,
      imageUrl:          source.imageUrl,
      groupImageUrl:     source.groupImageUrl,
      groupWithVariants: source.groupWithVariants,
      venueType:         source.venueType,
      sectionLabel:      source.sectionLabel,
      visibleInOrderForm: source.visibleInOrderForm,
      sortOrder:         source.sortOrder + 5,
      inStock:           0,
      git:               0,
    },
  });

  // Copy RS product links
  if (source.rsProducts.length > 0) {
    await prisma.$transaction(
      source.rsProducts.map((rp) =>
        prisma.rsProduct.create({
          data: {
            ibsaProductId: copy.id,
            supplier:      rp.supplier,
            rsCode:        rp.rsCode,
            rsVariant:     rp.rsVariant,
            rsDescription: rp.rsDescription,
            cartonSize:    rp.cartonSize,
            cartonPrice:   rp.cartonPrice,
          },
        })
      )
    );
  }

  revalidatePath("/ibsa/products");
  revalidatePath("/ibsa/purchasing");
  return copy.id;
  } catch (err) {
    console.error("duplicateProduct error:", err);
    return null;
  }
}

export async function updateProductSortOrder(
  updates: { id: string; sortOrder: number }[]
) {
  if (!updates.length) return;

  // One statement instead of ~300 individual updates in a transaction (which timed out and crashed the page)
  const ids = updates.map((u) => u.id);
  const sorts = updates.map((u) => Math.round(u.sortOrder));
  await prisma.$executeRaw`
    UPDATE "IbsaProduct" AS p
    SET "sortOrder" = v.sort
    FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${sorts}::int[]) AS sort) AS v
    WHERE p.id = v.id AND p."sortOrder" IS DISTINCT FROM v.sort`;

  revalidatePath("/ibsa/products");
  revalidatePath("/convention");
  revalidatePath("/order");
}
