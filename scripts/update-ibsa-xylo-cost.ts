/**
 * Updates unitCost (sale price) and xyloCost for all IBSA CS products.
 * Run: npx tsx scripts/update-ibsa-xylo-cost.ts
 */

import { prisma } from "../src/lib/prisma";
import data from "./ibsa-seed/xylo_cost_update.json";

type Row = { code: string; salePrice: number | null; xyloCost: number | null };

async function main() {
  console.log(`Updating costs for ${data.length} products...`);
  let updated = 0;

  for (const row of data as Row[]) {
    const update: Record<string, number> = {};
    if (row.salePrice !== null) update.unitCost = row.salePrice;
    if (row.xyloCost !== null) update.xyloCost = row.xyloCost;
    if (Object.keys(update).length === 0) continue;

    const result = await prisma.ibsaProduct.updateMany({
      where: { code: row.code },
      data: update,
    });
    if (result.count > 0) updated++;
  }

  console.log(`✓ Updated ${updated} products`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
