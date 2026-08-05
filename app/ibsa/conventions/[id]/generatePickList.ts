/**
 * generatePickList.ts
 * Client-side Pick List generator — opens a print-optimised HTML page in a
 * new tab so the user can Save as PDF or Print.
 * Each product row has three checkbox columns: Picked · Palletised · Checked
 * No external dependencies.
 */

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  mops:       "Mops",
  janitorial: "Janitorial",
  gloves:     "Gloves",
  hivis:      "Hi Vis",
  brushes:    "Brushes & Handles",
  handles:    "Brushes & Handles",
  chemicals: "Cleaning Chemicals",
  firstaid: "First Aid",
  special: "Special Order",
};

const fmtGbp = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type PickListLine = {
  code: string;
  name: string;
  variant: string | null;
  category: string;
  qty: number;
  unitCost: number;
};

export function downloadPickList({
  conventionName,
  dept,
  lines,
  shippingCost,
}: {
  conventionName: string;
  dept: "CS" | "FA";
  lines: PickListLine[];
  shippingCost: number;
}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const deptLabel = dept === "FA" ? "First Aid" : "Cleaning Supplies";
  const totalUnits = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat + shippingCost;

  // Normalise variant → size rank so rows sort S → M → L → XL → XXL
  // Handles compound variants like "Blue / Large" by scanning each token
  function sizeRank(v: string | null): number {
    if (!v) return 99;
    const sizeMap: Record<string, number> = {
      s: 1, small: 1,
      m: 2, medium: 2, med: 2,
      l: 3, large: 3,
      xl: 4, xlarge: 4, extralarge: 4,
      xxl: 5, xxlarge: 5, extraextralarge: 5,
      xxxl: 6, xxxlarge: 6,
    };
    // Split on any non-alphanumeric run so "Blue / Large" → ["blue","large"]
    const tokens = v.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    let best = 99;
    for (const token of tokens) {
      const r = sizeMap[token];
      if (r !== undefined && r < best) best = r;
    }
    return best;
  }

  // Group lines by category, preserving order
  const grouped = new Map<string, PickListLine[]>();
  for (const l of lines) {
    if (!grouped.has(l.category)) grouped.set(l.category, []);
    grouped.get(l.category)!.push(l);
  }

  const bodyRows = Array.from(grouped.entries())
    .map(([cat, catLines]) => {
      const catLabel = CATEGORY_LABELS[cat] ?? cat.toUpperCase();
      // Sort within each category: by product name first, then by size variant
      const sorted = [...catLines].sort((a, b) => {
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return sizeRank(a.variant) - sizeRank(b.variant);
      });
      const productRows = sorted
        .map(
          (l) => `
        <tr>
          <td class="code">${l.code}</td>
          <td class="name"><strong>${l.name}</strong></td>
          <td class="variant">${l.variant ?? "—"}</td>
          <td class="right qty"><strong>${l.qty}</strong></td>
          <td class="right price">${fmtGbp(l.qty * l.unitCost)}</td>
          <td class="check">&#9744;</td>
          <td class="check">&#9744;</td>
          <td class="check">&#9744;</td>
        </tr>`
        )
        .join("\n");

      return `
      <tr class="cat-row">
        <td colspan="8">${catLabel}</td>
      </tr>
      ${productRows}`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Pick List — ${conventionName} (${deptLabel})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      color: #1e293b;
      background: white;
    }

    .page { padding: 16mm 18mm 14mm; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
    .header-left h1 { font-size: 26pt; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; line-height: 1; }
    .header-right { text-align: right; }
    .header-right .conv-name { font-size: 13pt; font-weight: 700; color: #0f172a; }
    .header-right .date { font-size: 9pt; color: #64748b; margin-top: 3px; }

    .subtitle { font-size: 9pt; color: #64748b; margin-bottom: 14px; }

    hr { border: none; border-top: 2px solid #e2e8f0; margin: 10px 0 12px; }

    .stats { font-size: 9.5pt; color: #1e293b; margin-bottom: 14px; }
    .stats strong { font-weight: 700; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }

    thead tr { background: #1e293b; color: #94a3b8; }
    thead th {
      padding: 7px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    thead th.right { text-align: right; }
    thead th.center { text-align: center; }

    tbody tr:nth-child(even):not(.cat-row) { background: #f8fafc; }
    tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }

    tr.cat-row td {
      padding: 5px 8px 4px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #475569;
      background: #f1f5f9;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
    }

    td.code { font-family: 'Courier New', monospace; font-size: 7.5pt; color: #64748b; width: 14%; }
    td.name { width: 28%; }
    td.name strong { font-weight: 700; color: #0f172a; }
    td.variant { color: #475569; font-size: 8.5pt; width: 18%; }
    td.qty { font-size: 11pt; color: #0f172a; }
    td.price { color: #475569; }
    td.right { text-align: right; }

    /* Checkbox columns */
    td.check {
      text-align: center;
      font-size: 14pt;
      color: #0f172a;
      width: 8%;
      padding: 4px 6px;
    }
    thead th.check-hdr {
      text-align: center;
      width: 8%;
      padding: 7px 6px;
    }

    /* Totals */
    tfoot tr { background: #f8fafc; }
    tfoot td {
      padding: 6px 8px;
      font-size: 9pt;
    }
    tfoot tr:first-child td { border-top: 2px solid #e2e8f0; }
    tfoot tr.total-line td { border-top: 2px solid #0f172a; font-weight: 700; font-size: 10pt; }
    .total-label { text-align: right; color: #64748b; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
    .total-value { text-align: right; }

    /* Page footer */
    .footer { margin-top: 12px; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between; }

    @media print {
      @page { margin: 0; size: A4 landscape; }
      .page { padding: 10mm 14mm 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tfoot { display: table-row-group; }
      .footer { page-break-before: avoid; break-before: avoid; margin-top: 6px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>Pick List</h1>
        <p class="subtitle">${deptLabel} &middot; IBSA Convention Supplies</p>
      </div>
      <div class="header-right">
        <div class="conv-name">${conventionName}</div>
        <div class="date">${dateStr}</div>
      </div>
    </div>

    <hr />

    <p class="stats"><strong>${lines.length} lines</strong> &middot; <strong>${totalUnits.toLocaleString()}</strong> units to pick</p>

    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Product</th>
          <th>Variant</th>
          <th class="right">Qty</th>
          <th class="right">Value</th>
          <th class="center check-hdr">Picked</th>
          <th class="center check-hdr">Palletised</th>
          <th class="center check-hdr">Checked</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="total-label">Subtotal (ex VAT)</td>
          <td class="total-value">${fmtGbp(subtotal)}</td>
          <td colspan="3"></td>
        </tr>
        <tr>
          <td colspan="4" class="total-label">Shipping</td>
          <td class="total-value">${fmtGbp(shippingCost)}</td>
          <td colspan="3"></td>
        </tr>
        <tr>
          <td colspan="4" class="total-label">VAT @ 20%</td>
          <td class="total-value">${fmtGbp(vat)}</td>
          <td colspan="3"></td>
        </tr>
        <tr class="total-line">
          <td colspan="4" class="total-label" style="font-size:9pt;font-weight:700;">Total</td>
          <td class="total-value" style="font-size:10.5pt;font-weight:700;">${fmtGbp(total)}</td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <span>Generated by IBSA Portal &middot; ${dateStr}</span>
      <span>${conventionName} &middot; ${deptLabel}</span>
    </div>
  </div>

  <script>window.addEventListener('load', function() { window.print(); });</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup blocked — please allow popups for this site and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
