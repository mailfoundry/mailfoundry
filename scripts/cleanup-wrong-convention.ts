/**
 * One-time cleanup: remove order items incorrectly imported to "LONDON East A & B"
 * Usage: export $(grep DATABASE_URL .env | tr -d '"') && npx tsx scripts/cleanup-wrong-convention.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

async function main() {
  const conv = await prisma.ibsaConvention.findFirst({
    where: { name: { equals: "LONDON East A & B", mode: "insensitive" } },
  });
  if (!conv) { console.log("Convention not found — nothing to clean up."); return; }
  const r = await prisma.ibsaOrderItem.deleteMany({ where: { conventionId: conv.id } });
  console.log(`✓ Deleted ${r.count} items from "${conv.name}"`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
