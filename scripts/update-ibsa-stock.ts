/**
 * Updates inStock and git values for all IBSA products from spreadsheet data.
 * Run: npx tsx scripts/update-ibsa-stock.ts
 */

import { prisma } from "../src/lib/prisma";
import stockData from "./ibsa-seed/stock_update.json";

type StockRow = { code: string; git: number; inStock: number };

async function main() {
  console.log(`Updating stock for ${stockData.length} products...`);
  let updated = 0;
  let notFound = 0;

  for (const row of stockData as StockRow[]) {
    const result = await prisma.ibsaProduct.updateMany({
      where: { code: row.code },
      data: { git: row.git, inStock: row.inStock },
    });
    if (result.count > 0) {
      updated++;
    } else {
      notFound++;
      if (row.git > 0 || row.inStock > 0) {
        console.log(`  ⚠ Not found: ${row.code} (GIT=${row.git}, Stock=${row.inStock})`);
      }
    }
  }

  console.log(`✓ Updated ${updated} products (${notFound} not found)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
