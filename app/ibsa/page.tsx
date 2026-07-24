import Link from "next/link";
import { prisma } from "../../src/lib/prisma";

export const dynamic = "force-dynamic";
import IbsaAppShell from "../../src/components/ibsa-app-shell";
import { archiveConvention } from "./actions";
import NewConventionButton from "./NewConventionButton";
import OverviewCompleteButton from "./OverviewCompleteButton";

const fmtDate = (d: Date, opts?: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString("en-GB", opts ?? { day: "numeric", month: "short" });

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function daysUntil(d: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil(
    (new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / msPerDay
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

function StatusBadge({ status }: { status: string }) {
  if (status === "complete")
    return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">Complete</span>;
  if (status === "ordered")
    return <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400 border border-green-800/50">Ordered</span>;
  return <span className="rounded-full bg-amber-900/30 px-2 py-0.5 text-xs text-amber-400 border border-amber-800/40">Pending</span>;
}

function PaymentBadge({ paidAt, paymentDueDate }: { paidAt: Date | null; paymentDueDate: Date | null }) {
  if (paidAt)
    return <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400 border border-green-800/50">✓ Paid</span>;
  if (paymentDueDate) {
    const days = daysUntil(paymentDueDate);
    const colour = days <= 7 ? "text-red-400 border-red-800/40 bg-red-950/30" : "text-amber-400 border-amber-800/40 bg-amber-950/30";
    return <span className={`rounded-full px-2 py-0.5 text-xs border ${colour}`}>Due {fmtDate(paymentDueDate)}</span>;
  }
  return <span className="text-slate-600 text-xs">—</span>;
}

const EVENT_TYPE_CONFIG = {
  regional:     { label: "Regionals",          heading: "Regional Conventions", active: "ibsa"                as const },
  circuit:      { label: "Circuit Assemblies", heading: "Circuit Assemblies",   active: "ibsa-circuits"       as const },
  congregation: { label: "Congregations",      heading: "Congregations",        active: "ibsa-congregations"  as const },
};

type Props = { searchParams: Promise<{ type?: string }> };

export default async function IbsaPage({ searchParams }: Props) {
  const { type } = await searchParams;
  const eventType = (type === "circuit" || type === "congregation") ? type : "regional";
  const config = EVENT_TYPE_CONFIG[eventType];

  const [conventions, incomingOrders] = await Promise.all([
   prisma.ibsaConvention.findMany({
    where: { archivedAt: null, eventType },
    orderBy: { conventionDate: "asc" },
    include: {
      _count: { select: { orderItems: true } },
      orderItems: {
        select: {
          qty: true,
          dept: true,
          product: { select: { unitCost: true, xyloCost: true, type: true } },
        },
      },
    },
   }),
   prisma.ibsaGroupOrder.findMany({
    where: { groupType: eventType },
    orderBy: { submittedAt: "desc" },
    include: { lines: true },
   }),
  ]);

  const now = new Date();

  // Build flat card list — one CS card + one FA card per convention (where applicable)
  type CardData = {
    convention: (typeof conventions)[number];
    dept: "CS" | "FA";
    status: string;
    paidAt: Date | null;
    paymentDueDate: Date | null;
    collectionDate: Date | null;
    deliveryDate: Date | null;
    items: { qty: number; unitCost: number; xyloCost: number | null }[];
    sortDate: Date | null;
  };

  const allCards: CardData[] = [];

  for (const c of conventions) {
    const csItems = c.orderItems
      .filter((i) => i.dept !== "FA")
      .map((i) => ({ qty: i.qty, unitCost: i.product.unitCost, xyloCost: i.product.xyloCost }));
    const faItems = c.orderItems
      .filter((i) => i.dept === "FA")
      .map((i) => ({ qty: i.qty, unitCost: i.product.unitCost, xyloCost: i.product.xyloCost }));

    // CS card: show when convention has CS items, OR when FA is not enabled
    // (avoids a blank CS card appearing on FA-only conventions)
    if (csItems.length > 0 || !c.faEnabled) {
      allCards.push({
        convention: c,
        dept: "CS",
        status: c.status,
        paidAt: c.paidAt,
        paymentDueDate: c.paymentDueDate,
        collectionDate: c.collectionDate,
        deliveryDate: c.deliveryDate,
        items: csItems,
        sortDate: c.collectionDate,
      });
    }

    // FA card: show when faEnabled, or when FA items/logistics dates exist
    if (c.faEnabled || faItems.length > 0 || c.faCollectionDate || c.faPaymentDueDate) {
      allCards.push({
        convention: c,
        dept: "FA",
        status: c.faStatus,
        paidAt: c.faPaidAt,
        paymentDueDate: c.faPaymentDueDate,
        collectionDate: c.faCollectionDate,
        deliveryDate: c.faDeliveryDate,
        items: faItems,
        sortDate: c.faCollectionDate,
      });
    }
  }

  // Earliest meaningful date for a convention — used to group CS+FA pairs together
  const convSortKey = (card: CardData): number => {
    const dates = [
      card.convention.collectionDate,
      card.convention.faCollectionDate,
      card.convention.conventionDate,
    ].filter((d): d is Date => !!d).map((d) => new Date(d).getTime());
    return dates.length ? Math.min(...dates) : Infinity;
  };

  const upcomingCards = allCards
    .filter((card) => card.convention.conventionDate >= now && card.status !== "complete")
    .sort((a, b) => {
      const keyDiff = convSortKey(a) - convSortKey(b);
      if (keyDiff !== 0) return keyDiff;
      // Same convention record: CS before FA
      if (a.convention.id === b.convention.id) {
        return a.dept === "CS" ? -1 : 1;
      }
      // Different conventions tied on date: group by name so e.g. Glasgow CS + Glasgow FA stay adjacent
      const nameDiff = a.convention.name.localeCompare(b.convention.name);
      if (nameDiff !== 0) return nameDiff;
      // Same name, different IDs: CS before FA
      return a.dept === "CS" ? -1 : 1;
    });

  const pastConventions = conventions.filter(
    (c) => c.conventionDate < now || c.status === "complete" || c.faStatus === "complete"
  );

  // Stats
  const totalCsValue = conventions.reduce(
    (sum, c) =>
      sum + c.orderItems.filter((i) => i.dept !== "FA").reduce((s, i) => s + i.qty * i.product.unitCost, 0),
    0
  );
  const totalFaValue = conventions.reduce(
    (sum, c) =>
      sum + c.orderItems.filter((i) => i.dept === "FA").reduce((s, i) => s + i.qty * i.product.unitCost, 0),
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
  const upcomingCount = conventions.filter((c) => c.conventionDate >= now).length;

  return (
    <IbsaAppShell active={config.active}>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">IBSA · Xylo Supplies</p>
          <h2 className="text-3xl font-bold">{config.heading} 2026</h2>
        </div>
        <div className="flex items-center gap-3">
          <NewConventionButton eventType={eventType} />
          <Link
            href="/ibsa/orders"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Orders →
          </Link>
          <Link
            href="/ibsa/products"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Products →
          </Link>
        </div>
      </header>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Upcoming</p>
          <p className="mt-1 text-2xl font-bold">{upcomingCount}</p>
          <p className="mt-0.5 text-xs text-slate-600">conventions</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">CS Revenue</p>
          <p className="mt-1 text-2xl font-bold">£{fmtGbp(totalCsValue)}</p>
          <p className="mt-0.5 text-xs text-slate-600">Cleaning Supplies</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">FA Revenue</p>
          <p className="mt-1 text-2xl font-bold">£{fmtGbp(totalFaValue)}</p>
          <p className="mt-0.5 text-xs text-slate-600">First Aid</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Total Profit</p>
          <p className={`mt-1 text-2xl font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            £{fmtGbp(totalProfit)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">across all orders</p>
        </div>
      </div>

      {/* Upcoming — all depts mixed, sorted by collection date */}
      {upcomingCards.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Upcoming — sorted by collection date
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {upcomingCards.map((card) => {
              const value = card.items.reduce((s, i) => s + i.qty * i.unitCost, 0);
              const profit = card.items.reduce(
                (s, i) => s + i.qty * (i.unitCost - (i.xyloCost ?? i.unitCost)),
                0
              );
              const itemCount = card.items.filter((i) => i.qty > 0).length;
              const daysToCollection = card.collectionDate ? daysUntil(card.collectionDate) : null;
              const daysToConvention = daysUntil(card.convention.conventionDate);
              const leftBorder = card.dept === "FA" ? "border-l-blue-700/60" : "border-l-orange-700/60";

              return (
                <div
                  key={`${card.convention.id}-${card.dept}`}
                  className={`flex rounded-2xl border border-slate-800 border-l-4 ${leftBorder} bg-slate-900 transition-colors hover:border-slate-700 hover:bg-slate-800/60`}
                >
                  {/* Main clickable area */}
                  <Link href={`/ibsa/conventions/${card.convention.id}`} className="flex flex-1 items-center gap-4 p-5">
                    {/* Left: name, badges, dates */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-white">{card.convention.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          card.dept === "FA"
                            ? "bg-blue-900/40 text-blue-300 border border-blue-800/50"
                            : "bg-orange-900/30 text-orange-300 border border-orange-800/40"
                        }`}>
                          {card.dept === "FA" ? "First Aid" : "Cleaning Supplies"}
                        </span>
                        <StatusBadge status={card.status} />
                        <PaymentBadge paidAt={card.paidAt} paymentDueDate={card.paymentDueDate} />
                      </div>
                      {card.convention.venue && (
                        <p className="mt-0.5 text-xs text-slate-500">{card.convention.venue}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-400">
                        <span>
                          <span className="text-slate-600">Convention</span>{" "}
                          <span className="font-medium text-slate-300">
                            {fmtDate(card.convention.conventionDate, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </span>
                        {card.deliveryDate && (
                          <span>
                            <span className="text-slate-600">Delivery</span>{" "}
                            <span className="font-medium text-slate-300">{fmtDate(card.deliveryDate)}</span>
                          </span>
                        )}
                        {card.collectionDate && (
                          <span>
                            <span className="text-slate-600">Collection</span>{" "}
                            <span className="font-medium text-slate-300">{fmtDate(card.collectionDate)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: value + countdowns */}
                    <div className="flex shrink-0 items-center gap-6">
                      {value > 0 ? (
                        <div className="text-right">
                          <p className="text-base font-bold text-white">£{fmtGbp(value)}</p>
                          <p className="text-xs text-green-400">£{fmtGbp(profit)} profit</p>
                          <p className="text-xs text-slate-500">{itemCount} lines</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600">No order yet</p>
                      )}
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
                  </Link>

                  {/* Actions column — outside the link so clicks don't navigate */}
                  <div className="flex shrink-0 flex-col items-end justify-center gap-2 border-l border-slate-800 px-4">
                    <OverviewCompleteButton
                      conventionId={card.convention.id}
                      conventionName={card.convention.name}
                      dept={card.dept}
                      itemCount={card.items.filter((i) => i.qty > 0).length}
                    />
                    {card.dept === "CS" && (
                      <form action={archiveConvention}>
                        <input type="hidden" name="conventionId" value={card.convention.id} />
                        <button
                          type="submit"
                          className="text-xs text-slate-700 hover:text-red-400 transition-colors"
                        >
                          Hide
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Past conventions */}
      {pastConventions.length > 0 && (
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
                  <th className="px-5 py-3 font-medium">CS</th>
                  <th className="px-5 py-3 font-medium">FA</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pastConventions.map((c) => {
                  const csVal = c.orderItems
                    .filter((i) => i.product.type === "CS")
                    .reduce((s, i) => s + i.qty * i.product.unitCost, 0);
                  const faVal = c.orderItems
                    .filter((i) => i.product.type === "FA")
                    .reduce((s, i) => s + i.qty * i.product.unitCost, 0);
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
                      <td className="px-5 py-3 text-slate-400">{csVal > 0 ? `£${fmtGbp(csVal)}` : "—"}</td>
                      <td className="px-5 py-3 text-slate-400">{faVal > 0 ? `£${fmtGbp(faVal)}` : "—"}</td>
                      <td className="px-5 py-3">
                        <form action={archiveConvention}>
                          <input type="hidden" name="conventionId" value={c.id} />
                          <button type="submit" className="text-xs text-slate-600 hover:text-red-400 transition-colors">
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

      {/* Incoming public orders */}
      {incomingOrders.length > 0 && (
        <section className="mt-10">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Incoming Orders
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Group</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Lines</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Required by</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {incomingOrders.map((o, i) => {
                  const csCount = o.lines.filter((l) => l.dept === "CS").length;
                  const faCount = o.lines.filter((l) => l.dept === "FA").length;
                  const STATUS_STYLES: Record<string, string> = {
                    submitted:  "bg-blue-900/40 text-blue-300",
                    processing: "bg-amber-900/40 text-amber-300",
                    complete:   "bg-green-900/40 text-green-300",
                    cancelled:  "bg-slate-800 text-slate-500",
                  };
                  return (
                    <tr key={o.id} className={`${i > 0 ? "border-t border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}>
                      <td className="px-4 py-3">
                        <Link href={`/ibsa/orders/${o.id}`} className="block font-semibold text-white hover:text-orange-400 transition-colors">
                          {o.groupName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-300">{o.contactName}</p>
                        <p className="text-xs text-slate-500">{o.contactEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {csCount > 0 && <span>{csCount} CS</span>}
                        {csCount > 0 && faCount > 0 && <span className="text-slate-600"> · </span>}
                        {faCount > 0 && <span>{faCount} FA</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{o.requiredBy ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {o.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[o.status] ?? "bg-slate-800 text-slate-400"}`}>
                          {o.status}
                        </span>
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
