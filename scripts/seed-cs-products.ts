/**
 * Seeds all CS products from the master price list CSV.
 * CSV format: Product Code, Sale Price, Cost Price
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/seed-cs-products.ts '/path/to/CS - Master.csv'
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as unknown as {
  ibsaProduct: { upsert: (a: unknown) => Promise<{ id: string }> };
  $disconnect: () => Promise<void>;
};

// ── Category keyword mapping ──────────────────────────────────────────────────
function getCategory(code: string): string {
  const c = code.toUpperCase();
  if (/HI_VIS|GLOVES|EYEWEAR|MASK_|APRONS|BIO_HAZARD|SHARPS/.test(c)) return "safety_ppe";
  if (/IMPACT_|CLOVER_|PUMP_|CHEMICAL/.test(c)) return "chemicals";
  return "janitorial";
}

// ── Name + variant from code ──────────────────────────────────────────────────
const SIZE_SUFFIXES = /_(S|M|L|XL|XXL|SML|MED|SMALL|MEDIUM|LARGE|XLARGE)$/i;
const COLOUR_SUFFIXES = /_(RED|BLUE|GREEN|YELLOW|WHITE|PINK|CLEAR|BLACK|ORANGE)$/i;
const PACK_SUFFIXES = /_(\d+PK|X\d+|\d+PACK)$/i;

function parseName(raw: string): { name: string; variant: string | null } {
  // Products that already have spaces (not underscore-delimited)
  if (!raw.includes("_") || raw.includes(" ")) {
    // e.g. "BROOM HEAD WASHABLE 30CM SOFT - BLUE"
    const dashIdx = raw.lastIndexOf(" - ");
    if (dashIdx > -1) {
      return {
        name: toTitle(raw.slice(0, dashIdx)),
        variant: toTitle(raw.slice(dashIdx + 3)),
      };
    }
    return { name: toTitle(raw), variant: null };
  }

  // Underscore-delimited codes — strip known suffix patterns to find variant
  let remainder = raw;
  const variants: string[] = [];

  let match: RegExpMatchArray | null;
  while (
    (match = remainder.match(SIZE_SUFFIXES)) ||
    (match = remainder.match(COLOUR_SUFFIXES)) ||
    (match = remainder.match(PACK_SUFFIXES))
  ) {
    variants.unshift(toTitle(match[1]));
    remainder = remainder.slice(0, remainder.length - match[0].length);
  }

  const name = toTitle(remainder.replace(/_/g, " "));
  const variant = variants.length ? variants.join(" ") : null;
  return { name, variant };
}

function toTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function parsePrice(s: string): number {
  return parseFloat(s.replace(/[£,\s]/g, "")) || 0;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/seed-cs-products.ts <path-to-csv>");
    process.exit(1);
  }

  const lines = fs
    .readFileSync(path.resolve(csvPath), "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Skip header
  const rows = lines.slice(1).map((l) => {
    // Handle quoted fields (e.g. JUG_FUNNEL_6"")
    const parts = l.match(/(".*?"|[^,]+)/g)?.map((p) => p.replace(/^"|"$/g, "")) ?? [];
    return parts;
  });

  console.log(`Seeding ${rows.length} CS products...\n`);

  let count = 0;
  for (const [code, saleRaw, costRaw] of rows) {
    if (!code) continue;
    const unitCost = parsePrice(saleRaw);
    const xyloCost = parsePrice(costRaw);
    const { name, variant } = parseName(code);
    const category = getCategory(code);

    await prisma.ibsaProduct.upsert({
      where: { code },
      create: { code, name, variant, category, type: "CS", unitCost, xyloCost },
      update: { name, variant, category, unitCost, xyloCost },
    } as never);

    count++;
    process.stdout.write(".");
  }

  console.log(`\n\n✓ ${count} CS products seeded.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
