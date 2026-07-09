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
    findUnique: (a: unknown) => Promise<{ id: string; type: string } | null>;
    create: (a: unknown) => Promise<{ id: string; type: string }>;
  };
  ibsaOrderItem: {
    upsert: (a: unknown) => Promise<unknown>;
    updateMany: (a: unknown) => Promise<{ count: number }>;
  };
  $disconnect: () => Promise<void>;
};

// ── Invoice definitions ───────────────────────────────────────────────────────

interface InvoiceItem {
  code: string;
  qty: number;
  unitCost?: number; // FA invoices: used to create the product if it doesn't exist yet
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
  "MAINTENANCE_REFILL_PADSX20":        "MAINTENCE REFILL PADS_X20",
  "BARRIER_TAPE_NON_ADHESIVE":         "BARRIER_TAPE_NON_ADHESIVE_RED/WHITE",
  // Maintenance pads — two invoice spellings, one DB code
  "MAINTENANCE_REFILL_PADS_X20":       "MAINTENCE REFILL PADS_X20",
  // Bodyform — invoice typo (HYGEINE vs HYGIENE)
  "BODYFORM_HYGEINE_PADS_12PACK":      "BODYFORM_HYGIENE_PADS_12PACK",
  // Invoice strips spaces around +
  "BRUSH_SOFT_28CM+HANDLE_RED":        "BRUSH_SOFT_28CM + HANDLE_RED",
  "BRUSH_SOFT_28CM+HANDLE_BLUE":       "BRUSH_SOFT_28CM + HANDLE_BLUE",
  // Invoice strips spaces from space-delimited codes
  "BROOMHEADWASHABLE30CMSOFT-BLUE":    "BROOM HEAD WASHABLE 30CM SOFT - BLUE",
  "BROOMHEADWASHABLE30CMSOFT-RED":     "BROOM HEAD WASHABLE 30CM SOFT - RED",
  "BROOMHEADWASHABLE45CMSOFT-BLUE":    "BROOM HEAD WASHABLE 45CM SOFT - BLUE",
  "BROOMHEADWASHABLE45CMSOFT-RED":     "BROOM HEAD WASHABLE 45CM SOFT - RED",
  "HANDLEHYGIENE125CM-BLUE":           "HANDLE HYGIENE 125CM - BLUE",
  "HANDLEHYGIENE125CM-RED":            "HANDLE HYGIENE 125CM - RED",
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

  "INV-0236": {
    ref: "INV-0236",
    conventionSearch: "London Wembley",
    dept: "CS",
    invoiceDate: "2026-07-06",
    paymentDueDate: "2026-07-08",
    shippingCost: 99.35,
    items: [
      { code: "HI_VIS_PINK_M",                              qty: 25 },
      { code: "HI_VIS_PINK_L",                              qty: 35 },
      { code: "HI_VIS_PINK_XL",                             qty: 15 },
      { code: "GLOVES_NITRILE_BLUE_SML",                    qty: 5  },
      { code: "GLOVES_NITRILE_BLUE_MED",                    qty: 15 },
      { code: "GLOVES_NITRILE_BLUE_L",                      qty: 10 },
      { code: "GLOVES_NITRILE_BLUE_XL",                     qty: 4  },
      { code: "MOP_DISP_RED_10PK",                          qty: 4  },
      { code: "MOP_DISP_BLUE_10PK",                         qty: 4  },
      { code: "HNDL_WOODEN_1",                              qty: 8  },
      { code: "SQUEEGEE_PLASTIC_55CM",                      qty: 3  },
      { code: "HNDL_SQUEEGEE_PLASTIC",                      qty: 3  },
      { code: "LOBBY_BRUSH_LONGHNDL_COMPLETE_SET_BLACK",    qty: 2  },
      { code: "LOBBY_BRUSH_LONGHNDL_COMPLETE_SET_RED",      qty: 2  },
      { code: "LOBBY_BRUSH_LONGHNDL_COMPLETE_SET_BLUE",     qty: 2  },
      { code: "BROOMHEADWASHABLE30CMSOFT-BLUE",             qty: 4  },
      { code: "BROOMHEADWASHABLE30CMSOFT-RED",              qty: 4  },
      { code: "BROOMHEADWASHABLE45CMSOFT-BLUE",             qty: 3  },
      { code: "BROOMHEADWASHABLE45CMSOFT-RED",              qty: 3  },
      { code: "HANDLEHYGIENE125CM-BLUE",                    qty: 7  },
      { code: "HANDLEHYGIENE125CM-RED",                     qty: 7  },
      { code: "DUSTPAN_BRUSH_SET_RED",                      qty: 6  },
      { code: "DUSTPAN_BRUSH_SET_BLUE",                     qty: 6  },
      { code: "LITTER_PICKER_34INCH",                       qty: 4  },
      { code: "WET_FLOOR_AFRAME",                           qty: 10 },
      { code: "TRG_COMPLETE_RED",                           qty: 15 },
      { code: "TRG_COMPLETE_GREEN",                         qty: 10 },
      { code: "CLOTH_OCEAN_RED_50PK",                       qty: 15 },
      { code: "CLOTH_OCEAN_GREEN_50PK",                     qty: 15 },
      { code: "CLOTH_OCEAN_BLUE_50PK",                      qty: 15 },
      { code: "CLOTH_MFIBRE_BLUE_10PK",                     qty: 5  },
      { code: "CENTRE_FEED_BLUE_DL_6PK",                    qty: 5  },
      { code: "REFUSE_SACK_BLACK_100PK",                    qty: 1  },
      { code: "IMPACT_LIQUIDS_MULTI_PURPOSE_5L",            qty: 2  },
      { code: "CLOVER_ULTRAFRESH_5L",                       qty: 3  },
      { code: "PUMP_30CC_FOR_5L",                           qty: 3  },
    ],
  },

