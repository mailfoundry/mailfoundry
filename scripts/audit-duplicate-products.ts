/**
 * Audits IbsaProduct table for:
 *   1. Products in unrecognised categories (not in the standard set)
 *   2. Products whose name+variant closely matches another product (likely dupes)
 *
 * Usage:
 *   export $(grep DATABASE_URL .env | tr -d '"') && npx tsx scripts/audit-duplicate-products.ts
 *
 * To delete the flagged products, re-run with:
 *   npx tsx scripts/audit-duplicate-products.ts --delete
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as any;

const KNOWN_CATEGORIES = new Set([
  "safety_ppe", "janitorial", "chemicals", "special", "firstaid",
]);

async function main() {
  const doDelete = process.argv.includes("--delete");
  const all = await prisma.ibsaProduct.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });

  // ── 1. Unknown categories ─────────────────────────────────────────────────
  const unknownCat = all.filter((p: any) => !KNOWN_CATEGORIES.has(p.category));
  console.log(`\n── Products in unrecognised categories (${unknownCat.length}) ──`);
  for (const p of unknownCat) {
    console.log(`  [${p.category}] ${p.code}  (${p.name} / ${p.variant ?? "—"})`);
  }

  // ── 2. Name+variant duplicates ────────────────────────────────────────────
  const seen = new Map<string, any[]>();
  for (const p of all) {
    const key = `${p.name.toLowerCase().trim()}|${(p.variant ?? "").toLowerCase().trim()}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(p);
  }
  const dupes = [...seen.values()].filter((g) => g.length > 1);
  console.log(`\n── Duplicate name+variant groups (${dupes.length}) ──`);
  for (const group of dupes) {
    console.log(`  "${group[0].name} / ${group[0].variant ?? "—"}":`);
    for (const p of group) {
      console.log(`    id=${p.id}  code=${p.code}  cat=${p.category}  unitCost=${p.unitCost}`);
    }
  }

  if (doDelete) {
    // Delete unknown-category products
    const unknownIds = new Set(unknownCat.map((p: any) => p.id));
    if (unknownIds.size > 0) {
      await prisma.ibsaProduct.deleteMany({ where: { id: { in: [...unknownIds] } } });
      console.log(`\n✓ Deleted ${unknownIds.size} unknown-category product(s).`);
    }
    // For dupe groups: delete all but the best surviving entry.
    // Skip any entry already deleted above (was in unknown category).
    let dupeDeleted = 0;
    for (const group of dupes) {
      const surviving = group.filter((p: any) => !unknownIds.has(p.id));
      if (surviving.length <= 1) continue; // already resolved by category deletion

      // Prefer the entry with a xyloCost; then prefer known category; then first
      const keep =
        surviving.find((p: any) => p.xyloCost != null) ??
        surviving.find((p: any) => KNOWN_CATEGORIES.has(p.category)) ??
        surviving[0];
      const remove = surviving.filter((p: any) => p.id !== keep.id);
      if (remove.length > 0) {
        await prisma.ibsaProduct.deleteMany({ where: { id: { in: remove.map((p: any) => p.id) } } });
        dupeDeleted += remove.length;
        console.log(`  Kept: ${keep.code}  Removed: ${remove.map((p: any) => p.code).join(", ")}`);
      }
    }
    if (dupeDeleted > 0) console.log(`✓ Deleted ${dupeDeleted} additional duplicate(s).`);
  } else {
    console.log("\nRun with --delete to remove the above entries.");
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
