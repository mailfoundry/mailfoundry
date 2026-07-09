/**
 * Import FA Master spreadsheet:
 *  1. Upserts 52 First Aid Dept products into IbsaProduct (type=FA)
 *  2. Imports per-convention quantities as IbsaOrderItem records
 *  3. Writes FA-specific logistics dates to IbsaConvention
 *
 * Usage (from sendforge dir):
 *   export $(grep DATABASE_URL .env | tr -d '"') && \
 *   npx tsx scripts/import-fa-master.ts '/path/to/FA Master.xlsx'
 */

import * as path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as unknown as {
  ibsaProduct: {
    upsert: (args: unknown) => Promise<{ id: string }>;
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
  ibsaConvention: {
    findMany: (args: unknown) => Promise<{ id: string; name: string }[]>;
    update: (args: unknown) => Promise<{ id: string }>;
  };
  ibsaOrderItem: {
    upsert: (args: unknown) => Promise<unknown>;
  };
  $disconnect: () => Promise<void>;
};

// Fuzzy match: FA Master column name → DB search terms
const CONVENTION_MAP: Record<string, string[]> = {
  "Milton Keynes": ["Milton Keynes"],
  "Exeter": ["Exeter"],
  "North London": ["North London", "Wembley"],
  "Manchester": ["Manchester"],
  "Norfolk": ["Norfolk"],
};

function firstLine(s: unknown): string {
  if (!s) return "";
  return String(s).split("\n")[0].trim();
}

/** Convert an XLSX cell value to a JS Date, or null if blank/invalid */
function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // XLSX serial number
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d);
  }
  // ISO/text string
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) {
    console.error("Usage: npx tsx scripts/import-fa-master.ts <path-to-FA-Master.xlsx>");
    process.exit(1);
  }

  console.log("Reading FA Master:", path.resolve(xlsxPath));
  const wb = XLSX.readFile(path.resolve(xlsxPath), { cellDates: true });
  const ws = wb.Sheets["FA - Master"];
  if (!ws) {
    console.error('Sheet "FA - Master" not found. Sheets:', wb.SheetNames.join(", "));
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

  // ── 1. Parse convention columns ──────────────────────────────────────────
  // Row 9 (1-based) = index 8 = column headers
  // Rows 3–6 (1-based) = indices 2–5 = FA logistics dates per convention column
  // Cols 24–28 (1-based) = indices 23–27 = Milton Keynes → Norfolk
  // All indices are 0-based. The spreadsheet header row is row 9 (index 8).
  // Convention columns start at col 23 (0-based: 22) = Milton Keynes → col 27 (0-based: 26) = Norfolk.
  // Date rows: r3=payment(idx2), r4=collection(idx3), r5=delivery(idx4).
  const CONV_START_COL = 22; // 0-based: "Milton Keynes"
  const CONV_END_COL = 26;   // 0-based: "Norfolk"

  const headerRow = rows[8] as unknown[];

  interface ConvCol {
    col: number;
    name: string;
    faPaymentDueDate: Date | null;
    faCollectionDate: Date | null;
    faDeliveryDate: Date | null;
  }

  const convCols: ConvCol[] = [];
  for (let c = CONV_START_COL; c <= CONV_END_COL; c++) {
    const name = String(headerRow[c] || "").trim();
    if (!name) continue;
    convCols.push({
      col: c,
      name,
      faPaymentDueDate: toDate(rows[2]?.[c]),   // row 3
      faCollectionDate: toDate(rows[3]?.[c]),   // row 4
      faDeliveryDate:   toDate(rows[4]?.[c]),   // row 5
    });
  }
  console.log("\nConvention columns found:", convCols.map(c => c.name).join(", "));
  for (const cc of convCols) {
    console.log(`  ${cc.name}: payment=${cc.faPaymentDueDate?.toDateString() ?? "—"} | collection=${cc.faCollectionDate?.toDateString() ?? "—"} | delivery=${cc.faDeliveryDate?.toDateString() ?? "—"}`);
  }

  // ── 2. Parse products ────────────────────────────────────────────────────
  interface FAProduct {
    code: string;
    name: string;
    variant: string | null;
    unitCost: number;
    xyloCost: number | null;
    inStock: number;
    git: number;
    qtys: Record<string, number>;
  }

  const products: FAProduct[] = [];

  // Correct 0-based column indices (verified from debug output):
  // col E (idx 4)  = product name / size description (multi-line)
  // col H (idx 7)  = supplier code
  // col K (idx 9)  = GIT
  // col L (idx 10) = In Stock
  // col O (idx 13) = Unit Cost
  // col R (idx 16) = Xylo Cost

  // Pure-size words — when a "- X" line is only this, it's a variant not a name
  const SIZE_ONLY = /^(X?X?S|X?X?L|Small|Medium|Large|Extra Large|\d+\s*(ml|L|cm|m|mm|g|kg))/i;

  let lastParentName = "";

  for (let r = 9; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const code = String(row[7] || "").trim();
    if (!code || code === "Supplier Code") continue;

    // Col E is a multi-line string. Line 1 = name or "- variant".
    const rawE = String(row[4] || "").trim();
    const lines = rawE.split("\n").map((l) => l.trim()).filter(Boolean);
    const line1 = lines[0] || "";
    const line2 = lines[1] || "";

    let name: string;
    let variant: string | null = null;

    if (!line1) {
      // Blank name — inherit parent
      name = lastParentName || code;
    } else if (line1.startsWith("-")) {
      const afterDash = line1.replace(/^-\s*/, "").trim();
      if (SIZE_ONLY.test(afterDash)) {
        // Pure size variant (e.g. "- Large") — inherit parent name
        name = lastParentName || afterDash;
        variant = afterDash;
      } else {
        // Dash is a spreadsheet formatting artefact — strip it, treat as own product
        name = afterDash;
        lastParentName = afterDash;
        if (line2.startsWith("-")) {
          const v = line2.replace(/^-\s*/, "").trim();
          if (SIZE_ONLY.test(v)) variant = v;
        }
      }
    } else {
      // Normal product name
      lastParentName = line1;
      name = line1;
      if (line2.startsWith("-")) {
        const v = line2.replace(/^-\s*/, "").trim();
        if (SIZE_ONLY.test(v)) variant = v;
      }
    }

    const unitCost = typeof row[13] === "number" ? row[13] : parseFloat(String(row[13] || "0")) || 0;
    const xyloCost = typeof row[16] === "number" ? row[16] : null;
    const inStock  = typeof row[10] === "number" ? Math.round(row[10]) : 0;
    const git      = typeof row[9]  === "number" ? Math.round(row[9])  : 0;

    const qtys: Record<string, number> = {};
    for (const cc of convCols) {
      const v = row[cc.col];
      qtys[cc.name] = typeof v === "number" ? Math.round(v) : 0;
    }

    products.push({ code, name, variant: variant || null, unitCost, xyloCost: xyloCost ?? null, inStock, git, qtys });
  }

  console.log(`\nParsed ${products.length} FA products`);

  // ── 3. Upsert FA products ────────────────────────────────────────────────
  console.log("\nUpserting FA products...");
  for (const p of products) {
    await prisma.ibsaProduct.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        variant: p.variant,
        category: "firstaid",
        type: "FA",
        unitCost: p.unitCost,
        xyloCost: p.xyloCost,
        inStock: p.inStock,
        git: p.git,
      },
      update: {
        name: p.name,
        variant: p.variant,
        unitCost: p.unitCost,
        xyloCost: p.xyloCost ?? undefined,
        inStock: p.inStock,
        git: p.git,
      },
    } as never);
    process.stdout.write(".");
  }
  console.log(`\n✓ ${products.length} FA products upserted`);

  // ── 4. Match conventions in DB ───────────────────────────────────────────
  const dbConventions = await prisma.ibsaConvention.findMany({ where: {} } as never);
  console.log(`\nFound ${dbConventions.length} conventions in DB`);

  const convIdMap: Record<string, string> = {};
  for (const cc of convCols) {
    const terms = CONVENTION_MAP[cc.name] || [cc.name];
    const match = dbConventions.find((c) =>
      terms.some((t) => c.name.toLowerCase().includes(t.toLowerCase()))
    );
    if (match) {
      convIdMap[cc.name] = match.id;
      console.log(`  ✓ "${cc.name}" → "${match.name}"`);
    } else {
      console.log(`  ✗ "${cc.name}" → no DB match`);
    }
  }

  // ── 5. Write FA logistics dates to each matched convention ───────────────
  console.log("\nUpdating FA logistics dates...");
  for (const cc of convCols) {
    const conventionId = convIdMap[cc.name];
    if (!conventionId) continue;
    await prisma.ibsaConvention.update({
      where: { id: conventionId },
      data: {
        faPaymentDueDate: cc.faPaymentDueDate ?? undefined,
        faCollectionDate: cc.faCollectionDate ?? undefined,
        faDeliveryDate:   cc.faDeliveryDate   ?? undefined,
      },
    } as never);
    console.log(`  ✓ ${cc.name} FA dates written`);
  }

  // ── 6. Import order quantities ───────────────────────────────────────────
  console.log("\nImporting FA order quantities...");
  let itemCount = 0;

  for (const cc of convCols) {
    const conventionId = convIdMap[cc.name];
    if (!conventionId) {
      console.log(`  Skipping ${cc.name} — no DB match`);
      continue;
    }

    for (const p of products) {
      const qty = p.qtys[cc.name] ?? 0;
      if (qty <= 0) continue;

      const prod = await prisma.ibsaProduct.findUnique({ where: { code: p.code } } as never) as { id: string } | null;
      if (!prod) continue;

      await prisma.ibsaOrderItem.upsert({
        where: { conventionId_productId: { conventionId, productId: prod.id } },
        create: { conventionId, productId: prod.id, qty },
        update: { qty },
      } as never);
      itemCount++;
    }
    console.log(`  ✓ ${cc.name}`);
  }

  console.log(`\n✓ Done. ${itemCount} FA order items imported.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
