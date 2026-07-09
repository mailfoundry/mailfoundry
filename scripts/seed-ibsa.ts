/**
 * IBSA seed script — imports products, conventions, and existing order quantities.
 *
 * Run from the sendforge root:
 *   npx tsx scripts/seed-ibsa.ts
 */

import { prisma } from "../src/lib/prisma";
import productsData from "./ibsa-seed/ibsa_products.json";
import conventionsData from "./ibsa-seed/ibsa_conventions.json";
import orderItemsData from "./ibsa-seed/ibsa_order_items.json";

type ProductRow = {
  code: string;
  name: string;
  variant: string | null;
  category: string;
  type: string;
  unitCost: number;
};

type ConventionRow = {
  name: string;
  venue: string | null;
  conventionDate: string | null;
};

type OrderItemRow = {
  productCode: string;
  conventionName: string;
  qty: number;
};

async function main() {
  console.log("🌱 Seeding IBSA data...");

  // ── Products ────────────────────────────────────────────────────────────────
  console.log(`\nUpserting ${productsData.length} products...`);
  for (const p of productsData as ProductRow[]) {
    await prisma.ibsaProduct.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        variant: p.variant ?? null,
        category: p.category,
        type: p.type,
        unitCost: p.unitCost,
      },
      update: {
        name: p.name,
        variant: p.variant ?? null,
        category: p.category,
        type: p.type,
        unitCost: p.unitCost,
      },
    });
  }
  console.log("  ✓ Products done");

  // ── Conventions ─────────────────────────────────────────────────────────────
  console.log(`\nUpserting ${conventionsData.length} conventions...`);
  for (const c of conventionsData as ConventionRow[]) {
    const existing = await prisma.ibsaConvention.findFirst({
      where: { name: c.name },
    });

    const data = {
      name: c.name,
      venue: c.venue ?? null,
      conventionDate: c.conventionDate ? new Date(c.conventionDate) : new Date(),
    };

    if (existing) {
      await prisma.ibsaConvention.update({ where: { id: existing.id }, data });
    } else {
      await prisma.ibsaConvention.create({ data });
    }
  }
  console.log("  ✓ Conventions done");

  // ── Order items ─────────────────────────────────────────────────────────────
  console.log(`\nUpserting ${orderItemsData.length} order items...`);

  // Build lookup maps
  const productMap = new Map<string, string>(); // code → id
  const allProducts = await prisma.ibsaProduct.findMany({ select: { id: true, code: true } });
  for (const p of allProducts) productMap.set(p.code, p.id);

  const conventionMap = new Map<string, string>(); // name (lowercase) → id
  const allConventions = await prisma.ibsaConvention.findMany({ select: { id: true, name: true } });
  for (const c of allConventions) conventionMap.set(c.name.toLowerCase(), c.id);

  let skipped = 0;
  let upserted = 0;

  for (const item of orderItemsData as OrderItemRow[]) {
    const productId = productMap.get(item.productCode);

    // fuzzy match convention name — the master uses short names like "Newcastle"
    // but RC Dates has "NEWCASTLE". Try exact first, then partial.
    let conventionId = conventionMap.get(item.conventionName.toLowerCase());
    if (!conventionId) {
      // try startsWith match
      for (const [name, id] of conventionMap) {
        if (name.startsWith(item.conventionName.toLowerCase()) || item.conventionName.toLowerCase().startsWith(name.split(' ')[0])) {
          conventionId = id;
          break;
        }
      }
    }

    if (!productId || !conventionId) {
      skipped++;
      continue;
    }

    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId_dept: { conventionId, productId, dept: "CS" } },
      create: { conventionId, productId, dept: "CS", qty: item.qty },
      update: { qty: item.qty },
    });
    upserted++;
  }

  console.log(`  ✓ Order items done (${upserted} upserted, ${skipped} skipped — product/convention not found)`);
  console.log("\n✅ IBSA seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
