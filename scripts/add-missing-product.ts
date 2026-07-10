/**
 * One-time: add WRAP_CELLOPHANE_CLEAR to IbsaProduct.
 * Usage: export $(grep DATABASE_URL .env | tr -d '"') && npx tsx scripts/add-missing-product.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

async function main() {
  const result = await prisma.ibsaProduct.upsert({
    where: { code: "WRAP_CELLOPHANE_CLEAR" },
    create: {
      code: "WRAP_CELLOPHANE_CLEAR",
      name: "Cellophane Wrap",
      variant: "Clear",
      category: "special",
      type: "CS",
      unitCost: 12.99,
    },
    update: {},
  });
  console.log(`✓ WRAP_CELLOPHANE_CLEAR upserted (${result.id})`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
