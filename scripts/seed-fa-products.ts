/**
 * Seeds FA-specific products from the First Aid product codes CSV.
 * Skips any product code already in the DB to avoid overwriting CS prices.
 * Updates FA products created earlier from invoices (adds proper name + xyloCost).
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/seed-fa-products.ts '/path/to/First Aid Product Codes.csv'
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

// Products already in CS catalog — skip to avoid overwriting CS sale prices.
// These will still be found by code when importing FA invoices.
const CS_OWNED = new Set([
  "WET_FLOOR_AFRAME",
  "GLOVES_VINYL_CLEAR_SML", "GLOVES_VINYL_CLEAR_MED", "GLOVES_VINYL_CLEAR_L", "GLOVES_VINYL_CLEAR_XL",
  "GLOVES_NITRILE_BLUE_SML", "GLOVES_NITRILE_BLUE_MED", "GLOVES_NITRILE_BLUE_L", "GLOVES_NITRILE_BLUE_XL",
  "APRONS_FLTPACK_100PK",
  "BIO_HAZARD_KITS",
  "MAINTENCE REFILL PADS_X20",
  "SPILL_KITS_MAINTENANCE_10L",
  "CENTRE_FEED_ST_BLUE_6PK",
  "CENTRE_FEED_BLUE_DL_6PK",
]);

// FA products previously auto-created from invoices — update name + xyloCost
const FA_INVOICE_CREATED = new Set([
  "FIRSTAID_KIT_LARGE_188P",
  "10PACK_LARGE_FOIL_BLANKETS",
  "100PACK_ASSORTED_WATERPROOF_PLASTERS",
  "MEDIPAL_AW_125P",
  "EYEWASH_INCCAP_500ML",
  "BODYFORM_HYGEINE_PADS_12PACK",
]);

function parsePrice(s: string): number {
  return parseFloat(s.replace(/[£,\s]/g, "")) || 0;
}

function toTitle(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/seed-fa-products.ts <path-to-csv>");
    process.exit(1);
  }

  // The CSV has multi-line quoted description fields, so we can't parse line-by-line.
  // Instead, scan the raw text for the pattern: CODE,£sale,£cost
  // Product codes are uppercase alphanumeric + underscores/slashes/spaces
  const raw = fs.readFileSync(path.resolve(csvPath), "utf-8");
  const pattern = /([A-Z][A-Z0-9_ /]+),£([\d.]+),£([\d.]+)/g;

  const matches: { code: string; unitCost: number; xyloCost: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(raw)) !== null) {
    const code = m[1].trim();
    if (code === "Product Code" || code === "Sub-Total") continue;
    matches.push({ code, unitCost: parseFloat(m[2]), xyloCost: parseFloat(m[3]) });
  }

  console.log(`Found ${matches.length} products in CSV\n`);

  let seeded = 0;
  let updated = 0;
  let skipped = 0;

  for (const { code, unitCost, xyloCost } of matches) {
    if (unitCost === 0) continue;

    const name = toTitle(code);

    if (CS_OWNED.has(code)) {
      skipped++;
      continue;
    }

    const existing = await prisma.ibsaProduct.findUnique({ where: { code } });

    if (existing) {
      if (FA_INVOICE_CREATED.has(code)) {
        // Update invoice-created products with proper name + cost price
        await prisma.ibsaProduct.update({
          where: { code },
          data: { name, unitCost, xyloCost },
        });
        console.log(`  ↑ Updated: ${code}`);
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    // Create new FA product
    await prisma.ibsaProduct.create({
      data: { code, name, category: "firstaid", type: "FA", unitCost, xyloCost },
    });
    console.log(`  + Created: ${code}`);
    seeded++;
  }

  console.log(`\n✓ ${seeded} created, ${updated} updated, ${skipped} skipped.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
