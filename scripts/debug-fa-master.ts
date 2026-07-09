/**
 * Diagnostic: print the structure of FA Master.xlsx so we can find the right column indices.
 * Usage: npx tsx scripts/debug-fa-master.ts '/path/to/FA Master.xlsx'
 */
import * as path from "path";
import * as XLSX from "xlsx";

const xlsxPath = process.argv[2];
if (!xlsxPath) { console.error("Usage: npx tsx scripts/debug-fa-master.ts <path>"); process.exit(1); }

const wb = XLSX.readFile(path.resolve(xlsxPath), { cellDates: true });
const ws = wb.Sheets["FA - Master"];
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

// Print first 12 rows, first 32 columns
console.log("\n=== FIRST 12 ROWS (cols 0–31) ===");
for (let r = 0; r < 12; r++) {
  const row = rows[r] ?? [];
  for (let c = 0; c < 32; c++) {
    const v = row[c];
    if (v !== null && v !== undefined && String(v).trim()) {
      console.log(`  [r${r+1} c${c+1}] = ${JSON.stringify(v instanceof Date ? v.toISOString().split("T")[0] : v)}`);
    }
  }
}

// Find any row with something that looks like a supplier code (alphanumeric with underscores)
console.log("\n=== ROWS WITH SUPPLIER CODE PATTERN (col search) ===");
for (let r = 0; r < 20; r++) {
  const row = rows[r] ?? [];
  for (let c = 0; c < 32; c++) {
    const v = String(row[c] ?? "");
    if (/^[A-Z][A-Z0-9_]{5,}$/.test(v.trim())) {
      console.log(`  [r${r+1} c${c+1}] = ${v.trim()}`);
    }
  }
}

// Print row 10 in full (expected first product row)
console.log("\n=== ROW 10 IN FULL ===");
const r10 = rows[9] ?? [];
for (let c = 0; c < r10.length; c++) {
  const v = r10[c];
  if (v !== null && v !== undefined) {
    console.log(`  col ${c+1} (0-based: ${c}) = ${JSON.stringify(v instanceof Date ? v.toISOString().split("T")[0] : v)}`);
  }
}
