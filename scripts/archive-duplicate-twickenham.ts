/**
 * One-time cleanup: archive the duplicate "REMOVE DUPLICATE - Twickenham" convention.
 * Usage: export $(grep DATABASE_URL .env | tr -d '"') && npx tsx scripts/archive-duplicate-twickenham.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

async function main() {
  const conv = await prisma.ibsaConvention.findFirst({
    where: { name: { contains: "REMOVE DUPLICATE", mode: "insensitive" } },
  });
  if (!conv) { console.log("Convention not found — nothing to do."); return; }

  const items = await prisma.ibsaOrderItem.count({ where: { conventionId: conv.id } });
  if (items > 0) {
    console.log(`⚠️  Convention "${conv.name}" has ${items} order items — aborting to be safe.`);
    console.log("   Delete them manually first if you still want to archive this convention.");
    return;
  }

  await prisma.ibsaConvention.update({
    where: { id: conv.id },
    data: { archivedAt: new Date() },
  });
  console.log(`✓ Archived "${conv.name}"`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
