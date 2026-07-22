/**
 * xeroExport.ts
 * Client-side Xero "Invoices" CSV export — builds a CSV matching Xero's
 * bulk invoice import format (ContactName, InvoiceNumber, InvoiceDate,
 * DueDate, Description, Quantity, UnitAmount, AccountCode, TaxType) and
 * triggers a browser download. No external dependencies.
 */

export type XeroLine = {
  code: string;
  name: string;
  variant: string | null;
  qty: number;
  unitCost: number;
};

const TAX_TYPE = "20% (VAT on Income)";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function downloadXeroExport({
  conventionName,
  dept,
  items,
  paymentDueDate,
}: {
  conventionName: string;
  dept: "CS" | "FA";
  items: XeroLine[];
  paymentDueDate: string | null;
}) {
  const orderedItems = items.filter((i) => i.qty > 0);
  if (orderedItems.length === 0) {
    alert("No ordered items to export.");
    return;
  }

  const today = new Date();
  const invoiceDate = fmtDate(today);
  const due = paymentDueDate
    ? new Date(paymentDueDate)
    : new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const dueDate = fmtDate(due);

  const dateCode = today.toISOString().slice(0, 10).replace(/-/g, "");
  const slug = conventionName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  const invoiceNumber = `${slug}-${dept}-${dateCode}`;
  const deptLabel = dept === "CS" ? "Cleaning Supplies" : "First Aid";

  const headers = [
    "ContactName",
    "InvoiceNumber",
    "InvoiceDate",
    "DueDate",
    "Description",
    "Quantity",
    "UnitAmount",
    "AccountCode",
    "TaxType",
    "Reference",
  ];

  const rows = orderedItems.map((i) => {
    const description = i.variant ? `${i.name} - ${i.variant}` : i.name;
    return [
      conventionName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      description,
      String(i.qty),
      i.unitCost.toFixed(2),
      "",
      TAX_TYPE,
      `${conventionName} (${deptLabel})`,
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => csvEscape(String(cell))).join(","))
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoiceNumber}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
