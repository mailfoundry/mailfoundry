export const metadata = { title: "Orders" };

import Link from "next/link";
import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";

const STATUS_STYLES: Record<string, string> = {
  submitted:  "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  complete:   "bg-green-100 text-green-700",
  cancelled:  "bg-gray-100 text-gray-500",
};

const GROUP_LABELS: Record<string, string> = {
  congregation: "Congregation",
  circuit:      "Circuit Assembly",
  regional:     "Regional",
};

const fmtGbp = (n: number) =>
  "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function OrdersPage() {
  const orders = await prisma.ibsaGroupOrder.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      lines: {
        include: { product: { select: { unitCost: true, xyloCost: true } } },
      },
    },
  });

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const submittedCount  = orders.filter((o) => o.status === "submitted").length;
  const processingCount = orders.filter((o) => o.status === "processing").length;
  const totalRevenue    = orders.reduce((sum, o) => sum + o.lines.reduce((s, l) => s + l.qty * l.product.unitCost, 0), 0);
  const totalProfit     = orders.reduce((sum, o) => sum + o.lines.reduce((s, l) => s + l.qty * (l.product.unitCost - (l.product.xyloCost ?? l.product.unitCost)), 0), 0);

  return (
    <IbsaAppShell active="ibsa-orders">
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Public Orders</h1>
          <p className="mt-0.5 text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? "s" : ""} received</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">New</p>
          <p className={`mt-1 text-2xl font-bold ${submittedCount > 0 ? "text-orange-500" : "text-gray-900"}`}>{submittedCount}</p>
          <p className="mt-0.5 text-xs text-gray-400">awaiting action</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{processingCount}</p>
          <p className="mt-0.5 text-xs text-gray-400">being processed</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{fmtGbp(totalRevenue)}</p>
          <p className="mt-0.5 text-xs text-gray-400">across all orders</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Profit</p>
          <p className={`mt-1 text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-500"}`}>{fmtGbp(totalProfit)}</p>
          <p className="mt-0.5 text-xs text-gray-400">ex VAT</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-12 text-center">
          <p className="text-gray-500">No orders yet. Share <span className="text-gray-700">/order</span> to start receiving them.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Group</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Lines</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const csCount = o.lines.filter((l) => l.dept === "CS").length;
                const faCount = o.lines.filter((l) => l.dept === "FA").length;
                return (
                  <tr key={o.id} className={`${i > 0 ? "border-t border-gray-100" : ""} hover:bg-gray-50 transition-colors`}>
                    <td className="px-4 py-3">
                      <Link href={`/ibsa/orders/${o.id}`} className="block">
                        <p className="font-semibold text-gray-900">{o.groupName}</p>
                        <p className="text-xs text-gray-500">{GROUP_LABELS[o.groupType] ?? o.groupType}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{o.contactName}</p>
                      <p className="text-xs text-gray-400">{o.contactEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">
                        {csCount > 0 && <span>{csCount} CS</span>}
                        {csCount > 0 && faCount > 0 && <span className="text-gray-300"> · </span>}
                        {faCount > 0 && <span>{faCount} FA</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(o.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </IbsaAppShell>
  );
}
