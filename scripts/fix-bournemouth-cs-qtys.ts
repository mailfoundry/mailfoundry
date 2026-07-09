/**
 * One-time fix: restores Bournemouth CS order quantities corrupted by FA import.
 *
 * The FA invoice (INV-0231) upserted three CS-type products, overwriting or
 * adding order items that belong solely to the CS invoice (INV-0232):
 *   - GLOVES_NITRILE_BLUE_SML: FA set qty=2, CS invoice had qty=1
 *   - GLOVES_NITRILE_BLUE_XL: FA set qty=2, CS invoice had qty=1
 *   - BIO_HAZARD_KITS: not on CS invoice at all, FA added qty=1
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/fix-bournemouth-cs-qtys.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as never) as any;

async function main() {
  const convention = await prisma.ibsaConvention.findFirst({
    where: { name: { equals: "Bournemouth", mode: "insensitive" } },
  });
  if (!convention) { console.error("Bournemouth convention not found"); process.exit(1); }
  console.log(`Convention: "${convention.name}" (${convention.id})\n`);

  // Restore CS invoice qtys
  const restores = [
    { code: "GLOVES_NITRILE_BLUE_SML", qty: 1 },
    { code: "GLOVES_NITRILE_BLUE_XL",  qty: 1 },
  ];
  for (const { code, qty } of restores) {
    const product = await prisma.ibsaProduct.findUnique({ where: { code } });
    if (!product) { console.warn(`  ✗ Product not found: ${code}`); continue; }
    await prisma.ibsaOrderItem.update({
      where: { conventionId_productId: { conventionId: convention.id, productId: product.id } },
      data: { qty },
    });
    console.log(`  ✓ ${code} → qty ${qty}`);
  }

  // Remove BIO_HAZARD_KITS (not on CS invoice)
  const biohazard = await prisma.ibsaProduct.findUnique({ where: { code: "BIO_HAZARD_KITS" } });
  if (biohazard) {
    const deleted = await prisma.ibsaOrderItem.deleteMany({
      where: { conventionId: convention.id, productId: biohazard.id },
    });
    console.log(`  ✓ BIO_HAZARD_KITS removed (${deleted.count} record)`);
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
