/**
 * Creates the 5 missing component products for the 28CM brush+handle composites:
 *   - Broom Head Homeware 28CM Soft  (Blue + Red)
 *   - Broom Head Homeware 28CM Stiff (Blue + Red)
 *   - Handle Homeware 120CM          (no colour variant — shared by all 4 composites)
 *
 * Also creates the RS product catalog links for each.
 *
 * Run from ~/sendforge:
 *   export $(grep DATABASE_URL .env | tr -d '"')
 *   npx tsx scripts/add-28cm-components.ts          # dry run
 *   npx tsx scripts/add-28cm-components.ts --apply  # create products + links
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

const doApply = process.argv.includes("--apply");

// ── Products to create ────────────────────────────────────────────────────────
// xyloCost = carton price ÷ carton size (unit cost to Xylo)
// unitCost = same as placeholder (no known IBSA sale price for components)

const BROOM_SOFT_RS  = { rsCode: "104956", rsDescription: "Broom Head Homeware Soft Eco", cartonSize: 12, cartonPrice: 18.24 };
const BROOM_STIFF_RS = { rsCode: "104955", rsDescription: "Broom Head Homeware Stiff Eco", cartonSize: 12, cartonPrice: 18.24 };
const HANDLE_RS      = { rsCode: "102855", rsDescription: "Handle Homeware Standard 120CM", cartonSize: 24, cartonPrice: 18.70 };

const broomXyloCost   = +(18.24 / 12).toFixed(4); // £1.52
const handleXyloCost  = +(18.70 / 24).toFixed(4); // £0.7792

interface NewProduct {
  code: string;
  name: string;
  variant: string | null;
  category: string;
  type: string;
  unitCost: number;
  xyloCost: number;
  rsLink: { rsCode: string; rsDescription: string; rsVariant?: string; cartonSize: number; cartonPrice: number };
}

const PRODUCTS: NewProduct[] = [
  {
    code: "BROOM HEAD HOMEWARE 28CM SOFT - BLUE",
    name: "Broom Head Homeware 28cm Soft",
    variant: "Blue",
    category: "janitorial",
    type: "CS",
    unitCost: broomXyloCost,
    xyloCost: broomXyloCost,
    rsLink: { ...BROOM_SOFT_RS, rsVariant: "BLUE" },
  },
  {
    code: "BROOM HEAD HOMEWARE 28CM SOFT - RED",
    name: "Broom Head Homeware 28cm Soft",
    variant: "Red",
    category: "janitorial",
    type: "CS",
    unitCost: broomXyloCost,
    xyloCost: broomXyloCost,
    rsLink: { ...BROOM_SOFT_RS, rsVariant: "RED" },
  },
  {
    code: "BROOM HEAD HOMEWARE 28CM STIFF - BLUE",
    name: "Broom Head Homeware 28cm Stiff",
    variant: "Blue",
    category: "janitorial",
    type: "CS",
    unitCost: broomXyloCost,
    xyloCost: broomXyloCost,
    rsLink: { ...BROOM_STIFF_RS, rsVariant: "BLUE" },
  },
  {
    code: "BROOM HEAD HOMEWARE 28CM STIFF - RED",
    name: "Broom Head Homeware 28cm Stiff",
    variant: "Red",
    category: "janitorial",
    type: "CS",
    unitCost: broomXyloCost,
    xyloCost: broomXyloCost,
    rsLink: { ...BROOM_STIFF_RS, rsVariant: "RED" },
  },
  {
    code: "HANDLE HOMEWARE 120CM - BLUE",
    name: "Handle Homeware 120cm",
    variant: "Blue",
    category: "janitorial",
    type: "CS",
    unitCost: handleXyloCost,
    xyloCost: handleXyloCost,
    rsLink: { ...HANDLE_RS, rsVariant: "BLUE" },
  },
  {
    code: "HANDLE HOMEWARE 120CM - RED",
    name: "Handle Homeware 120cm",
    variant: "Red",
    category: "janitorial",
    type: "CS",
    unitCost: handleXyloCost,
    xyloCost: handleXyloCost,
    rsLink: { ...HANDLE_RS, rsVariant: "RED" },
  },
];

async function main() {
  console.log(`\nAdd 28CM components — ${doApply ? "APPLYING" : "dry run"}\n`);

  for (const p of PRODUCTS) {
    const existing = await prisma.ibsaProduct.findUnique({ where: { code: p.code } });

    if (existing) {
      console.log(`  ↷ Already exists: ${p.code}`);
      continue;
    }

    console.log(`  + ${p.code}  (${p.name}${p.variant ? " / " + p.variant : ""})  xyloCost=£${p.xyloCost.toFixed(4)}`);
    console.log(`    RS: ${p.rsLink.rsCode} — ${p.rsLink.rsDescription}${p.rsLink.rsVariant ? " / " + p.rsLink.rsVariant : ""}  carton=${p.rsLink.cartonSize} @ £${p.rsLink.cartonPrice}`);

    if (doApply) {
      const created = await prisma.ibsaProduct.create({
        data: {
          code:     p.code,
          name:     p.name,
          variant:  p.variant,
          category: p.category,
          type:     p.type,
          unitCost: p.unitCost,
          xyloCost: p.xyloCost,
          inStock:  0,
          git:      0,
        },
      });

      await prisma.rsProduct.create({
        data: {
          ibsaProductId: created.id,
          supplier:      "Robert Scott",
          rsCode:        p.rsLink.rsCode,
          rsVariant:     p.rsLink.rsVariant ?? null,
          rsDescription: p.rsLink.rsDescription,
          cartonSize:    p.rsLink.cartonSize,
          cartonPrice:   p.rsLink.cartonPrice,
        },
      });

      console.log(`    ✓ Created (id=${created.id})`);
    }
  }

  console.log(doApply ? "\n✓ Done.\n" : "\nRe-run with --apply to create.\n");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
