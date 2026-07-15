import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "../../../../src/lib/prisma";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // AOA: rows × cols, nulls for empty cells
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
  });

  // ── Extract contact / convention meta ─────────────────────────────────────
  let groupName = "";
  let contactName = "";
  let contactEmail = "";
  let contactMobile = "";
  let groupType = "regional"; // default

  for (const row of aoa) {
    const c1 = String(row[1] ?? "").trim();
    const c9 = String(row[9] ?? "").trim();
    const c4 = String(row[4] ?? "").trim();
    const c11 = String(row[11] ?? "").trim();

    if (c1 === "Convention Name:") groupName = c4;
    if (c9 === "Contact Name:" && !contactName) contactName = c11;
    if (c9 === "Email:" && !contactEmail) contactEmail = c11;
    if (c9 === "Contact No:" && !contactMobile) contactMobile = c11;
  }

  // Try to infer group type from spreadsheet title
  const title = String(aoa[0]?.[1] ?? "").toLowerCase();
  if (title.includes("circuit")) groupType = "circuit";
  else if (title.includes("congregation")) groupType = "congregation";
  else groupType = "regional";

  // ── Extract order lines (non-zero qty rows) ───────────────────────────────
  type RawLine = { code: string; qty: number };
  const rawLines: RawLine[] = [];

  for (const row of aoa) {
    const code = String(row[7] ?? "").trim();
    if (!code || code === "Internal Code (Office Use Only)") continue;

    const qtyRaw = row[9];
    const qty =
      typeof qtyRaw === "number"
        ? qtyRaw
        : parseFloat(String(qtyRaw ?? "0"));
    if (isNaN(qty) || qty <= 0) continue;

    rawLines.push({ code, qty: Math.round(qty) });
  }

  // ── Look up products by code ──────────────────────────────────────────────
  const codes = rawLines.map((l) => l.code);
  const products = await prisma.ibsaProduct.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, name: true, variant: true, category: true, unitCost: true },
  });
  const byCode = new Map(products.map((p) => [p.code, p]));

  const matched = rawLines
    .filter((l) => byCode.has(l.code))
    .map((l) => ({ ...l, product: byCode.get(l.code)! }));

  const unmatched = rawLines
    .filter((l) => !byCode.has(l.code))
    .map((l) => l.code);

  return NextResponse.json({
    groupName,
    groupType,
    contactName,
    contactEmail,
    contactMobile,
    matched,
    unmatched,
  });
}
