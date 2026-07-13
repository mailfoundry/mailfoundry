/**
 * One-time: create a dedicated "Milton Keynes FA" convention entry.
 * Usage: export $(grep DATABASE_URL .env | tr -d '"') && npx tsx scripts/create-mk-fa-convention.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

async function main() {
  const existing = await prisma.ibsaConvention.findFirst({
    where: { name: { equals: "Milton Keynes FA", mode: "insensitive" } },
  });
  if (existing) {
    console.log(`Already exists: "${existing.name}" (${existing.id})`);
    return;
  }

  const created = await prisma.ibsaConvention.create({
    data: {
      name: "Milton Keynes FA",
      venue: "Stadium MK, Stadium Way West, Bletchley, MK1 1ST",
      conventionDate: new Date("2026-07-10"),
      deliveryDate: new Date("2026-07-07"),
      contactName: "Simon Truss",
      contactEmail: "sitruss1970@googlemail.com",
      contactMobile: "07702 861670",
      deliveryAddress: "Stadium MK, Stadium Way West, Bletchley, Milton Keynes, MK1 1ST",
      status: "pending",
    },
  });
  console.log(`✓ Created "${created.name}" (${created.id})`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
