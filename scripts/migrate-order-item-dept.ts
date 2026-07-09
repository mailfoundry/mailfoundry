/**
 * One-time data migration: sets dept="FA" on all order items whose product
 * has type="FA". Existing items defaulted to dept="CS" after the schema change.
 *
 * Run ONCE immediately after: npx prisma migrate dev --name add-dept-to-order-item
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/migrate-order-item-dept.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as never) as any;

async function main() {
  // Find all order items whose product type is FA
  const faItems = await prisma.ibsaOrderItem.findMany({
    where: { product: { type: "FA" } },
    select: { id: true, conventionId: true, productId: true },
  });

  console.log(`Found ${faItems.length} FA product order items to migrate\n`);

  let updated = 0;
  for (const item of faItems) {
    await prisma.ibsaOrderItem.update({
      where: { id: item.id },
      data: { dept: "FA" },
    });
    updated++;
  }

  console.log(`✓ ${updated} items updated to dept="FA"`);
  console.log('\nNow re-run: npx tsx scripts/import-invoice.ts INV-0231');
  console.log('(This re-imports the Bournemouth FA invoice with dept="FA", adding the 3 CS-type items)');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
