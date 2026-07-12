/**
 * generatePO.ts
 * Client-side Purchase Order generator — opens a print-optimised HTML page
 * in a new tab so the user can Save as PDF or Print.
 * No external dependencies.
 */

export type POLine = {
  rsCode: string | null;
  displayLabel: string;
  rsVariant: string | null;
  cartonSize: number | null;
  unitsNeeded: number;
  cartonsNeeded: number | null;
  cartonPrice: number | null;
  totalCost: number | null;
};

const fmtGbp = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function downloadPO({
  supplier,
  lines,
  conventionNames,
}: {
  supplier: string;
  lines: POLine[];
  conventionNames: string[];
}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const supplierCode = supplier
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  const dateCode = now.toISOString().slice(0, 10).replace(/-/g, "");
  const poNumber = `PO-${dateCode}-${supplierCode}`;

  const catalogLines = lines.filter((l) => l.cartonsNeeded != null);
  const pendingCount = lines.filter((l) => l.cartonsNeeded == null).length;
  const total = catalogLines.reduce((s, l) => s + (l.totalCost ?? 0), 0);

  const rows = catalogLines
    .map(
      (l) => `
    <tr>
      <td class="mono">${l.rsCode ?? "—"}</td>
      <td>${l.displayLabel}</td>
      <td class="center">${l.rsVariant ?? "—"}</td>
      <td class="right">${l.cartonSize ?? "—"}</td>
      <td class="right">${l.unitsNeeded}</td>
      <td class="right bold">${l.cartonsNeeded}</td>
      <td class="right">${l.cartonPrice != null ? fmtGbp(l.cartonPrice) : "—"}</td>
      <td class="right bold">${l.totalCost != null ? fmtGbp(l.totalCost) : "—"}</td>
    </tr>`
    )
    .join("\n");

  const coveringHtml =
    conventionNames.length > 0
      ? `<div class="covering"><strong>Covering:</strong> ${conventionNames.join(" &nbsp;&middot;&nbsp; ")}</div>`
      : "";

  const pendingHtml =
    pendingCount > 0
      ? `<span class="pending-note">&#9888; ${pendingCount} line${pendingCount !== 1 ? "s" : ""} without catalog data not included in this order.</span>`
      : "<span></span>";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${poNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      color: #1e293b;
      background: white;
      padding: 0;
    }

    .page { padding: 18mm 18mm 16mm; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
    .header-left h1 { font-size: 24pt; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; line-height: 1; }
    .header-left .org { color: #64748b; margin-top: 5px; font-size: 9pt; }
    .header-right { text-align: right; }
    .po-number { font-size: 13pt; font-weight: 700; color: #1e40af; font-family: 'Courier New', monospace; }
    .header-right p { color: #475569; margin-top: 5px; font-size: 9pt; }
    .header-right strong { color: #1e293b; }

    hr { border: none; border-top: 2px solid #e2e8f0; margin: 14px 0; }

    .covering { margin-bottom: 14px; font-size: 9pt; color: #64748b; line-height: 1.6; }
    .covering strong { color: #1e293b; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    thead tr { background: #1e293b; color: #94a3b8; }
    thead th {
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tfoot tr { background: #eff6ff; }
    tfoot td {
      padding: 7px 10px;
      font-weight: 600;
      font-size: 9pt;
    }
    tfoot tr:first-child td { border-top: 2px solid #bfdbfe; }
    tfoot tr.grand-total td {
      border-top: 2px solid #1e40af;
      font-size: 11pt;
      font-weight: 700;
      padding: 9px 10px;
    }

    .mono { font-family: 'Courier New', monospace; color: #64748b; font-size: 8.5pt; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; color: #0f172a; }
    .total-label { text-align: right; color: #64748b; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
    .total-value { text-align: right; color: #1e40af; }

    /* Footer */
    .footer { margin-top: 14px; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
    .pending-note { color: #d97706; font-weight: 500; }

    @media print {
      @page { margin: 0; size: A4 portrait; }
      .page { padding: 15mm 15mm 13mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>Purchase Order</h1>
        <div class="org">IBSA Convention Supplies</div>
      </div>
      <div class="header-right">
        <div class="po-number">${poNumber}</div>
        <p>Date: <strong>${dateStr}</strong></p>
        <p>Supplier: <strong>${supplier}</strong></p>
      </div>
    </div>

    <hr />

    ${coveringHtml}

    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Description</th>
          <th style="text-align:center">Variant</th>
          <th style="text-align:right">Carton</th>
          <th style="text-align:right">Units needed</th>
          <th style="text-align:right">Cartons</th>
          <th style="text-align:right">&pound;/Carton</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px;">No catalog lines to order</td></tr>'}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" class="total-label">Subtotal (ex VAT)</td>
          <td class="total-value">${fmtGbp(total)}</td>
        </tr>
        <tr>
          <td colspan="7" class="total-label">VAT @ 20%</td>
          <td class="total-value">${fmtGbp(total * 0.2)}</td>
        </tr>
        <tr class="grand-total">
          <td colspan="7" class="total-label" style="font-size:9pt;font-weight:700;">Total (inc VAT)</td>
          <td class="total-value" style="font-size:11pt;">${fmtGbp(total * 1.2)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      ${pendingHtml}
      <span>Generated by IBSA Portal &middot; ${dateStr}</span>
    </div>
  </div>

  <script>window.addEventListener('load', function() { window.print(); });</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert(
      "Popup blocked — please allow popups for this site and try again."
    );
    return;
  }
  win.document.write(html);
  win.document.close();
}
