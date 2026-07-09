/**
 * One-time price corrections where invoice prices differ from the CS Master CSV.
 * Usage: export $(grep DATABASE_URL .env | tr -d '"') && npx tsx scripts/update-product-prices.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as never) as any;

const CORRECTIONS = [
  { code: "CLOVER_ULTRAFRESH_1L",  unitCost: 8.89 },
  { code: "CLOVER_ULTRAFRESH_5L",  unitCost: 20.99 },
  { code: "CLOVER_HAND_SOAP_1L",   unitCost: 7.49 },
];

async function main() {
  for (const { code, unitCost } of CORRECTIONS) {
    await prisma.ibsaProduct.update({ where: { code }, data: { unitCost } });
    console.log(`✓ ${code} → £${unitCost.toFixed(2)}`);
  }
  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
