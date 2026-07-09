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
  conventionSearch: string; // search term to match convention name in DB
  dept: "CS" | "FA";
  invoiceDate: string;        // YYYY-MM-DD
  paymentDueDate: string;     // YYYY-MM-DD
  shippingCost: number;
  items: InvoiceItem[];
}

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

  // Find convention
  const convention = await prisma.ibsaConvention.findFirst({
    where: {
      name: { contains: inv.conventionSearch, mode: "insensitive" } as never,
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
    const product = await prisma.ibsaProduct.findUnique({
      where: { code: item.code },
    } as never) as { id: string } | null;

    if (!product) {
      console.warn(`  ✗ Product not found: ${item.code} — run seed-cs-products.ts first`);
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
