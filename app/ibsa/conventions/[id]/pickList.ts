/**
 * pickList.ts
 * Client-side stock pick list generator — opens a print-optimised HTML page
 * in a new tab so warehouse staff can print it and physically check off items.
 * Clean, hairline-rule layout rather than a filled/boxy UI look — designed
 * to read like a proper printed document. No external dependencies.
 */

export type PickListLine = {
  code: string;
  name: string;
  variant: string | null;
  category: string;
  qty: number;
  unitCost: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals: "Cleaning Chemicals",
  special: "Special Order",
  firstaid: "First Aid",
};

const fmtGbp = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function downloadPickList({
  conventionName,
  dept,
  items,
  shippingCost,
}: {
  conventionName: string;
  dept: "CS" | "FA";
  items: PickListLine[];
  shippingCost: number;
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

  const subtotal = orderedItems.reduce((s, i) => s + i.qty * i.unitCost, 0);
  const vat = (subtotal + shippingCost) * 0.2;
  const grandTotal = subtotal + shippingCost + vat;

  const sections = Object.entries(grouped)
    .map(
      ([category, lines]) => `
    <div class="section">
      <div class="section-title">${CATEGORY_LABELS[category] ?? category}</div>
      <table>
        <tbody>
          ${lines
            .map(
              (l) => `
          <tr>
            <td class="checks">
              <span class="box"></span>
              <span class="box"></span>
              <span class="box"></span>
            </td>
            <td class="code">${l.code}</td>
            <td class="variant">${l.variant ?? "—"}</td>
            <td class="qty">${l.qty}</td>
            <td class="value">${fmtGbp(l.qty * l.unitCost)}</td>
          </tr>`
            )
            .join("\n")}
        </tbody>
      </table>
    </div>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Pick List — ${conventionName} (${deptLabel})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a1a1a; background: white; }
    .page { padding: 16mm 16mm 14mm; }

    .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
    .header h1 { font-size: 20pt; font-weight: 700; letter-spacing: -0.3px; }
    .header-right { text-align: right; font-size: 10.5pt; }
    .header-right .convention { font-weight: 700; font-size: 12pt; }
    .header-right .date { color: #555; margin-top: 2px; }

    .subtitle { color: #555; font-size: 10pt; margin-bottom: 10px; }

    hr { border: none; border-top: 1px solid #1a1a1a; margin: 0 0 10px; }

    .stats { font-size: 10pt; color: #555; margin-bottom: 18px; }
    .stats strong { color: #1a1a1a; }

    .section { margin-bottom: 4px; }
    .section-title {
      font-size: 9.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding-bottom: 4px;
      margin-top: 18px;
      border-bottom: 1px solid #1a1a1a;
    }

    table { width: 100%; border-collapse: collapse; }
    td { padding: 9px 0; border-bottom: 1px solid #ddd; vertical-align: middle; }
    tr:last-child td { border-bottom: 1px solid #ddd; }

    .checks { width: 56px; display: flex; gap: 7px; align-items: center; }
    .box { display: inline-block; width: 14px; height: 14px; border: 1.3px solid #1a1a1a; flex-shrink: 0; }

    .legend { display: flex; gap: 20px; margin-bottom: 16px; font-size: 9pt; color: #444; }
    .leg-item { display: flex; align-items: center; gap: 5px; }
    .legbox { display: inline-block; width: 11px; height: 11px; border: 1.3px solid #444; flex-shrink: 0; }

    .code { font-weight: 700; font-size: 11pt; padding-left: 4px; }
    .variant { color: #555; font-size: 10.5pt; text-align: right; padding-right: 18px; }
    .qty { font-weight: 700; font-size: 13pt; text-align: right; width: 40px; }
    .value { color: #333; font-size: 10.5pt; text-align: right; width: 80px; padding-left: 18px; }

    .summary { margin-top: 22px; display: flex; justify-content: flex-end; }
    .summary table { width: auto; min-width: 260px; }
    .summary td { padding: 6px 0; border-bottom: none; font-size: 10.5pt; }
    .summary .label { color: #555; padding-right: 24px; }
    .summary .amount { text-align: right; font-weight: 600; }
    .summary .total-row td { padding-top: 10px; border-top: 1px solid #1a1a1a; font-size: 13pt; font-weight: 700; }

    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 8.5pt; color: #888; display: flex; justify-content: space-between; }

    @media print {
      @page { margin: 14mm 14mm 16mm; size: A4 portrait; }
      .page { padding: 0; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      .section-title { page-break-after: avoid; break-after: avoid; }
      .summary { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>Pick List</h1>
      <div class="header-right">
        <div class="convention">${conventionName}</div>
        <div class="date">${dateStr}</div>
      </div>
    </div>
    <div class="subtitle">${deptLabel} &middot; IBSA Convention Supplies</div>

    <hr />

    <div class="stats"><strong>${totalLines}</strong> line${totalLines !== 1 ? "s" : ""} &middot; <strong>${totalUnits}</strong> unit${totalUnits !== 1 ? "s" : ""} to pick</div>

    <div class="legend">
      <span class="leg-item"><span class="legbox"></span> Picked</span>
      <span class="leg-item"><span class="legbox"></span> Palletised</span>
      <span class="leg-item"><span class="legbox"></span> Checked</span>
    </div>

    ${sections}

    <div class="summary">
      <table>
        <tbody>
          <tr>
            <td class="label">Subtotal (ex VAT)</td>
            <td class="amount">${fmtGbp(subtotal)}</td>
          </tr>
          <tr>
            <td class="label">Shipping</td>
            <td class="amount">${fmtGbp(shippingCost)}</td>
          </tr>
          <tr>
            <td class="label">VAT @ 20%</td>
            <td class="amount">${fmtGbp(vat)}</td>
          </tr>
          <tr class="total-row">
            <td class="label">Total</td>
            <td class="amount">${fmtGbp(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      <span>Generated by IBSA Portal</span>
      <span>${dateStr}</span>
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
