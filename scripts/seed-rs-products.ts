/**
 * Seeds the RsProduct table from the RC Master Order Form data.
 * Each row maps a Robert Scott catalog line to a Xylo (IbsaProduct) product code.
 * A single Xylo product can have multiple RS rows (e.g. brush head + handle sold separately).
 *
 * Usage (from the repo root):
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/seed-rs-products.ts
 *
 * Safe to run multiple times — uses upsert on (rsCode, rsVariant, ibsaProductId).
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as never) as any;

// ── Source data from RC Master Order Form 2026 ───────────────────────────────
// xyloCode = IbsaProduct.code in the database
const rows: {
  rsCode: string;
  rsVariant: string | null;
  rsDescription: string;
  cartonSize: number;
  cartonPrice: number;
  xyloCode: string;
}[] = [
  // ── Broom heads (washable, colour-coded) ───────────────────────────────
  { rsCode: "104947", rsVariant: "BLUE", rsDescription: "Broom Head Washable Col Stock 30cm Soft RS",  cartonSize: 10, cartonPrice: 31.90, xyloCode: "BROOM HEAD WASHABLE 30CM SOFT - BLUE" },
  { rsCode: "104947", rsVariant: "RED",  rsDescription: "Broom Head Washable Col Stock 30cm Soft RS",  cartonSize: 10, cartonPrice: 31.90, xyloCode: "BROOM HEAD WASHABLE 30CM SOFT - RED"  },
  { rsCode: "104948", rsVariant: "BLUE", rsDescription: "Broom Head Washable Col Stock 30cm Stiff RS", cartonSize: 10, cartonPrice: 31.90, xyloCode: "BROOM HEAD WASHABLE 30CM STIFF - BLUE" },
  { rsCode: "104949", rsVariant: "BLUE", rsDescription: "Broom Head Washable Col Stock 45cm Soft RS",  cartonSize: 5,  cartonPrice: 31.90, xyloCode: "BROOM HEAD WASHABLE 45CM SOFT - BLUE"  },
  { rsCode: "104949", rsVariant: "RED",  rsDescription: "Broom Head Washable Col Stock 45cm Soft RS",  cartonSize: 5,  cartonPrice: 31.90, xyloCode: "BROOM HEAD WASHABLE 45CM SOFT - RED"   },

  // ── Homeware brushes + handles (sold as separate RS lines, combined Xylo product) ──
  { rsCode: "104956", rsVariant: "BLUE", rsDescription: "Broom Head Homeware Soft Eco",        cartonSize: 12, cartonPrice: 18.24, xyloCode: "BRUSH_SOFT_28CM + HANDLE_BLUE" },
  { rsCode: "102855", rsVariant: "BLUE", rsDescription: "Handle Homeware Standard 120cm",      cartonSize: 24, cartonPrice: 18.70, xyloCode: "BRUSH_SOFT_28CM + HANDLE_BLUE" },
  { rsCode: "104956", rsVariant: "RED",  rsDescription: "Broom Head Homeware Soft Eco",        cartonSize: 12, cartonPrice: 18.24, xyloCode: "BRUSH_SOFT_28CM + HANDLE_RED"  },
  { rsCode: "102855", rsVariant: "RED",  rsDescription: "Handle Homeware Standard 120cm",      cartonSize: 24, cartonPrice: 18.70, xyloCode: "BRUSH_SOFT_28CM + HANDLE_RED"  },
  { rsCode: "104955", rsVariant: "BLUE", rsDescription: "Broom Head Homeware Stiff Eco",       cartonSize: 12, cartonPrice: 18.24, xyloCode: "BRUSH_STIFF_28CM + HANDLE_BLUE" },
  { rsCode: "102855", rsVariant: "BLUE", rsDescription: "Handle Homeware Standard 120cm",      cartonSize: 24, cartonPrice: 18.70, xyloCode: "BRUSH_STIFF_28CM + HANDLE_BLUE" },

  // ── Buckets ────────────────────────────────────────────────────────────
  { rsCode: "104888", rsVariant: null,   rsDescription: "Bucket Great British Recycled With Colour Wringer 14l", cartonSize: 10, cartonPrice: 29.91, xyloCode: "BUCKET_OVAL_MOP_14L_RED"  },
  { rsCode: "102834", rsVariant: "RED",  rsDescription: "Bucket Homeware 10l",                                    cartonSize: 30, cartonPrice: 48.00, xyloCode: "BUCKET_PLASTIC_10L_RED"   },
  { rsCode: "101253", rsVariant: "RED",  rsDescription: "Bucket Buffalo & Wringer 25l",                           cartonSize: 1,  cartonPrice: 40.15, xyloCode: "KTY Buffalo Bucket & Wringer 25L - Red" },

  // ── Microfibre cloths ──────────────────────────────────────────────────
  { rsCode: "101137", rsVariant: "BLUE", rsDescription: "Microfibre Cloth Contract 40x40cm RS Ins", cartonSize: 20, cartonPrice: 56.10, xyloCode: "CLOTH_MFIBRE_BLUE_10PK" },
  { rsCode: "101137", rsVariant: "PINK", rsDescription: "Microfibre Cloth Contract 40x40cm RS Ins", cartonSize: 20, cartonPrice: 56.10, xyloCode: "CLOTH_MFIBRE_PINK_10PK" },

  // ── Ocean wipes ────────────────────────────────────────────────────────
  { rsCode: "100233", rsVariant: "BLUE",  rsDescription: "Wipe Ocean 50x36cm RS", cartonSize: 10, cartonPrice: 27.50, xyloCode: "CLOTH_OCEAN_BLUE_50PK"  },
  { rsCode: "100233", rsVariant: "GREEN", rsDescription: "Wipe Ocean 50x36cm RS", cartonSize: 10, cartonPrice: 27.50, xyloCode: "CLOTH_OCEAN_GREEN_50PK" },
  { rsCode: "100233", rsVariant: "RED",   rsDescription: "Wipe Ocean 50x36cm RS", cartonSize: 10, cartonPrice: 27.50, xyloCode: "CLOTH_OCEAN_RED_50PK"   },

  // ── Dustpans & brushes ─────────────────────────────────────────────────
  { rsCode: "102940", rsVariant: "BLUE",  rsDescription: "Dustpan & Brush Professional Soft", cartonSize: 12, cartonPrice: 16.50, xyloCode: "DUSTPAN_BRUSH_SET_BLUE"  },
  { rsCode: "102940", rsVariant: "GREEN", rsDescription: "Dustpan & Brush Professional Soft", cartonSize: 12, cartonPrice: 16.50, xyloCode: "DUSTPAN_BRUSH_SET_GREEN" },
  { rsCode: "102940", rsVariant: "RED",   rsDescription: "Dustpan & Brush Professional Soft", cartonSize: 12, cartonPrice: 16.50, xyloCode: "DUSTPAN_BRUSH_SET_RED"   },

  // ── Hygiene handles ────────────────────────────────────────────────────
  { rsCode: "103132", rsVariant: "BLUE", rsDescription: "Handle Hygiene 125cm", cartonSize: 20, cartonPrice: 48.50, xyloCode: "HANDLE HYGIENE 125CM - BLUE" },
  { rsCode: "103132", rsVariant: "RED",  rsDescription: "Handle Hygiene 125cm", cartonSize: 20, cartonPrice: 48.50, xyloCode: "HANDLE HYGIENE 125CM - RED"  },
  { rsCode: "103131", rsVariant: "BLUE", rsDescription: "Handle Hygiene 137cm", cartonSize: 20, cartonPrice: 54.98, xyloCode: "HANDLE HYGIENE 137CM - BLUE" },
  { rsCode: "103132", rsVariant: "RED",  rsDescription: "Handle Hygiene 125cm", cartonSize: 20, cartonPrice: 48.50, xyloCode: "HNDL_SQUEEGEE_PLASTIC"        },

  // ── Wooden handles ─────────────────────────────────────────────────────
  { rsCode: "101836", rsVariant: null, rsDescription: "Handle Wooden 0.9\"x47\" FSC 100% NQA-COC-005319", cartonSize: 25, cartonPrice: 35.00, xyloCode: "HNDL_WOODEN"   },
  { rsCode: "101836", rsVariant: null, rsDescription: "Handle Wooden 0.9\"x47\" FSC 100% NQA-COC-005319", cartonSize: 25, cartonPrice: 35.00, xyloCode: "HNDL_WOODEN_1" },
  { rsCode: "101836", rsVariant: null, rsDescription: "Handle Wooden 0.9\"x47\" FSC 100% NQA-COC-005319", cartonSize: 25, cartonPrice: 35.00, xyloCode: "HNDL_WOODEN_2" },

  // ── Kentucky mop fittings & mops ───────────────────────────────────────
  { rsCode: "100988", rsVariant: null,   rsDescription: "KTY Mop Fitting Plastic",                  cartonSize: 5,   cartonPrice: 6.73,  xyloCode: "KTY MOP FITTING PLASTIC - BLUE" },
  { rsCode: "100988", rsVariant: "RED",  rsDescription: "KTY Mop Fitting Plastic",                  cartonSize: 5,   cartonPrice: 6.73,  xyloCode: "KTY MOP FITTING PLASTIC - RED"  },
  { rsCode: "103056", rsVariant: "BLUE", rsDescription: "KTY Mop Hygiemix S/Back Col S/Flat 450g PB", cartonSize: 1,  cartonPrice: 31.07, xyloCode: "KTY MOP HYGIEMIX S/BACK COL S/FLAT 450G PB (10 PACK) - BLUE" },
  { rsCode: "103056", rsVariant: "RED",  rsDescription: "KTY Mop Hygiemix S/Back Col S/Flat 450g PB", cartonSize: 1,  cartonPrice: 31.07, xyloCode: "KTY MOP HYGIEMIX S/BACK COL S/FLAT 450G PB (10 PACK) - RED"  },
  { rsCode: "100951", rsVariant: null,   rsDescription: "Multi-Yarn Kentucky Mop Flag 450g",         cartonSize: 40,  cartonPrice: 57.20, xyloCode: "KTY MOP MULTI FLAG 450G" },

  // ── Lobby brushes ──────────────────────────────────────────────────────
  { rsCode: "101051", rsVariant: "BLACK", rsDescription: "Lobby Dustpan & Brush Contract", cartonSize: 10, cartonPrice: 68.50, xyloCode: "LOBBY_BRUSH_LONGHNDL_COMPLETE_SET_BLACK" },
  { rsCode: "101051", rsVariant: "BLUE",  rsDescription: "Lobby Dustpan & Brush Contract", cartonSize: 10, cartonPrice: 68.50, xyloCode: "LOBBY_BRUSH_LONGHNDL_COMPLETE_SET_BLUE"  },
  { rsCode: "101051", rsVariant: "RED",   rsDescription: "Lobby Dustpan & Brush Contract", cartonSize: 10, cartonPrice: 68.50, xyloCode: "LOBBY_BRUSH_LONGHNDL_COMPLETE_SET_RED"   },

  // ── Disposable mops ────────────────────────────────────────────────────
  { rsCode: "102199", rsVariant: "BLUE", rsDescription: "Big White Refill Mop",    cartonSize: 6,   cartonPrice: 39.17, xyloCode: "MOP_DISP_BLUE_10PK"         },
  { rsCode: "102199", rsVariant: "RED",  rsDescription: "Big White Refill Mop",    cartonSize: 6,   cartonPrice: 39.17, xyloCode: "MOP_DISP_RED_10PK"          },
  { rsCode: "101879", rsVariant: "RED",  rsDescription: "SKT Mop Py T1D 12 J PB", cartonSize: 100, cartonPrice: 83.59, xyloCode: "MOP_STAND_PY(12)_7OZ_RED"   },

  // ── Hygiemix socket mops ───────────────────────────────────────────────
  { rsCode: "103062", rsVariant: "BLUE", rsDescription: "SKT Mop Hygiemix T1D 200", cartonSize: 20, cartonPrice: 31.43, xyloCode: "SKT MOP HYGIEMIX T1D 200G - BLUE" },
  { rsCode: "103062", rsVariant: "RED",  rsDescription: "SKT Mop Hygiemix T1D 200", cartonSize: 20, cartonPrice: 31.43, xyloCode: "SKT MOP HYGIEMIX T1D 200G - RED"  },
  { rsCode: "103064", rsVariant: null,   rsDescription: "SKT Mop Hygiemix T1D 250", cartonSize: 15, cartonPrice: 29.80, xyloCode: "SKT MOP HYGIEMIX T1D 250G - RED"  },

  // ── Squeegees ──────────────────────────────────────────────────────────
  { rsCode: "101506", rsVariant: null, rsDescription: "Floor Squeegee Heavy 55cm", cartonSize: 10, cartonPrice: 42.41, xyloCode: "SQUEEGEE_METAL_55CM"   },
  { rsCode: "101500", rsVariant: null, rsDescription: "Floor Squeegee Heavy 55cm", cartonSize: 6,  cartonPrice: 42.41, xyloCode: "SQUEEGEE_PLASTIC_55CM" },

  // ── Toilet brushes ─────────────────────────────────────────────────────
  { rsCode: "102962", rsVariant: null, rsDescription: "Toilet Set Open", cartonSize: 24, cartonPrice: 27.00, xyloCode: "TOILET_BRUSH_HOLDER_WHITE" },

  // ── Trigger spray bottles (complete) ──────────────────────────────────
  { rsCode: "101982CLEBLU", rsVariant: null, rsDescription: "750ml 975 Clear Bottle & Blue 923 Spray Head Complete", cartonSize: 80, cartonPrice: 78.00, xyloCode: "TRG_COMPLETE_BLUE"  },
  { rsCode: "101982CLEGRN", rsVariant: null, rsDescription: "750ml 975 Clear Bottle & Green 923 Spray Head Complete", cartonSize: 80, cartonPrice: 78.00, xyloCode: "TRG_COMPLETE_GREEN" },
  { rsCode: "101982CLERED", rsVariant: null, rsDescription: "750ml 975 Clear Bottle & Red 923 Spray Head Complete",  cartonSize: 80, cartonPrice: 78.00, xyloCode: "TRG_COMPLETE_RED"   },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding ${rows.length} RS product rows…\n`);

  // Clear existing rows so the script is safe to re-run
  const deleted = await prisma.rsProduct.deleteMany({});
  if (deleted.count > 0) console.log(`  Cleared ${deleted.count} existing rows\n`);

  let linked = 0;
  let unlinked = 0;

  for (const row of rows) {
    // Look up the Xylo product by code to establish the FK
    const product = await prisma.ibsaProduct.findUnique({
      where: { code: row.xyloCode },
      select: { id: true },
    });

    if (!product) {
      console.warn(`  ⚠  No IbsaProduct found for code: "${row.xyloCode}" — stored unlinked`);
      unlinked++;
    } else {
      linked++;
    }

    await prisma.rsProduct.create({
      data: {
        rsCode: row.rsCode,
        rsVariant: row.rsVariant,
        rsDescription: row.rsDescription,
        cartonSize: row.cartonSize,
        cartonPrice: row.cartonPrice,
        ibsaProductId: product?.id ?? null,
      },
    });
  }

  console.log(`\nDone.`);
  console.log(`  ✓ ${rows.length} rows inserted`);
  console.log(`  ✓ ${linked} linked to IbsaProduct`);
  if (unlinked > 0) console.log(`  ⚠  ${unlinked} unlinked (code not matched — check IbsaProduct.code values)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
