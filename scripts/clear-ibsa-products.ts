/**
 * Clears all IbsaOrderItem and IbsaProduct records, and resets FA logistics
 * dates on all conventions back to null.
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/clear-ibsa-products.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as unknown as {
  ibsaOrderItem: { deleteMany: (a: unknown) => Promise<{ count: number }> };
  ibsaProduct:   { deleteMany: (a: unknown) => Promise<{ count: number }> };
  ibsaConvention:{ updateMany: (a: unknown) => Promise<{ count: number }> };
  $disconnect: () => Promise<void>;
};

async function main() {
  const items = await prisma.ibsaOrderItem.deleteMany({} as never);
  console.log(`✓ Deleted ${items.count} order items`);

  const products = await prisma.ibsaProduct.deleteMany({} as never);
  console.log(`✓ Deleted ${products.count} products`);

  const convs = await prisma.ibsaConvention.updateMany({
    data: {
      faCollectionDate:  null,
      faDeliveryDate:    null,
      faPaymentDueDate:  null,
      faDeliveryAddress: null,
      faShippingCost:    0,
      faPaidAt:          null,
      faStatus:          "pending",
    },
  } as never);
  console.log(`✓ Reset FA logistics on ${convs.count} conventions`);

  console.log("\nAll clear. Ready to import from invoices.");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
