/**
 * Seeds Bill-of-Materials for the 12 composite brush+handle products.
 *
 * Run from ~/sendforge after the migrate-bom.sql migration:
 *   export $(grep DATABASE_URL .env | tr -d '"')
 *   npx tsx scripts/seed-bom.ts          # dry run — shows what will be linked
 *   npx tsx scripts/seed-bom.ts --apply  # applies the BOM links
 *
 * The script looks up component products by their code patterns,
 * so exact DB codes don't need to be known in advance.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

const doApply = process.argv.includes("--apply");

// ── Mapping: composite code → component code patterns ────────────────────────
//
// Each composite product links to TWO components:
//  1. The brush head  (space-delimited: "BROOM HEAD WASHABLE <size> <firmness> - <colour>")
//  2. The handle      (HANDLE HYGIENE 125CM with colour variant, or the simpler handle)
//
// The brush head codes follow: "BROOM HEAD WASHABLE {size}CM {firmness} - {colour}"
// The handle codes vary; we locate them by matching name + variant.
//
// Format:  composite code → [ brushHeadCodePattern, handlePattern ]
// Where pattern is { code?: string; name?: string; variant?: string }

type ComponentPattern = {
  code?: string;     // exact code match
  nameContains?: string; // case-insensitive substring of name
  variant?: string;  // exact variant (colour)
};

interface BomSpec {
  compositeCode: string;
  components: ComponentPattern[];
}

const BOM_SPECS: BomSpec[] = [
  // ── 28CM composites (Homeware broom head + Homeware 120CM coloured handle) ─
  {
    compositeCode: "BRUSH_SOFT_28CM + HANDLE_BLUE",
    components: [
      { code: "BROOM HEAD HOMEWARE 28CM SOFT - BLUE" },
      { code: "HANDLE HOMEWARE 120CM - BLUE" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_SOFT_28CM + HANDLE_RED",
    components: [
      { code: "BROOM HEAD HOMEWARE 28CM SOFT - RED" },
      { code: "HANDLE HOMEWARE 120CM - RED" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_STIFF_28CM + HANDLE_BLUE",
    components: [
      { code: "BROOM HEAD HOMEWARE 28CM STIFF - BLUE" },
      { code: "HANDLE HOMEWARE 120CM - BLUE" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_STIFF_28CM + HANDLE_RED",
    components: [
      { code: "BROOM HEAD HOMEWARE 28CM STIFF - RED" },
      { code: "HANDLE HOMEWARE 120CM - RED" },
    ] as any,
  },

  // ── 30CM composites (alloy handle 125cm) ──────────────────────────────────
  {
    compositeCode: "BRUSH_SOFT_30CM + ALLOY_HANDLE_BLUE",
    components: [
      { nameContains: "broom head washable", nameContains2: "soft", sizeContains: "30", variant: "Blue" },
      { nameContains: "handle hygiene", variant: "Blue" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_SOFT_30CM + ALLOY_HANDLE_RED",
    components: [
      { nameContains: "broom head washable", nameContains2: "soft", sizeContains: "30", variant: "Red" },
      { nameContains: "handle hygiene", variant: "Red" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_STIFF_30CM + ALLOY_HANDLE_BLUE",
    components: [
      { nameContains: "broom head washable", nameContains2: "stiff", sizeContains: "30", variant: "Blue" },
      { nameContains: "handle hygiene", variant: "Blue" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_STIFF_30CM + ALLOY_HANDLE_RED",
    components: [
      { nameContains: "broom head washable", nameContains2: "stiff", sizeContains: "30", variant: "Red" },
      { nameContains: "handle hygiene", variant: "Red" },
    ] as any,
  },

  // ── 45CM composites (alloy handle 125cm) ──────────────────────────────────
  {
    compositeCode: "BRUSH_SOFT_45CM + ALLOY_HANDLE_BLUE",
    components: [
      { nameContains: "broom head washable", nameContains2: "soft", sizeContains: "45", variant: "Blue" },
      { nameContains: "handle hygiene", variant: "Blue" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_SOFT_45CM + ALLOY_HANDLE_RED",
    components: [
      { nameContains: "broom head washable", nameContains2: "soft", sizeContains: "45", variant: "Red" },
      { nameContains: "handle hygiene", variant: "Red" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_STIFF_45CM + ALLOY_HANDLE_BLUE",
    components: [
      { nameContains: "broom head washable", nameContains2: "stiff", sizeContains: "45", variant: "Blue" },
      { nameContains: "handle hygiene", variant: "Blue" },
    ] as any,
  },
  {
    compositeCode: "BRUSH_STIFF_45CM + ALLOY_HANDLE_RED",
    components: [
      { nameContains: "broom head washable", nameContains2: "stiff", sizeContains: "45", variant: "Red" },
      { nameContains: "handle hygiene", variant: "Red" },
    ] as any,
  },
];

// ── Helper: find a product by flexible pattern ────────────────────────────────
async function findProduct(pattern: any): Promise<{ id: string; code: string; name: string; variant: string | null } | null> {
  // Exact code match — fast path
  if (pattern.code) {
    return prisma.ibsaProduct.findUnique({
      where: { code: pattern.code },
      select: { id: true, code: true, name: true, variant: true },
    });
  }

  const all: any[] = await prisma.ibsaProduct.findMany({
    select: { id: true, code: true, name: true, variant: true },
  });

  return all.find((p: any) => {
    const nameLower = p.name.toLowerCase();
    const variantLower = (p.variant ?? "").toLowerCase();
    const codeLower = p.code.toLowerCase();

    if (pattern.nameContains && !nameLower.includes(pattern.nameContains.toLowerCase())) return false;
    if (pattern.nameContains2 && !nameLower.includes(pattern.nameContains2.toLowerCase()) && !codeLower.includes(pattern.nameContains2.toLowerCase())) return false;
    if (pattern.sizeContains && !nameLower.includes(pattern.sizeContains) && !codeLower.includes(pattern.sizeContains)) return false;
    if (pattern.variant && variantLower !== pattern.variant.toLowerCase()) return false;
    return true;
  }) ?? null;
}

async function main() {
  console.log(`\nBOM seed — ${doApply ? "APPLYING" : "dry run"}\n`);

  let linked = 0;
  let missing = 0;

  for (const spec of BOM_SPECS) {
    // Find composite product
    const composite = await prisma.ibsaProduct.findUnique({ where: { code: spec.compositeCode } });
    if (!composite) {
      console.log(`  ✗ Composite not found: ${spec.compositeCode}`);
      missing++;
      continue;
    }

    console.log(`\n▸ ${spec.compositeCode} (id=${composite.id})`);

    // Resolve all components first — only apply if ALL are found
    const resolved: Array<{ id: string; code: string; name: string; variant: string | null }> = [];
    let allFound = true;
    for (const pattern of spec.components) {
      const component = await findProduct(pattern);
      if (!component) {
        console.log(`    ✗ Component not found: ${JSON.stringify(pattern)} — skipping whole composite`);
        missing++;
        allFound = false;
      } else {
        console.log(`    → ${component.code}  (${component.name}${component.variant ? " / " + component.variant : ""})`);
        resolved.push(component);
      }
    }

    if (!allFound) continue; // skip partial BOMs

    for (const component of resolved) {
      if (doApply) {
        await prisma.ibsaProductBom.upsert({
          where: { compositeId_componentId: { compositeId: composite.id, componentId: component.id } },
          create: { compositeId: composite.id, componentId: component.id, qty: 1 },
          update: { qty: 1 },
        });
      }
      linked++;
    }
  }

  console.log(`\n── ${doApply ? "Applied" : "Would link"} ${linked} BOM line(s), ${missing} not found ──\n`);
  if (!doApply && missing === 0) {
    console.log("Re-run with --apply to save.\n");
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
