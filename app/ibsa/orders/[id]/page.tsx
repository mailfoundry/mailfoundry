import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";

export const dynamic = "force-dynamic";

import IbsaAppShell from "../../../../src/components/ibsa-app-shell";
import UpdateStatusButton from "./UpdateStatusButton";
import SendInvoiceButton from "./SendInvoiceButton";
import { deleteOrder } from "./actions";

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

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <IbsaAppShell active="ibsa-orders">
    <div className="p-6 max-w-3xl">
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
      {[{ label: "Cleaning Supplies", lines: csLines }, { label: "First Aid", lines: faLines }].map(({ label, lines }) =>
        lines.length === 0 ? null : (
          <div key={label} className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {lines.map((l, i) => (
                <div key={l.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-slate-800" : ""}`}>
                  <div>
                    <p className="font-medium text-white">{l.product.name}{l.product.variant ? ` — ${l.product.variant}` : ""}</p>
                    <p className="text-xs text-slate-500">{l.product.code}</p>
                  </div>
                  <span className="rounded-lg bg-slate-800 px-3 py-1 text-sm font-bold text-white">×{l.qty}</span>
                </div>
              ))}
            </div>
          </div>
        )
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
        <form action={deleteOrder}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="groupType" value={order.groupType} />
          <button type="submit"
            className="rounded-lg border border-red-800/50 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-900/30 transition-colors"
            onClick={(e) => { if (!confirm(`Delete order from "${order.groupName}"? This cannot be undone.`)) e.preventDefault(); }}>
            Delete order
          </button>
        </form>
      </div>
    </div>
    </IbsaAppShell>
  );
}
