import Link from "next/link";
import { prisma } from "../../src/lib/prisma";
import AppShell from "../../src/components/app-shell";

function statusBadge(status: string, conventionDate: Date) {
  const isPast = conventionDate < new Date();
  if (isPast && status === "pending") {
    return { label: "Complete", className: "bg-slate-500/10 text-slate-400" };
  }
  if (status === "complete") {
    return { label: "Complete", className: "bg-slate-500/10 text-slate-400" };
  }
  if (status === "ordered") {
    return { label: "Ordered", className: "bg-green-500/10 text-green-400" };
  }
  return { label: "Pending", className: "bg-amber-500/10 text-amber-400" };
}

export default async function IbsaPage() {
  const conventions = await prisma.ibsaConvention.findMany({
    orderBy: { conventionDate: "asc" },
    include: {
      _count: { select: { orderItems: true } },
      orderItems: { select: { qty: true, product: { select: { unitCost: true } } } },
    },
  });

  const now = new Date();
  const upcoming = conventions.filter((c) => c.conventionDate >= now);
  const past = conventions.filter((c) => c.conventionDate < now);
  const ordered = conventions.filter((c) => c.status === "ordered");

  return (
    <AppShell active="ibsa">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">IBSA · Xylo Supplies</p>
          <h2 className="text-3xl font-bold">Conventions 2026</h2>
        </div>
      </header>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Total Conventions</p>
          <p className="mt-1 text-3xl font-bold">{conventions.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Upcoming</p>
          <p className="mt-1 text-3xl font-bold text-amber-400">{upcoming.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Orders Placed</p>
          <p className="mt-1 text-3xl font-bold text-green-400">{ordered.length}</p>
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-4 text-lg font-semibold text-slate-300">Upcoming</h3>
          <ConventionTable conventions={upcoming} />
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h3 className="mb-4 text-lg font-semibold text-slate-500">Past / Complete</h3>
          <ConventionTable conventions={past} muted />
        </section>
      )}
    </AppShell>
  );
}

type ConventionWithCounts = Awaited<
  ReturnType<typeof prisma.ibsaConvention.findMany>
>[number] & {
  _count: { orderItems: number };
  orderItems: { qty: number; product: { unitCost: number } }[];
};

function ConventionTable({
  conventions,
  muted = false,
}: {
  conventions: ConventionWithCounts[];
  muted?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
          <tr>
            <th className="px-6 py-4 font-medium">Convention</th>
            <th className="px-6 py-4 font-medium">Venue</th>
            <th className="px-6 py-4 font-medium">Date</th>
            <th className="px-6 py-4 font-medium">Delivery</th>
            <th className="px-6 py-4 font-medium">Items</th>
            <th className="px-6 py-4 font-medium">Order Value</th>
            <th className="px-6 py-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {conventions.map((c) => {
            const badge = statusBadge(c.status, c.conventionDate);
            const totalValue = c.orderItems.reduce(
              (sum, item) => sum + item.qty * item.product.unitCost,
              0
            );
            const itemCount = c.orderItems.filter((i) => i.qty > 0).length;
            return (
              <tr
                key={c.id}
                className={`border-t border-slate-800 ${muted ? "opacity-50" : ""}`}
              >
                <td className="px-6 py-4 font-medium">
                  <Link
                    href={`/ibsa/conventions/${c.id}`}
                    className="hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-slate-400">{c.venue ?? "—"}</td>
                <td className="px-6 py-4 text-slate-300">
                  {c.conventionDate.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-6 py-4 text-slate-400">
                  {c.deliveryDate
                    ? c.deliveryDate.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {itemCount > 0 ? itemCount : "—"}
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {totalValue > 0
                    ? `£${totalValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
