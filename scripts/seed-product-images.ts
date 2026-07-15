/**
 * One-time script: copy image filenames from PRODUCT_IMAGE_MAP into the DB imageUrl field.
 * Run with: npx tsx scripts/seed-product-images.ts
 */
import { prisma } from "../src/lib/prisma";
import { PRODUCT_IMAGE_MAP } from "../src/lib/product-images";

async function main() {
  let updated = 0;
  let notFound = 0;

  for (const [code, path] of Object.entries(PRODUCT_IMAGE_MAP)) {
    // Strip the /product-images/ prefix — store just the filename
    const filename = path.replace("/product-images/", "");
    const result = await prisma.ibsaProduct.updateMany({
      where: { code },
      data: { imageUrl: filename },
    });
    if (result.count > 0) {
      updated++;
      console.log(`✓  ${code} → ${filename}`);
    } else {
      notFound++;
      console.log(`✗  Not in DB: ${code}`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found in DB`);
}

main().catch(console.error);
