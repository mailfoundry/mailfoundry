import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";

export const dynamic = "force-dynamic";

import IbsaAppShell from "../../../../src/components/ibsa-app-shell";
import UpdateStatusButton from "./UpdateStatusButton";
import SendInvoiceButton from "./SendInvoiceButton";
import DeleteOrderButton from "./DeleteOrderButton";
import { saveTrackingRef, saveAdminNotes } from "./actions";

type Props = { params: Promise<{ id: string }> };

const GROUP_LABELS: Record<string, string> = {
  congregation: "Congregation",
  circuit:      "Circuit Assembly",
  regional:     "Regional",
};

const STATUS_STYLES: Record<string, string> = {
  submitted:  "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  complete:   "bg-green-100 text-green-700",
  cancelled:  "bg-gray-100 text-gray-500",
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
        <Link href="/ibsa/orders" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Orders
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{order.groupName}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{GROUP_LABELS[order.groupType] ?? order.groupType} · {fmtDate(order.submittedAt)}</p>
        </div>
        <span className={`shrink-0 inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-500"}`}>
          {order.status}
        </span>
      </div>

      {/* Contact & delivery */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</p>
          <p className="font-semibold text-gray-900">{order.contactName}</p>
          <p className="text-sm text-gray-500">{order.contactEmail}</p>
          {order.contactMobile && <p className="text-sm text-gray-500">{order.contactMobile}</p>}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Required By</p>
          <p className="text-sm text-gray-700">{order.requiredBy ?? "As soon as possible"}</p>
        </div>
        {order.deliveryAddress && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Delivery Address</p>
            <p className="whitespace-pre-line text-sm text-gray-700">{order.deliveryAddress}</p>
          </div>
        )}
        {order.paymentMethod && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Payment Preference</p>
            <p className="text-sm text-gray-700">
              {{ bacs: "BACS Transfer", card: "Credit / Debit Card", po: "Purchase Order" }[order.paymentMethod] ?? order.paymentMethod}
            </p>
          </div>
        )}
        {order.notes && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Notes</p>
            <p className="text-sm text-gray-700">{order.notes}</p>
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Code</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Product</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Sale</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Cost</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Line Sale</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Margin £</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Margin %</th>
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
                      <tr key={l.id} className={i > 0 ? "border-t border-gray-100" : ""}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{l.product.code}</td>
                        <td className="px-4 py-3 text-gray-900">
                          {l.product.name}
                          {l.product.variant && (
                            <span className="ml-1.5 text-xs text-gray-400">{l.product.variant}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtGbp(sale)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{fmtGbp(cost)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{l.qty}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtGbp(lineTotal)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmtGbp(margin)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{marginPct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {label} total
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-500">{fmtGbp(sectionTotal)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{fmtGbp(sectionProfit)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{sectionPct.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {/* Grand total */}
      {order.lines.length > 0 && (
        <div className="mb-6 flex items-center justify-end gap-8 rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Order total</p>
            <p className="text-xl font-bold text-orange-500">{fmtGbp(grandTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Total margin</p>
            <p className="text-xl font-bold text-green-600">{fmtGbp(grandProfit)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Margin %</p>
            <p className="text-xl font-bold text-green-600">{grandMarginPct.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Invoice */}
      {order.status !== "cancelled" && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Invoice</p>
          <SendInvoiceButton
            orderId={order.id}
            stripeInvoiceId={order.stripeInvoiceId ?? null}
            invoicedAt={order.invoicedAt ?? null}
            contactEmail={order.contactEmail}
          />
          {!order.stripeInvoiceId && (
            <p className="mt-2 text-xs text-gray-400">Payment due in 14 days after sending.</p>
          )}
          {order.paidAt && (
            <p className="mt-2 text-xs text-green-600">
              Paid {order.paidAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      )}

      {/* Dispatch tracking */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Dispatch & Tracking</p>
        <form action={saveTrackingRef} className="flex items-center gap-3">
          <input type="hidden" name="orderId" value={order.id} />
          <input
            type="text"
            name="trackingRef"
            defaultValue={order.trackingRef ?? ""}
            placeholder="e.g. 1Z999AA10123456784"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            {order.trackingRef ? "Update" : "Save & notify customer"}
          </button>
        </form>
        {order.trackingRef && (
          <p className="mt-2 text-xs text-gray-400">
            Current: <span className="font-mono text-gray-600">{order.trackingRef}</span> — customer has been notified.
          </p>
        )}
      </div>

      {/* Admin notes */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Internal Notes</p>
        <form action={saveAdminNotes} className="space-y-2">
          <input type="hidden" name="orderId" value={order.id} />
          <textarea
            name="adminNotes"
            defaultValue={order.adminNotes ?? ""}
            rows={3}
            placeholder="e.g. spoke to contact on 26 Jul, confirmed delivery for Wednesday…"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400 resize-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Save notes
          </button>
        </form>
      </div>

      {/* Status update */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Update Status</p>
        <UpdateStatusButton orderId={order.id} currentStatus={order.status} />
      </div>

      {/* Delete */}
      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-600">Danger Zone</p>
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
