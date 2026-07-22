/**
 * pickList.ts
 * Client-side stock pick list generator — opens a print-optimised HTML page
 * in a new tab so warehouse staff can print it and physically check off items.
 * Designed for readability on a printed sheet: large type, big checkboxes,
 * and a prominent quantity column. No external dependencies.
 */

export type PickListLine = {
  code: string;
  name: string;
  variant: string | null;
  category: string;
  qty: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals: "Cleaning Chemicals",
  special: "Special Order",
  firstaid: "First Aid",
};

export function downloadPickList({
  conventionName,
  dept,
  items,
}: {
  conventionName: string;
  dept: "CS" | "FA";
  items: PickListLine[];
}) {
  const orderedItems = items.filter((i) => i.qty > 0);
  if (orderedItems.length === 0) {
    alert("No ordered items to print.");
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const deptLabel = dept === "CS" ? "Cleaning Supplies" : "First Aid";

  const grouped = orderedItems.reduce<Record<string, PickListLine[]>>((acc, i) => {
    if (!acc[i.category]) acc[i.category] = [];
    acc[i.category].push(i);
    return acc;
  }, {});

  const totalLines = orderedItems.length;
  const totalUnits = orderedItems.reduce((s, i) => s + i.qty, 0);

  const rows = Object.entries(grouped)
    .map(
      ([category, lines]) => `
    <tr class="cat-row"><td colspan="4">${CATEGORY_LABELS[category] ?? category}</td></tr>
    ${lines
      .map(
        (l) => `
    <tr>
      <td class="checkbox"><span class="box"></span></td>
      <td class="product">
        <div class="product-code">${l.code}</div>
      </td>
      <td class="variant">${l.variant ?? "—"}</td>
      <td class="qty"><span class="qty-pill">${l.qty}</span></td>
    </tr>`
      )
      .join("\n")}`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Pick List — ${conventionName} (${deptLabel})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #1e293b; background: white; }
    .page { padding: 14mm 14mm 12mm; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
    .header-left h1 { font-size: 26pt; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
    .header-left .org { color: #64748b; margin-top: 4px; font-size: 11pt; }
    .header-right { text-align: right; font-size: 11pt; color: #475569; }
    .header-right strong { color: #1e293b; font-size: 13pt; }
    hr { border: none; border-top: 2px solid #cbd5e1; margin: 12px 0; }
    .stats { margin-bottom: 12px; font-size: 12pt; color: #334155; font-weight: 700; }

    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #1e293b; color: #cbd5e1; }
    thead th { padding: 8px 12px; text-align: left; font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; }

    tbody tr:not(.cat-row) { border-bottom: 1px solid #e2e8f0; }
    tbody tr:not(.cat-row):nth-child(even) { background: #f8fafc; }
    tbody td { padding: 11px 12px; vertical-align: middle; }

    .cat-row td { background: #dbe3ee; font-weight: 800; font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b; padding: 8px 12px; border-top: 2px solid #94a3b8; }

    .checkbox { width: 40px; }
    .box { display: inline-block; width: 22px; height: 22px; border: 2.5px solid #334155; border-radius: 4px; }

    .product-code { font-family: 'Courier New', monospace; font-weight: 700; font-size: 11pt; color: #0f172a; letter-spacing: -0.2px; line-height: 1.3; }

    .variant { color: #334155; font-size: 11.5pt; width: 26%; }

    .qty { text-align: right; width: 70px; }
    .qty-pill {
      display: inline-block;
      min-width: 36px;
      padding: 4px 10px;
      background: #1e293b;
      color: #fff;
      font-size: 15pt;
      font-weight: 800;
      border-radius: 6px;
      text-align: center;
    }

    .footer { margin-top: 16px; font-size: 9pt; color: #94a3b8; display: flex; justify-content: space-between; }

    @media print {
      @page { margin: 0; size: A4 portrait; }
      .page { padding: 10mm 12mm 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>Pick List</h1>
        <div class="org">${deptLabel} &middot; IBSA Convention Supplies</div>
      </div>
      <div class="header-right">
        <p><strong>${conventionName}</strong></p>
        <p>Date: ${dateStr}</p>
      </div>
    </div>

    <hr />

    <div class="stats">${totalLines} line${totalLines !== 1 ? "s" : ""} &middot; ${totalUnits} unit${totalUnits !== 1 ? "s" : ""} to pick</div>

    <table>
      <thead>
        <tr>
          <th></th>
          <th>Code</th>
          <th>Variant</th>
          <th style="text-align:right">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="footer">
      <span>Generated by IBSA Portal &middot; ${dateStr}</span>
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
