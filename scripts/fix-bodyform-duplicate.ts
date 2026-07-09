/**
 * One-time cleanup: removes the duplicate FA product created with the typo code
 * "BODYFORM_HYGEINE_PADS_12PACK" (HYGEINE instead of HYGIENE).
 *
 * The correct product is "BODYFORM_HYGIENE_PADS_12PACK". The typo product was
 * auto-created during the first import of INV-0231 before the CODE_ALIASES entry
 * existed. Its order items are cascade-deleted with the product.
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/fix-bodyform-duplicate.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as never) as any;

async function main() {
  const TYPO_CODE = "BODYFORM_HYGEINE_PADS_12PACK";

  const product = await prisma.ibsaProduct.findUnique({ where: { code: TYPO_CODE } });
  if (!product) {
    console.log(`No product found with code "${TYPO_CODE}" — nothing to do.`);
    return;
  }

  // Count order items that will be cascade-deleted
  const orderItems = await prisma.ibsaOrderItem.findMany({ where: { productId: product.id } });
  console.log(`Found product "${TYPO_CODE}" (id: ${product.id})`);
  console.log(`  → ${orderItems.length} order item(s) will be cascade-deleted`);
  for (const item of orderItems) {
    console.log(`     conventionId=${item.conventionId}  dept=${item.dept}  qty=${item.qty}`);
  }

  await prisma.ibsaProduct.delete({ where: { code: TYPO_CODE } });
  console.log(`\n✓ Deleted "${TYPO_CODE}" and its ${orderItems.length} order item(s).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
