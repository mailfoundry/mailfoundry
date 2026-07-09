/**
 * Removes unwanted conventions (and their order items) from the DB.
 * Usage: export $(grep DATABASE_URL .env | tr -d '"') && npx tsx scripts/remove-conventions.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as never) as any;

const TO_REMOVE = [
  "ATHLONE",
  "BRIGHTON",
  "BSL",
  "CHINESE",
  "CORK",
  "Exeter A - Westpoint Arena",
  "GREEK",
  "HUNGARIAN MANCHESTER",
  "LINGALA",
  "LONDON EAST A",
  "LONDON East A & B",
  "LONDON NORTH ASSEMBLY HALL",
  "LONDON SURREY B",
  "MILTON KEYNES B",
  "MILTON KEYNES C",
  "NEWPORT A",
  "NEWPORT B",
  "POLISH",
  "PUNJABI",
  "ROMAINIAN",
  "RUSSIAN",
  "SHEFFIELD",
  "SPANISH & PROTUGUESE SOME SESSIONS ALLIANZ",
  "Scotland 01 - Aviemore",
  "TAGALOG",
  "WELSH",
];

async function main() {
  let removed = 0;
  let notFound = 0;

  for (const name of TO_REMOVE) {
    const conv = await prisma.ibsaConvention.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (!conv) {
      console.log(`  – Not found: "${name}"`);
      notFound++;
      continue;
    }

    // Delete order items first (no cascade)
    const items = await prisma.ibsaOrderItem.deleteMany({
      where: { conventionId: conv.id },
    });
    await prisma.ibsaConvention.delete({ where: { id: conv.id } });
    console.log(`  ✓ Removed "${conv.name}" (${items.count} order items)`);
    removed++;
  }

  console.log(`\nDone. ${removed} removed, ${notFound} not found.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
