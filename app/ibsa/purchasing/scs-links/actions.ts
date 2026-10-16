"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";
import { syncScsOrders } from "../../../../src/lib/scs-sync";

async function requireAuth() {
  const jar = await cookies();
  const ok = jar.get(process.env.APP_AUTH_COOKIE ?? "mailfoundry_auth")?.value === "1" || !!jar.get("ibsa_auth")?.value;
  if (!ok) throw new Error("Not signed in");
}

async function resyncAndReturn(msg: string): Promise<never> {
  // Pick up the newly linked SKU on any undispatched SCS orders straight away
  try { await syncScsOrders({ days: 90 }); } catch (e) { console.error("[scs-links] resync failed", e); }
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/purchasing/scs-links");
  revalidatePath("/ibsa/products");
  redirect(`/ibsa/purchasing/scs-links?done=${encodeURIComponent(msg)}`);
}

/** Link an SCS SKU to an existing IBSA product. */
export async function linkSku(formData: FormData) {
  await requireAuth();
  const sku = (formData.get("sku") as string)?.trim();
  const productId = (formData.get("productId") as string)?.trim();
  if (!sku || !productId) return;
  const product = await prisma.ibsaProduct.findUnique({ where: { id: productId }, select: { name: true, variant: true } });
  if (!product) throw new Error("Product not found");
  await prisma.ibsaSkuAlias.upsert({ where: { sku }, create: { sku, productId }, update: { productId } });
  await resyncAndReturn(`${sku} linked to ${product.name}${product.variant ? ` (${product.variant})` : ""}`);
}

/** Create a new IBSA product from an SCS SKU (code = SKU), with a supplier line so it can go on POs. */
export async function createFromSku(formData: FormData) {
  await requireAuth();
  const get = (k: string) => ((formData.get(k) as string) ?? "").trim();
  const sku = get("sku");
  const name = get("name");
  if (!sku || !name) return;
  const variant = get("variant") || null;
  const category = get("category") || "janitorial";
  const supplier = get("supplier") || "Robert Scott";
  const unitCost = parseFloat(get("unitCost")) || 0;
  const cartonSize = Math.max(1, parseInt(get("cartonSize"), 10) || 1);
  const rsCode = get("rsCode") || null;

  const exists = await prisma.ibsaProduct.findUnique({ where: { code: sku }, select: { id: true } });
  if (exists) {
    await prisma.ibsaSkuAlias.upsert({ where: { sku }, create: { sku, productId: exists.id }, update: { productId: exists.id } });
  } else {
    await prisma.ibsaProduct.create({
      data: {
        code: sku,
        name,
        variant,
        category,
        type: "CS",
        unitCost,
        visibleInOrderForm: false, // SCS-only for now — turn on in Products if wanted for conventions
        rsProducts: {
          create: {
            supplier,
            rsCode,
            rsVariant: variant,
            rsDescription: [name, variant].filter(Boolean).join(" — "),
            cartonSize,
            cartonPrice: unitCost ? Math.round(unitCost * cartonSize * 100) / 100 : null,
            notes: "Created from an SCS web order SKU.",
          },
        },
      },
    });
  }
  await resyncAndReturn(`${name}${variant ? ` (${variant})` : ""} added to IBSA products`);
}
