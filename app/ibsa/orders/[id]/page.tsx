import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";

export const dynamic = "force-dynamic";

import IbsaAppShell from "../../../../src/components/ibsa-app-shell";
import UpdateStatusButton from "./UpdateStatusButton";
import SendInvoiceButton from "./SendInvoiceButton";
import DeleteOrderButton from "./DeleteOrderButton";

type Props = { params: Promise<{ id: string }> };

const GROUP_LABELS: Record<string, string> = {
  congregation: "Congregation",
  circuit:      "Circuit Assembly",
  regional:     "Regional",
};

const STATUS_STYLES: Record<string, string> = {
  submitted:  "bg-blue-900/40 text-blue-300",
  processing: "bg-amber-900/40 text-amber-300",
  complete:   "bg-green-900/40 text-green-300",
  cancelled:  "bg-slate-800 text-slate-500",
};

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  const order = await prisma.ibsaGroupOrder.findUnique({
    where: { id },
    include: {
      lines: {
        include: { product: true },
        orderBy: [{ dept: "asc" }],
      },
      groupAccount: true,
    },
  });

  if (!order) notFound();

  const csLines = order.lines.filter((l) => l.dept === "CS");
  const faLines = order.lines.filter((l) => l.dept === "FA");

  const grandTotal    = order.lines.reduce((s, l) => s + l.product.unitCost * l.qty, 0);
  const grandProfit   = order.lines.reduce((s, l) => s + (l.product.unitCost - (l.product.xyloCost ?? l.product.unitCost)) * l.qty, 0);
  const grandMarginPct = grandTotal > 0 ? (grandProfit / grandTotal) * 100 : 0;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <IbsaAppShell active="ibsa-orders">
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/ibsa/orders" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← Orders
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">{order.groupName}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{GROUP_LABELS[order.groupType] ?? order.groupType} · {fmtDate(order.submittedAt)}</p>
        </div>
        <span className={`shrink-0 inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[order.status] ?? "bg-slate-800 text-slate-400"}`}>
          {order.status}
        </span>
      </div>

      {/* Contact & delivery */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</p>
          <p className="font-semibold text-white">{order.contactName}</p>
          <p className="text-sm text-slate-400">{order.contactEmail}</p>
          {order.contactMobile && <p className="text-sm text-slate-400">{order.contactMobile}</p>}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Required By</p>
          <p className="text-sm text-slate-300">{order.requiredBy ?? "As soon as possible"}</p>
        </div>
        {order.deliveryAddress && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Address</p>
            <p className="whitespace-pre-line text-sm text-slate-300">{order.deliveryAddress}</p>
          </div>
        )}
        {order.notes && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
            <p className="text-sm text-slate-300">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Order lines */}
      {[{ label: "Cleaning Supplies", lines: csLines }, { label: "First Aid", lines: faLines }].map(({ label, lines }) => {
        if (lines.length === 0) return null;
        const sectionTotal  = lines.reduce((s, l) => s + l.product.unitCost * l.qty, 0);
        const sectionProfit = lines.reduce((s, l) => s + (l.product.unitCost - (l.product.xyloCost ?? l.product.unitCost)) * l.qty, 0);
        const sectionPct    = sectionTotal > 0 ? (sectionProfit / sectionTotal) * 100 : 0;
        return (
          <div key={label} className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Code</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Sale</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Cost</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Line Sale</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Margin £</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const sale      = l.product.unitCost;
                    const cost      = l.product.xyloCost ?? l.product.unitCost;
                    const lineTotal = sale * l.qty;
                    const lineCost  = cost * l.qty;
                    const margin    = lineTotal - lineCost;
                    const marginPct = lineTotal > 0 ? (margin / lineTotal) * 100 : 0;
                    return (
                      <tr key={l.id} className={i > 0 ? "border-t border-slate-800/60" : ""}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{l.product.code}</td>
                        <td className="px-4 py-3 text-white">
                          {l.product.name}
                          {l.product.variant && (
                            <span className="ml-1.5 text-xs text-slate-400">{l.product.variant}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">{fmtGbp(sale)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{fmtGbp(cost)}</td>
                        <td className="px-4 py-3 text-right font-bold text-white">{l.qty}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{fmtGbp(lineTotal)}</td>
                        <td className="px-4 py-3 text-right text-green-400">{fmtGbp(margin)}</td>
                        <td className="px-4 py-3 text-right text-green-400">{marginPct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700">
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {label} total
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-400">{fmtGbp(sectionTotal)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">{fmtGbp(sectionProfit)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">{sectionPct.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {/* Grand total */}
      {order.lines.length > 0 && (
        <div className="mb-6 flex items-center justify-end gap-8 rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4">
          <div className="text-right">
            <p className="text-xs text-slate-500">Order total</p>
            <p className="text-xl font-bold text-amber-400">{fmtGbp(grandTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total margin</p>
            <p className="text-xl font-bold text-green-400">{fmtGbp(grandProfit)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Margin %</p>
            <p className="text-xl font-bold text-green-400">{grandMarginPct.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Invoice */}
      {order.status !== "cancelled" && (
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Invoice</p>
          <SendInvoiceButton
            orderId={order.id}
            stripeInvoiceId={order.stripeInvoiceId ?? null}
            invoicedAt={order.invoicedAt ?? null}
            contactEmail={order.contactEmail}
          />
          {!order.stripeInvoiceId && (
            <p className="mt-2 text-xs text-slate-500">Payment due in 14 days after sending.</p>
          )}
          {order.paidAt && (
            <p className="mt-2 text-xs text-green-400">
              Paid {order.paidAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      )}

      {/* Status update */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Update Status</p>
        <UpdateStatusButton orderId={order.id} currentStatus={order.status} />
      </div>

      {/* Delete */}
      <div className="mt-4 rounded-2xl border border-red-900/30 bg-red-950/10 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-700">Danger Zone</p>
        <DeleteOrderButton
          orderId={order.id}
          groupType={order.groupType}
          groupName={order.groupName}
        />
      </div>
    </div>
    </IbsaAppShell>
  );
}
