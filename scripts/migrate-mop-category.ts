/**
 * One-off migration: move all products with "mop" in the name
 * from category "janitorial" → "mops".
 *
 * Run from the sendforge directory:
 *   npx tsx scripts/migrate-mop-category.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Preview first
  const toMove = await prisma.ibsaProduct.findMany({
    where: {
      category: "janitorial",
      name: { contains: "mop", mode: "insensitive" },
    },
    select: { id: true, name: true, variant: true },
    orderBy: { name: "asc" },
  });

  if (toMove.length === 0) {
    console.log("Nothing to migrate — no janitorial products with 'mop' in the name.");
    return;
  }

  console.log(`\nWill move ${toMove.length} product(s) from "janitorial" → "mops":\n`);
  toMove.forEach((p) =>
    console.log(`  • ${p.name}${p.variant ? ` (${p.variant})` : ""}`)
  );

  const result = await prisma.ibsaProduct.updateMany({
    where: {
      category: "janitorial",
      name: { contains: "mop", mode: "insensitive" },
    },
    data: { category: "mops" },
  });

  console.log(`\n✓ Updated ${result.count} product(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
