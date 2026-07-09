/**
 * Import a CS invoice into a convention's order items.
 *
 * Products must already exist in IbsaProduct (run seed-cs-products.ts first).
 * Invoices are hardcoded below — add a new entry each time.
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/import-invoice.ts INV-0238
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as unknown as {
  ibsaConvention: {
    findFirst: (a: unknown) => Promise<{ id: string; name: string } | null>;
    update: (a: unknown) => Promise<{ id: string }>;
  };
  ibsaProduct: {
    findUnique: (a: unknown) => Promise<{ id: string } | null>;
  };
  ibsaOrderItem: {
    upsert: (a: unknown) => Promise<unknown>;
  };
  $disconnect: () => Promise<void>;
};

// ── Invoice definitions ───────────────────────────────────────────────────────

interface InvoiceItem {
  code: string;
  qty: number;
}

interface Invoice {
  ref: string;
  conventionSearch: string; // exact name match (case-insensitive) — must be unique in DB
  dept: "CS" | "FA";
  invoiceDate: string;        // YYYY-MM-DD
  paymentDueDate: string;     // YYYY-MM-DD
  shippingCost: number;
  items: InvoiceItem[];
}

// Maps invoice product codes → DB product codes where they differ (e.g. CSV typos or formatting)
const CODE_ALIASES: Record<string, string> = {
  "MAINTENANCE_REFILL_PADSX20":  "MAINTENCE REFILL PADS_X20",
  "BARRIER_TAPE_NON_ADHESIVE":   "BARRIER_TAPE_NON_ADHESIVE_RED/WHITE",
};

const INVOICES: Record<string, Invoice> = {
  "INV-0238": {
    ref: "INV-0238",
    conventionSearch: "London East",
    dept: "CS",
    invoiceDate: "2026-07-06",
    paymentDueDate: "2026-08-13",
    shippingCost: 96.70,
    items: [
      { code: "GLOVES_NITRILE_BLUE_MED",    qty: 8  },
      { code: "GLOVES_NITRILE_BLUE_L",       qty: 6  },
      { code: "APRONS_FLTPACK_100PK",        qty: 6  },
      { code: "LITTER_PICKER_34INCH",        qty: 10 },
      { code: "CLOTH_MFIBRE_BLUE_10PK",      qty: 30 },
      { code: "CLOTH_MFIBRE_YELLOW_10PK",    qty: 10 },
      { code: "CENTRE_FEED_ST_BLUE_6PK",     qty: 2  },
      { code: "REFUSE_SACK_CLEAR_100PK",     qty: 5  },
      { code: "BIO_HAZARD_KITS",             qty: 6  },
      { code: "MAINTENANCE_REFILL_PADSX20",  qty: 3  },
    ],
  },

  "INV-0237": {
    ref: "INV-0237",
    conventionSearch: "Telford",
    dept: "CS",
    invoiceDate: "2026-07-06",
    paymentDueDate: "2026-08-13",
    shippingCost: 307.41, // 3 pallets × £102.47
    items: [
      { code: "HI_VIS_YELLOW_BS_M",           qty: 30 },
      { code: "HI_VIS_YELLOW_BS_L",           qty: 20 },
      { code: "HI_VIS_YELLOW_BS_XL",          qty: 10 },
      { code: "HI_VIS_BLUE_S",                qty: 10 },
      { code: "HI_VIS_BLUE_M",                qty: 12 },
      { code: "HI_VIS_BLUE_L",                qty: 14 },
      { code: "HI_VIS_BLUE_XL",               qty: 1  },
      { code: "HI_VIS_BLUE_XXL",              qty: 3  },
      { code: "HI_VIS_YELLOW_S_FA",           qty: 5  },
      { code: "HI_VIS_YELLOW_M_FA",           qty: 5  },
      { code: "HI_VIS_YELLOW_L_FA",           qty: 5  },
      { code: "HI_VIS_YELLOW_XL_FA",          qty: 8  },
      { code: "HI_VIS_ORANGE_LS_S",           qty: 10 },
      { code: "HI_VIS_ORANGE_LS_M",           qty: 15 },
      { code: "HI_VIS_ORANGE_LS_L",           qty: 10 },
      { code: "GLOVES_VINYL_CLEAR_SML",       qty: 1  },
      { code: "GLOVES_VINYL_CLEAR_MED",       qty: 52 },
      { code: "GLOVES_VINYL_CLEAR_L",         qty: 52 },
      { code: "GLOVES_VINYL_CLEAR_XL",        qty: 51 },
      { code: "GLOVES_NITRILE_BLUE_MED",      qty: 5  },
      { code: "GLOVES_NITRILE_BLUE_L",        qty: 5  },
      { code: "EYEWEAR_SAFETY_GLASSES_CLEAR", qty: 10 },
      { code: "APRONS_FLTPACK_100PK",         qty: 20 },
      { code: "BUCKET_PLASTIC_10L_RED",       qty: 4  },
      { code: "BUCKET_PLASTIC_10L_GREEN",     qty: 3  },
      { code: "BUCKET_PLASTIC_10L_BLUE",      qty: 3  },
      { code: "MOP_DISP_RED_10PK",            qty: 1  },
      { code: "MOP_DISP_GREEN_10PK",          qty: 1  },
      { code: "MOP_DISP_BLUE_10PK",           qty: 1  },
      { code: "HNDL_WOODEN_1",               qty: 11 },
      { code: "DUSTPAN_BRUSH_SET_RED",        qty: 2  },
      { code: "DUSTPAN_BRUSH_SET_GREEN",      qty: 2  },
      { code: "LITTER_PICKER_34INCH",         qty: 2  },
      { code: "WET_FLOOR_AFRAME",             qty: 5  },
      { code: "TOILET_BRUSH_HOLDER_WHITE",    qty: 90 },
      { code: "TRG_COMPLETE_RED",             qty: 15 },
      { code: "TRG_COMPLETE_BLUE",            qty: 35 },
      { code: "CLOTH_OCEAN_RED_50PK",         qty: 10 },
      { code: "CLOTH_OCEAN_GREEN_50PK",       qty: 2  },
      { code: "CLOTH_OCEAN_BLUE_50PK",        qty: 10 },
      { code: "CLOTH_MFIBRE_BLUE_10PK",       qty: 2  },
      { code: "CLOTH_MFIBRE_PINK_10PK",       qty: 4  },
      { code: "CLOTH_MFIBRE_GREEN_10PK",      qty: 2  },
      { code: "CENTRE_FEED_ST_BLUE_6PK",      qty: 50 },
      { code: "REFUSE_SACK_BLACK_100PK",      qty: 20 },
      { code: "BARRIER_TAPE_NON_ADHESIVE",    qty: 3  },
      { code: "CLOVER_AHS_300ML",             qty: 19 },
      { code: "SPILL_KITS_MAINTENANCE_10L",   qty: 5  },
    ],
  },

  // Add future invoices here as:
  // "INV-XXXX": { ... }
};

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  const invoiceRef = process.argv[2];
  if (!invoiceRef) {
    console.error(`Usage: npx tsx scripts/import-invoice.ts <INVOICE-REF>`);
    console.error(`Available: ${Object.keys(INVOICES).join(", ")}`);
    process.exit(1);
  }

  const inv = INVOICES[invoiceRef];
  if (!inv) {
    console.error(`Unknown invoice "${invoiceRef}". Available: ${Object.keys(INVOICES).join(", ")}`);
    process.exit(1);
  }

  // Find convention — exact name match (case-insensitive)
  const convention = await prisma.ibsaConvention.findFirst({
    where: {
      name: { equals: inv.conventionSearch, mode: "insensitive" } as never,
    },
  } as never);

  if (!convention) {
    console.error(`No convention found matching "${inv.conventionSearch}"`);
    process.exit(1);
  }

  console.log(`\n✓ Convention: "${convention.name}" (${convention.id})`);
  console.log(`  Invoice: ${inv.ref}`);
  console.log(`  Dept: ${inv.dept}`);
  console.log(`  Payment due: ${inv.paymentDueDate}`);
  console.log(`  Shipping: £${inv.shippingCost.toFixed(2)}\n`);

  // Write logistics if CS (shipping cost + payment due date on the CS side)
  if (inv.dept === "CS") {
    await prisma.ibsaConvention.update({
      where: { id: convention.id },
      data: {
        shippingCost: inv.shippingCost,
        paymentDueDate: new Date(inv.paymentDueDate),
      },
    } as never);
    console.log("  ✓ CS logistics updated (shippingCost, paymentDueDate)");
  } else {
    await prisma.ibsaConvention.update({
      where: { id: convention.id },
      data: {
        faShippingCost: inv.shippingCost,
        faPaymentDueDate: new Date(inv.paymentDueDate),
      },
    } as never);
    console.log("  ✓ FA logistics updated (faShippingCost, faPaymentDueDate)");
  }

  // Import order items
  let imported = 0;
  let skipped = 0;

  for (const item of inv.items) {
    const dbCode = CODE_ALIASES[item.code] ?? item.code;
    const product = await prisma.ibsaProduct.findUnique({
      where: { code: dbCode },
    } as never) as { id: string } | null;

    if (!product) {
      console.warn(`  ✗ Product not found: ${item.code}${dbCode !== item.code ? ` (alias: ${dbCode})` : ""} — run seed-cs-products.ts first`);
      skipped++;
      continue;
    }

    await prisma.ibsaOrderItem.upsert({
      where: {
        conventionId_productId: {
          conventionId: convention.id,
          productId: product.id,
        },
      },
      create: { conventionId: convention.id, productId: product.id, qty: item.qty },
      update: { qty: item.qty },
    } as never);

    console.log(`  ✓ ${item.code} × ${item.qty}`);
    imported++;
  }

  console.log(`\nDone. ${imported} items imported, ${skipped} skipped.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
