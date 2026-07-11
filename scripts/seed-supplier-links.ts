/**
 * Seeds supplier links for products NOT sourced from Robert Scott.
 * These rows have supplier + ibsaProductId set, but no catalog code/pricing yet.
 * Catalog data (rsCode, cartonSize, cartonPrice) can be added later.
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/seed-supplier-links.ts
 *
 * Safe to re-run — clears existing supplier-link rows (where rsCode IS NULL) and reinserts.
 * Robert Scott rows (where rsCode IS NOT NULL) are left untouched.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

// ── Source data ───────────────────────────────────────────────────────────────
// Format: [supplier, xyloCode]  (xyloCode = IbsaProduct.code in the database)
const rows: [string, string][] = [
  // Amazon
  ["Amazon", "COUCH_ROLL_50CMX50M"],
  ["Amazon", "DISP_PILLOW_50PACK"],
  ["Amazon", "TRAVEL_BED"],

  // Angel Supplies
  ["Angel Supplies", "WHEEL_CHAIR_MKII"],

  // Elite (hi-vis vests)
  ["Elite", "HI_VIS_BLUE_L"],
  ["Elite", "HI_VIS_BLUE_M"],
  ["Elite", "HI_VIS_BLUE_S"],
  ["Elite", "HI_VIS_BLUE_XL"],
  ["Elite", "HI_VIS_BLUE_XXL"],
  ["Elite", "HI_VIS_ORANGE_L"],
  ["Elite", "HI_VIS_ORANGE_LS_L"],
  ["Elite", "HI_VIS_ORANGE_LS_M"],
  ["Elite", "HI_VIS_ORANGE_LS_S"],
  ["Elite", "HI_VIS_ORANGE_LS_XL"],
  ["Elite", "HI_VIS_ORANGE_LS_XXL"],
  ["Elite", "HI_VIS_ORANGE_M"],
  ["Elite", "HI_VIS_ORANGE_S"],
  ["Elite", "HI_VIS_ORANGE_XL"],
  ["Elite", "HI_VIS_ORANGE_XXL"],
  ["Elite", "HI_VIS_ORG/BLUE_EXEC_L"],
  ["Elite", "HI_VIS_ORG/BLUE_EXEC_M"],
  ["Elite", "HI_VIS_ORG/BLUE_EXEC_S"],
  ["Elite", "HI_VIS_ORG/BLUE_EXEC_XL"],
  ["Elite", "HI_VIS_ORG/BLUE_EXEC_XXL"],
  ["Elite", "HI_VIS_PINK_L"],
  ["Elite", "HI_VIS_PINK_M"],
  ["Elite", "HI_VIS_PINK_S"],
  ["Elite", "HI_VIS_PINK_XL"],
  ["Elite", "HI_VIS_PINK_XXL"],
  ["Elite", "HI_VIS_RED_L"],
  ["Elite", "HI_VIS_RED_M"],
  ["Elite", "HI_VIS_RED_S"],
  ["Elite", "HI_VIS_RED_XL"],
  ["Elite", "HI_VIS_RED_XXL"],
  ["Elite", "HI_VIS_RED/GREY_EXEC_L"],
  ["Elite", "HI_VIS_RED/GREY_EXEC_M"],
  ["Elite", "HI_VIS_RED/GREY_EXEC_S"],
  ["Elite", "HI_VIS_RED/GREY_EXEC_XL"],
  ["Elite", "HI_VIS_RED/GREY_EXEC_XXL"],
  ["Elite", "HI_VIS_YELL/R.NAVY_EXEC_L"],
  ["Elite", "HI_VIS_YELL/R.NAVY_EXEC_M"],
  ["Elite", "HI_VIS_YELL/R.NAVY_EXEC_S"],
  ["Elite", "HI_VIS_YELL/R.NAVY_EXEC_XL"],
  ["Elite", "HI_VIS_YELL/R.NAVY_EXEC_XXL"],
  ["Elite", "HI_VIS_YELLOW_BS_L"],
  ["Elite", "HI_VIS_YELLOW_BS_M"],
  ["Elite", "HI_VIS_YELLOW_BS_S"],
  ["Elite", "HI_VIS_YELLOW_BS_XL"],
  ["Elite", "HI_VIS_YELLOW_BS_XXL"],
  ["Elite", "HI_VIS_YELLOW_EXEC_L"],
  ["Elite", "HI_VIS_YELLOW_EXEC_M"],
  ["Elite", "HI_VIS_YELLOW_EXEC_S"],
  ["Elite", "HI_VIS_YELLOW_EXEC_XL"],
  ["Elite", "HI_VIS_YELLOW_EXEC_XXL"],
  ["Elite", "HI_VIS_YELLOW_L"],
  ["Elite", "HI_VIS_YELLOW_L_FA"],
  ["Elite", "HI_VIS_YELLOW_LS_L"],
  ["Elite", "HI_VIS_YELLOW_LS_M"],
  ["Elite", "HI_VIS_YELLOW_LS_S"],
  ["Elite", "HI_VIS_YELLOW_LS_XL"],
  ["Elite", "HI_VIS_YELLOW_LS_XXL"],
  ["Elite", "HI_VIS_YELLOW_M"],
  ["Elite", "HI_VIS_YELLOW_M_FA"],
  ["Elite", "HI_VIS_YELLOW_S"],
  ["Elite", "HI_VIS_YELLOW_S_FA"],
  ["Elite", "HI_VIS_YELLOW_XL"],
  ["Elite", "HI_VIS_YELLOW_XL_FA"],
  ["Elite", "HI_VIS_YELLOW_XXL"],
  ["Elite", "HI_VIS_YELLOW_XXL_FA"],

  // FyterTech (spill kits)
  ["FyterTech", "MAINTENCE REFILL PADS_X20"],
  ["FyterTech", "SPILL_KITS_MAINTENANCE_10L"],
  ["FyterTech", "SPILL_KITS_MAINTENANCE_15L"],
  ["FyterTech", "SPILL_KITS_MAINTENANCE_20L"],
  ["FyterTech", "SPILL_KITS_MAINTENANCE_50L"],

  // Hilmi (centre feed rolls)
  ["Hilmi", "CENTRE_FEED_BLUE_DL_6PK"],
  ["Hilmi", "CENTRE_FEED_ST_BLUE_6PK"],
  ["Hilmi", "CENTRE_FEED_ST_WHITE_6PK"],
  ["Hilmi", "CENTRE_FEED_WHITE_DL_6PK"],

  // Jax First Aid Supplies
  ["Jax First Aid Supplies", "100PACK_ASSORTED_WATERPROOF_PLASTERS"],
  ["Jax First Aid Supplies", "10PACK_LARGE_FOIL_BLANKETS"],
  ["Jax First Aid Supplies", "A4_ACCIDENT_REPORT_BOOK"],
  ["Jax First Aid Supplies", "BIO_HAZARD_KITS"],
  ["Jax First Aid Supplies", "COCLENS_SKINSOL_500ML"],
  ["Jax First Aid Supplies", "EAB_INJURY_BANDAGE_5CMX4.5M"],
  ["Jax First Aid Supplies", "ECB_BANDAGE_5CMX4M"],
  ["Jax First Aid Supplies", "EYEWASH_INCCAP_500ML"],
  ["Jax First Aid Supplies", "FACEMASK_BLUE_50PACK"],
  ["Jax First Aid Supplies", "FIRSTAID_KIT_LARGE_188P"],
  ["Jax First Aid Supplies", "FIRSTAID_KIT_MEDIUM_126P"],
  ["Jax First Aid Supplies", "SHARPS_CONTAINER_13L"],
  ["Jax First Aid Supplies", "SHARPS_CONTAINER_1L"],
  ["Jax First Aid Supplies", "SHARPS_CONTAINER_2L"],
  ["Jax First Aid Supplies", "SHARPS_CONTAINER_7L"],
  ["Jax First Aid Supplies", "STATION_EYEWASH_TRIPLE"],
  ["Jax First Aid Supplies", "VOMIT_BAGS_50PACK"],

  // Just Gloves
  ["Just Gloves", "GLOVES_NITRILE_BLUE_L"],
  ["Just Gloves", "GLOVES_NITRILE_BLUE_MED"],
  ["Just Gloves", "GLOVES_NITRILE_BLUE_SML"],
  ["Just Gloves", "GLOVES_NITRILE_BLUE_XL"],
  ["Just Gloves", "GLOVES_NITRILE-POLY_FOAM_L_10PACK"],
  ["Just Gloves", "GLOVES_NITRILE-POLY_FOAM_M_10PACK"],
  ["Just Gloves", "GLOVES_NITRILE-POLY_FOAM_S_10PACK"],
  ["Just Gloves", "GLOVES_NITRILE-POLY_FOAM_XL_10PACK"],
  ["Just Gloves", "GLOVES_VINYL_CLEAR_L"],
  ["Just Gloves", "GLOVES_VINYL_CLEAR_MED"],
  ["Just Gloves", "GLOVES_VINYL_CLEAR_SML"],
  ["Just Gloves", "GLOVES_VINYL_CLEAR_XL"],

  // Medisave Supplies
  ["Medisave Supplies", "KOOLPAK_RESUSE_13CMx14CM"],
  ["Medisave Supplies", "MEDIPAL_AW_150P"],
  ["Medisave Supplies", "SCISSORS_INSTRAPAC_SS_13CM"],
  ["Medisave Supplies", "SCISSORS_SUPERSNIP_SS"],
  ["Medisave Supplies", "TISSUE_FACIAL_100SHEETS"],

  // PWR
  ["PWR", "EYEWEAR_SAFETY_GLASSES_CLEAR"],
  ["PWR", "EYEWEAR_SAFETY_GOGGLES_CLEAR"],
  ["PWR", "MASK_DISP_DUSTCLEAR_50PK"],
  ["PWR", "ROLLER_DIVIDE_100CMX200CM"],
  ["PWR", "WET_FLOOR_AFRAME"],

  // Tesco
  ["Tesco", "BODYFORM_HYGIENE_PADS_12PACK"],

  // TSSC (alternate supplier for FA hi-vis — same products as Elite _FA variants)
  ["TSSC", "HI_VIS_YELLOW_L_FA"],
  ["TSSC", "HI_VIS_YELLOW_M_FA"],
  ["TSSC", "HI_VIS_YELLOW_S_FA"],
  ["TSSC", "HI_VIS_YELLOW_XL_FA"],
  ["TSSC", "HI_VIS_YELLOW_XXL_FA"],

  // Xylo (internal / own stock)
  ["Xylo", "APRONS_FLTPACK_100PK"],
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding ${rows.length} supplier link rows…\n`);

  // Remove existing supplier-link rows (rsCode IS NULL) — leave Robert Scott rows intact
  const deleted = await prisma.rsProduct.deleteMany({ where: { rsCode: null } });
  if (deleted.count > 0) console.log(`  Cleared ${deleted.count} existing supplier-link rows\n`);

  let linked = 0;
  let unlinked = 0;

  for (const [supplier, xyloCode] of rows) {
    const product = await prisma.ibsaProduct.findUnique({
      where: { code: xyloCode },
      select: { id: true },
    });

    if (!product) {
      console.warn(`  ⚠  No IbsaProduct found for code: "${xyloCode}" (${supplier}) — stored unlinked`);
      unlinked++;
    } else {
      linked++;
    }

    await prisma.rsProduct.create({
      data: {
        supplier,
        // rsCode, rsDescription, cartonSize, cartonPrice all left null — to be filled in later
        ibsaProductId: product?.id ?? null,
      },
    });
  }

  console.log(`Done.`);
  console.log(`  ✓ ${rows.length} rows inserted`);
  console.log(`  ✓ ${linked} linked to IbsaProduct`);
  if (unlinked > 0) {
    console.log(`  ⚠  ${unlinked} unlinked (code not found — check IbsaProduct.code values)`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