  "INV-0228": {
    ref: "INV-0228",
    conventionSearch: "London Twickenham",
    dept: "CS",
    invoiceDate: "2026-07-02",
    paymentDueDate: "2026-08-05",
    shippingCost: 96.70,
    items: [
      { code: "GLOVES_NITRILE_BLUE_MED",       qty: 4  },
      { code: "GLOVES_NITRILE_BLUE_L",          qty: 4  },
      { code: "GLOVES_NITRILE_BLUE_XL",         qty: 3  },
      { code: "APRONS_FLTPACK_100PK",           qty: 5  },
      { code: "BUCKET_PLASTIC_10L_BLUE",        qty: 20 },
      { code: "SQUEEGEE_METAL_55CM",            qty: 2  },
      { code: "HNDL_WOODEN_2",                  qty: 2  },
      { code: "BRUSH_SOFT_28CM+HANDLE_RED",     qty: 8  },
      { code: "TRG_COMPLETE_GREEN",             qty: 10 },
      { code: "TRG_COMPLETE_BLUE",              qty: 10 },
      { code: "CLOTH_MFIBRE_BLUE_10PK",         qty: 5  },
      { code: "CLOTH_MFIBRE_PINK_10PK",         qty: 5  },
      { code: "CLOTH_MFIBRE_WHITE_10PK",        qty: 5  },
      { code: "CENTRE_FEED_ST_BLUE_6PK",        qty: 10 },
      { code: "REFUSE_SACK_CLEAR_100PK",        qty: 1  },
      { code: "BIO_HAZARD_KITS",               qty: 10 },
      { code: "MAINTENANCE_REFILL_PADS_X20",    qty: 3  },
      { code: "SPILL_KITS_MAINTENANCE_10L",     qty: 8  },
    ],
  },

  "INV-0232": {
    ref: "INV-0232",
    conventionSearch: "Bournemouth",
    dept: "CS",
    invoiceDate: "2026-07-02",
    paymentDueDate: "2026-07-29",
    shippingCost: 96.70,
    items: [
      { code: "HI_VIS_BLUE_M",               qty: 10 },
      { code: "HI_VIS_RED_M",                qty: 10 },
      { code: "HI_VIS_RED_L",                qty: 10 },
      { code: "HI_VIS_RED/GREY_EXEC_M",      qty: 5  },
      { code: "HI_VIS_RED/GREY_EXEC_L",      qty: 5  },
      { code: "GLOVES_NITRILE_BLUE_SML",     qty: 1  },
      { code: "GLOVES_NITRILE_BLUE_MED",     qty: 2  },
      { code: "GLOVES_NITRILE_BLUE_L",       qty: 2  },
      { code: "GLOVES_NITRILE_BLUE_XL",      qty: 1  },
      { code: "APRONS_FLTPACK_100PK",        qty: 1  },
      { code: "BUCKET_OVAL_MOP_14L_RED",     qty: 1  },
      { code: "MOP_DISP_RED_10PK",           qty: 1  },
      { code: "HNDL_WOODEN_1",               qty: 2  },
      { code: "SQUEEGEE_PLASTIC_55CM",       qty: 1  },
      { code: "HNDL_SQUEEGEE_PLASTIC",       qty: 1  },
      { code: "LITTER_PICKER_34INCH",        qty: 2  },
      { code: "TRG_COMPLETE_GREEN",          qty: 1  },
      { code: "CLOTH_OCEAN_RED_50PK",        qty: 1  },
      { code: "CLOTH_OCEAN_BLUE_50PK",       qty: 1  },
      { code: "CLOTH_MFIBRE_BLUE_10PK",      qty: 3  },
      { code: "CLOTH_MFIBRE_PINK_10PK",      qty: 2  },
      { code: "CENTRE_FEED_BLUE_DL_6PK",     qty: 2  },
      { code: "CLOVER_ULTRAFRESH_1L",        qty: 1  },
      { code: "CLOVER_ULTRAFRESH_5L",        qty: 1  },
      { code: "CLOVER_HAND_SOAP_1L",         qty: 1  },
    ],
  },

