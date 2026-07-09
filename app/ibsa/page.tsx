import Link from "next/link";
import { prisma } from "../../src/lib/prisma";
import IbsaAppShell from "../../src/components/ibsa-app-shell";
import { archiveConvention } from "./actions";

const fmtDate = (d: Date, opts?: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString("en-GB", opts ?? { day: "numeric", month: "short" });

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function daysUntil(d: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const now = new Date();
  return Math.ceil(
    (d.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / msPerDay
  );
}

function CountdownPill({ days }: { days: number }) {
  if (days < 0) return <span className="text-slate-600 text-xs">–</span>;
  const colour =
    days <= 7
      ? "bg-red-950/40 text-red-400 border border-red-700/40"
      : days <= 14
      ? "bg-amber-950/40 text-amber-400 border border-amber-700/40"
      : "bg-green-950/30 text-green-400 border border-green-800/40";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${colour}`}>
      {days}d
    </span>
  );
}

function StatusBadge({ status, isPast }: { status: string; isPast: boolean }) {
  if (isPast || status === "complete")
    return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">Complete</span>;
  if (status === "ordered")
    return <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400 border border-green-800/50">Ordered</span>;
  return <span className="rounded-full bg-amber-900/30 px-2 py-0.5 text-xs text-amber-400 border border-amber-800/40">Pending</span>;
}

function PaymentBadge({ paidAt, paymentDueDate }: { paidAt: Date | null; paymentDueDate: Date | null }) {
  if (paidAt) {
    return <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400 border border-green-800/50">✓ Paid</span>;
  }
  if (paymentDueDate) {
    const days = daysUntil(new Date(paymentDueDate));
    const colour = days <= 7 ? "text-red-400 border-red-800/40 bg-red-950/30" : "text-amber-400 border-amber-800/40 bg-amber-950/30";
    return <span className={`rounded-full px-2 py-0.5 text-xs border ${colour}`}>Due {fmtDate(paymentDueDate)}</span>;
  }
  return <span className="text-slate-600 text-xs">—</span>;
}

export default async function IbsaPage() {
  const conventions = await prisma.ibsaConvention.findMany({
    where: { archivedAt: null },
    orderBy: { conventionDate: "asc" },
    include: {
      _count: { select: { orderItems: true } },
      orderItems: {
        select: {
          qty: true,
          product: { select: { unitCost: true, xyloCost: true } },
        },
      },
    },
  });

  const now = new Date();
  const upcoming = conventions
    .filter((c) => c.conventionDate >= now)
    .sort((a, b) => {
      // Sort by collection date ascending; nulls (no collection date set) go last
      if (!a.collectionDate && !b.collectionDate) return 0;
      if (!a.collectionDate) return 1;
      if (!b.collectionDate) return -1;
      return a.collectionDate.getTime() - b.collectionDate.getTime();
    });
  const past = conventions.filter((c) => c.conventionDate < now);

  const totalValue = conventions.reduce(
    (sum, c) => sum + c.orderItems.reduce((s, i) => s + i.qty * i.product.unitCost, 0),
    0
  );
  const totalProfit = conventions.reduce(
    (sum, c) =>
      sum +
      c.orderItems.reduce(
        (s, i) => s + i.qty * (i.product.unitCost - (i.product.xyloCost ?? i.product.unitCost)),
        0
      ),
    0
  );
  const unpaidCount = upcoming.filter((c) => !c.paidAt).length;
  const orderedCount = conventions.filter((c) => c.status === "ordered").length;

  return (
    <IbsaAppShell active="ibsa">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">IBSA · Xylo Supplies</p>
          <h2 className="text-3xl font-bold">Conventions 2026</h2>
        </div>
        <Link
          href="/ibsa/products"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Products →
        </Link>
      </header>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Upcoming</p>
          <p className="mt-1 text-2xl font-bold">{upcoming.length}</p>
          <p className="mt-0.5 text-xs text-slate-600">{orderedCount} ordered</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold">£{fmtGbp(totalValue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Total Profit</p>
          <p className={`mt-1 text-2xl font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            £{fmtGbp(totalProfit)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Awaiting Payment</p>
          <p className={`mt-1 text-2xl font-bold ${unpaidCount > 0 ? "text-amber-400" : "text-slate-400"}`}>
            {unpaidCount}
          </p>
        </div>
      </div>

      {/* Upcoming conventions */}
      {upcoming.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Upcoming — sorted by date
          </h3>
          <ConventionCards conventions={upcoming} />
        </section>
      )}

      {/* Past conventions */}
      {past.length > 0 && (
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Past / Complete
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 opacity-60">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-800 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Convention</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Revenue</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {past.map((c) => {
                  const value = c.orderItems.reduce((s, i) => s + i.qty * i.product.unitCost, 0);
                  return (
                    <tr key={c.id} className="border-t border-slate-800">
                      <td className="px-5 py-3 font-medium">
                        <Link href={`/ibsa/conventions/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {fmtDate(c.conventionDate, { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {value > 0 ? `£${fmtGbp(value)}` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <PaymentBadge paidAt={c.paidAt} paymentDueDate={c.paymentDueDate} />
                      </td>
                      <td className="px-5 py-3">
                        <form action={archiveConvention}>
                          <input type="hidden" name="conventionId" value={c.id} />
                          <button
                            type="submit"
                            className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </IbsaAppShell>
  );
}

type Convention = Awaited<ReturnType<typeof prisma.ibsaConvention.findMany>>[number] & {
  _count: { orderItems: number };
  orderItems: { qty: number; product: { unitCost: number; xyloCost: number | null } }[];
};

function ConventionCards({ conventions }: { conventions: Convention[] }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {conventions.map((c) => {
        const now = new Date();
        const isPast = c.conventionDate < now;
        const value = c.orderItems.reduce((s, i) => s + i.qty * i.product.unitCost, 0);
        const profit = c.orderItems.reduce(
          (s, i) => s + i.qty * (i.product.unitCost - (i.product.xyloCost ?? i.product.unitCost)),
          0
        );
        const itemCount = c.orderItems.filter((i) => i.qty > 0).length;
        const daysToCollection = c.collectionDate ? daysUntil(new Date(c.collectionDate)) : null;
        const daysToConvention = daysUntil(new Date(c.conventionDate));

        return (
          <div key={c.id} className="relative rounded-2xl border border-slate-800 bg-slate-900 transition-colors hover:border-slate-700 hover:bg-slate-800/60">
            {/* Hide button */}
            <form action={archiveConvention} className="absolute right-3 top-3 z-10">
              <input type="hidden" name="conventionId" value={c.id} />
              <button
                type="submit"
                title="Hide this convention"
                className="rounded px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-800 hover:text-red-400 transition-colors"
              >
                Hide
              </button>
            </form>

            <Link href={`/ibsa/conventions/${c.id}`} className="block p-5">
              <div className="flex items-start justify-between gap-4">
                {/* Left: name + venue + badges */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-white">{c.name}</span>
                    <StatusBadge status={c.status} isPast={isPast} />
                    <PaymentBadge paidAt={c.paidAt} paymentDueDate={c.paymentDueDate} />
                  </div>
                  {c.venue && <p className="mt-0.5 text-xs text-slate-500">{c.venue}</p>}

                  {/* Date row */}
                  <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-400">
                    <span>
                      <span className="text-slate-600">Convention</span>{" "}
                      <span className="font-medium text-slate-300">
                        {fmtDate(c.conventionDate, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </span>
                    {c.deliveryDate && (
                      <span>
                        <span className="text-slate-600">Delivery</span>{" "}
                        <span className="font-medium text-slate-300">{fmtDate(c.deliveryDate)}</span>
                      </span>
                    )}
                    {c.collectionDate && (
                      <span>
                        <span className="text-slate-600">Collection</span>{" "}
                        <span className="font-medium text-slate-300">{fmtDate(c.collectionDate)}</span>
                      </span>
                    )}
                    {c.contactName && (
                      <span>
                        <span className="text-slate-600">Contact</span>{" "}
                        <span className="font-medium text-slate-300">{c.contactName}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: financials + countdowns */}
                <div className="flex shrink-0 items-center gap-6 pr-10">
                  {/* Financials */}
                  {value > 0 && (
                    <div className="text-right">
                      <p className="text-base font-bold text-white">£{fmtGbp(value)}</p>
                      <p className="text-xs text-green-400">£{fmtGbp(profit)} profit</p>
                      <p className="text-xs text-slate-500">{itemCount} lines</p>
                    </div>
                  )}

                  {/* Countdowns */}
                  <div className="flex gap-3">
                    {daysToCollection !== null && (
                      <div className="text-center">
                        <CountdownPill days={daysToCollection} />
                        <p className="mt-1 text-xs text-slate-600">collect</p>
                      </div>
                    )}
                    <div className="text-center">
                      <CountdownPill days={daysToConvention} />
                      <p className="mt-1 text-xs text-slate-600">conv</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
