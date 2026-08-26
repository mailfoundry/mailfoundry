#!/usr/bin/env node
/**
 * ibsa-bestsellers.mjs
 *
 * Analyses IBSA convention order data to find top-selling products.
 * Combines IbsaOrderItem (convention orders) + IbsaGroupOrderLine (congregation/circuit orders).
 *
 * Usage: node scripts/ibsa-bestsellers.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnv(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, "utf-8").split("\n").flatMap(line => {
        const m = line.match(/^([^#=][^=]*)=(.*)$/);
        return m ? [[m[1].trim(), m[2].trim().replace(/^["']|["']$/g, "")]] : [];
      })
    );
  } catch { return {}; }
}
const env = {
  ...parseEnv(resolve(__dirname, "../.env")),
  ...parseEnv(resolve(__dirname, "../.env.local")),
};
const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL;
if (!DATABASE_URL) { console.error("❌  DATABASE_URL not found"); process.exit(1); }

try { await import("pg"); } catch {
  execSync("npm install pg --save-dev --silent", { cwd: resolve(__dirname, ".."), stdio: "inherit" });
}
const { default: pkg } = await import("pg");
const { Pool } = pkg;
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ── Convention orders (IbsaOrderItem) ─────────────────────────────────────────
const { rows: convRows } = await pool.query(`
  SELECT
    p.id,
    p.code,
    p.name,
    p.variant,
    p.category,
    SUM(oi.qty) AS qty,
    COUNT(DISTINCT oi."conventionId") AS convention_count
  FROM "IbsaOrderItem" oi
  JOIN "IbsaProduct" p ON p.id = oi."productId"
  WHERE oi.qty > 0
  GROUP BY p.id, p.code, p.name, p.variant, p.category
  ORDER BY SUM(oi.qty) DESC
`);

// ── Group orders (IbsaGroupOrderLine) ─────────────────────────────────────────
const { rows: grpRows } = await pool.query(`
  SELECT
    p.id,
    p.code,
    p.name,
    p.variant,
    p.category,
    SUM(gl.qty) AS qty,
    COUNT(DISTINCT gl."orderId") AS order_count
  FROM "IbsaGroupOrderLine" gl
  JOIN "IbsaProduct" p ON p.id = gl."productId"
  WHERE gl.qty > 0
  GROUP BY p.id, p.code, p.name, p.variant, p.category
  ORDER BY SUM(gl.qty) DESC
`);

// ── Merge ──────────────────────────────────────────────────────────────────────
const totals = new Map();
for (const r of [...convRows, ...grpRows]) {
  const existing = totals.get(r.id) ?? { ...r, qty: 0, convention_count: 0, order_count: 0 };
  existing.qty             += parseInt(r.qty, 10);
  existing.convention_count = (existing.convention_count || 0) + parseInt(r.convention_count || 0, 10);
  existing.order_count      = (existing.order_count || 0) + parseInt(r.order_count || 0, 10);
  totals.set(r.id, existing);
}

const ranked = [...totals.values()].sort((a, b) => b.qty - a.qty);

await pool.end();

console.log("\n🏆  IBSA Best Sellers — all time\n");
console.log(`${"Rank".padEnd(5)} ${"Code".padEnd(8)} ${"Name".padEnd(45)} ${"Variant".padEnd(20)} ${"Category".padEnd(16)} ${"Qty".padStart(6)}`);
console.log("─".repeat(110));

ranked.slice(0, 20).forEach((p, i) => {
  const name    = (p.name ?? "").slice(0, 44).padEnd(45);
  const variant = (p.variant ?? "—").slice(0, 19).padEnd(20);
  const cat     = (p.category ?? "").padEnd(16);
  const qty     = String(p.qty).padStart(6);
  console.log(`${String(i + 1).padEnd(5)} ${p.code.padEnd(8)} ${name} ${variant} ${cat} ${qty}`);
});

console.log("\n── Top 4 for SCS best sellers widget ────────────────\n");
ranked.slice(0, 4).forEach((p, i) => {
  console.log(`  ${i + 1}. [${p.code}] ${p.name}${p.variant ? ` — ${p.variant}` : ""} (${p.qty} units across conventions)`);
});