  "INV-0231": {
    ref: "INV-0231",
    conventionSearch: "Bournemouth",
    dept: "FA",
    invoiceDate: "2026-07-02",
    paymentDueDate: "2026-07-29",
    shippingCost: 0,
    items: [
      { code: "FIRSTAID_KIT_LARGE_188P",              qty: 3,  unitCost: 42.89 },
      { code: "10PACK_LARGE_FOIL_BLANKETS",           qty: 6,  unitCost: 4.89  },
      { code: "100PACK_ASSORTED_WATERPROOF_PLASTERS", qty: 1,  unitCost: 4.79  },
      { code: "MEDIPAL_AW_125P",                      qty: 2,  unitCost: 4.29  },
      { code: "EYEWASH_INCCAP_500ML",                 qty: 1,  unitCost: 2.99  },
      { code: "BODYFORM_HYGEINE_PADS_12PACK",         qty: 2,  unitCost: 1.99  },
      { code: "GLOVES_NITRILE_BLUE_SML",              qty: 2  },
      { code: "GLOVES_NITRILE_BLUE_XL",               qty: 2  },
      { code: "BIO_HAZARD_KITS",                      qty: 1  },
    ],
  },

  "INV-0214": {
    ref: "INV-0214",
    conventionSearch: "Norfolk",
    dept: "CS",
    invoiceDate: "2026-06-25",
    paymentDueDate: "2026-07-29",
    shippingCost: 82.15,
    items: [
      { code: "GLOVES_NITRILE_BLUE_SML",                  qty: 2  },
      { code: "GLOVES_NITRILE_BLUE_MED",                  qty: 6  },
      { code: "GLOVES_NITRILE_BLUE_L",                    qty: 7  },
      { code: "GLOVES_NITRILE_BLUE_XL",                   qty: 1  },
      { code: "APRONS_FLTPACK_100PK",                     qty: 6  },
      { code: "BUCKET_PLASTIC_10L_RED",                   qty: 4  },
      { code: "BUCKET_PLASTIC_10L_GREEN",                 qty: 4  },
      { code: "BUCKET_PLASTIC_10L_BLUE",                  qty: 4  },
      { code: "MOP_STAND_PY(12)_7OZ_BLUE",               qty: 30 },
      { code: "LOBBY_BRUSH_LONGHNDL_COMPLETE_SET_BLACK",  qty: 4  },
      { code: "BRUSH_SOFT_45CM + ALLOY_HANDLE_RED",       qty: 6  },
      { code: "DUSTPAN_BRUSH_SET_RED",                    qty: 5  },
      { code: "DUSTPAN_BRUSH_SET_BLUE",                   qty: 5  },
      { code: "WET_FLOOR_AFRAME",                         qty: 4  },
      { code: "TOILET_BRUSH_HOLDER_WHITE",                qty: 8  },
      { code: "CLOTH_OCEAN_RED_50PK",                     qty: 32 },
      { code: "CLOTH_OCEAN_GREEN_50PK",                   qty: 8  },
      { code: "CLOTH_OCEAN_BLUE_50PK",                    qty: 10 },
      { code: "CENTRE_FEED_ST_BLUE_6PK",                  qty: 2  },
      { code: "REFUSE_SACK_BLACK_100PK",                  qty: 2  },
      { code: "BARRIER_TAPE_NON_ADHESIVE",               qty: 1  },
      { code: "CLOVER_ULTRAFRESH_5L",                    qty: 6  },
      { code: "BIO_HAZARD_KITS",                         qty: 6  },
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
    let product = await prisma.ibsaProduct.findUnique({
      where: { code: dbCode },
    } as never) as { id: string; type: string } | null;

    if (!product) {
      if (inv.dept === "FA" && item.unitCost !== undefined) {
        // Auto-create FA products from invoice price
        const name = dbCode.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        product = await prisma.ibsaProduct.create({
          data: { code: dbCode, name, category: "firstaid", type: "FA", unitCost: item.unitCost },
        } as never) as { id: string; type: string };
        console.log(`  + Created FA product: ${dbCode}`);
      } else {
        console.warn(`  ✗ Product not found: ${item.code}${dbCode !== item.code ? ` (alias: ${dbCode})` : ""} — run seed-cs-products.ts first`);
        skipped++;
        continue;
      }
    }

    await prisma.ibsaOrderItem.upsert({
      where: {
        conventionId_productId_dept: {
          conventionId: convention.id,
          productId: product.id,
          dept: inv.dept,
        },
      },
      create: { conventionId: convention.id, productId: product.id, dept: inv.dept, qty: item.qty },
      update: { qty: item.qty },
    } as never);

    console.log(`  ✓ ${item.code} × ${item.qty}`);
    imported++;
  }

  console.log(`\nDone. ${imported} items imported, ${skipped} skipped.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
