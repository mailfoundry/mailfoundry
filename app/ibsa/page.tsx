export const metadata = { title: "Dashboard" };

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
  if (days < 0) return <span className="text-gray-400 text-xs">–</span>;
  const colour =
    days <= 7
      ? "bg-red-100 text-red-600 border border-red-200"
      : days <= 14
      ? "bg-amber-100 text-amber-600 border border-amber-200"
      : "bg-green-100 text-green-600 border border-green-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${colour}`}>
      {days}d
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "complete")
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Complete</span>;
  if (status === "ordered")
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 border border-green-200">Ordered</span>;
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 border border-amber-200">Pending</span>;
}

function PaymentBadge({ paidAt, paymentDueDate }: { paidAt: Date | null; paymentDueDate: Date | null }) {
  if (paidAt)
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 border border-green-200">✓ Paid</span>;
  if (paymentDueDate) {
    const days = daysUntil(paymentDueDate);
    const colour = days <= 7 ? "text-red-600 border-red-200 bg-red-100" : "text-amber-600 border-amber-200 bg-amber-100";
    return <span className={`rounded-full px-2 py-0.5 text-xs border ${colour}`}>Due {fmtDate(paymentDueDate)}</span>;
  }
  return <span className="text-gray-400 text-xs">—</span>;
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
    where: { groupType: eventType, status: { notIn: ["complete", "cancelled"] } },
    orderBy: { submittedAt: "desc" },
    include: { lines: { include: { product: true } } },
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
      if (a.convention.id === b.convention.id) {
        return a.dept === "CS" ? -1 : 1;
      }
      const nameDiff = a.convention.name.localeCompare(b.convention.name);
      if (nameDiff !== 0) return nameDiff;
      return a.dept === "CS" ? -1 : 1;
    });

  const pastConventions = conventions.filter(
    (c) => c.conventionDate < now || c.status === "complete" || c.faStatus === "complete"
  );

  // Convention-level order items
  const convCsValue = conventions.reduce(
    (sum, c) =>
      sum + c.orderItems.filter((i) => i.dept !== "FA").reduce((s, i) => s + i.qty * i.product.unitCost, 0),
    0
  );
  const convFaValue = conventions.reduce(
    (sum, c) =>
      sum + c.orderItems.filter((i) => i.dept === "FA").reduce((s, i) => s + i.qty * i.product.unitCost, 0),
    0
  );
  const convProfit = conventions.reduce(
    (sum, c) =>
      sum +
      c.orderItems.reduce(
        (s, i) => s + i.qty * (i.product.unitCost - (i.product.xyloCost ?? i.product.unitCost)),
        0
      ),
    0
  );

  // Incoming group orders
  const orderCsValue = incomingOrders.reduce(
    (sum, o) =>
      sum + o.lines.filter((l) => l.dept === "CS").reduce((s, l) => s + l.qty * l.product.unitCost, 0),
    0
  );
  const orderFaValue = incomingOrders.reduce(
    (sum, o) =>
      sum + o.lines.filter((l) => l.dept === "FA").reduce((s, l) => s + l.qty * l.product.unitCost, 0),
    0
  );
  const orderProfit = incomingOrders.reduce(
    (sum, o) =>
      sum +
      o.lines.reduce(
        (s, l) => s + l.qty * (l.product.unitCost - (l.product.xyloCost ?? l.product.unitCost)),
        0
      ),
    0
  );

  const totalCsValue = convCsValue + orderCsValue;
  const totalFaValue = convFaValue + orderFaValue;
  const totalProfit  = convProfit  + orderProfit;
  const upcomingCount = conventions.filter((c) => c.conventionDate >= now).length;

  return (
    <IbsaAppShell active={config.active}>
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">IBSA · Xylo Supplies</p>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">{config.heading} 2026</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NewConventionButton eventType={eventType} />
            <Link
              href="/ibsa/orders"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Orders →
            </Link>
            <Link
              href="/ibsa/products"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Products →
            </Link>
          </div>
        </div>
      </header>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">Upcoming</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{upcomingCount}</p>
          <p className="mt-0.5 text-xs text-gray-400">conventions</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">CS Revenue</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">£{fmtGbp(totalCsValue)}</p>
          <p className="mt-0.5 text-xs text-gray-400">Cleaning Supplies</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">FA Revenue</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">£{fmtGbp(totalFaValue)}</p>
          <p className="mt-0.5 text-xs text-gray-400">First Aid</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Profit</p>
          <p className={`mt-1 text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
            £{fmtGbp(totalProfit)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">across all orders</p>
        </div>
      </div>

      {/* Upcoming — all depts mixed, sorted by collection date */}
      {upcomingCards.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
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
              const leftBorder = card.dept === "FA" ? "border-l-blue-400" : "border-l-orange-400";

              return (
                <div
                  key={`${card.convention.id}-${card.dept}`}
                  className={`rounded-2xl border border-gray-200 border-l-4 ${leftBorder} bg-white shadow-sm transition-colors hover:border-gray-300 hover:shadow-md`}
                >
                  {/* Main clickable area */}
                  <Link href={`/ibsa/conventions/${card.convention.id}`} className="block p-4 sm:p-5">
                    {/* Top row: name + badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-gray-900">{card.convention.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        card.dept === "FA"
                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                          : "bg-orange-100 text-orange-700 border border-orange-200"
                      }`}>
                        {card.dept === "FA" ? "First Aid" : "Cleaning Supplies"}
                      </span>
                      <StatusBadge status={card.status} />
                      <PaymentBadge paidAt={card.paidAt} paymentDueDate={card.paymentDueDate} />
                    </div>

                    {card.convention.venue && (
                      <p className="mt-0.5 text-xs text-gray-400">{card.convention.venue}</p>
                    )}

                    {/* Dates row */}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
                      <span>
                        <span>Conv</span>{" "}
                        <span className="font-medium text-gray-700">
                          {fmtDate(card.convention.conventionDate, { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </span>
                      {card.deliveryDate && (
                        <span>
                          <span>Del</span>{" "}
                          <span className="font-medium text-gray-700">{fmtDate(card.deliveryDate)}</span>
                        </span>
                      )}
                      {card.collectionDate && (
                        <span>
                          <span>Collect</span>{" "}
                          <span className="font-medium text-gray-700">{fmtDate(card.collectionDate)}</span>
                        </span>
                      )}
                    </div>

                    {/* Bottom row: value + countdowns */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        {value > 0 ? (
                          <>
                            <p className="text-base font-bold text-gray-900">£{fmtGbp(value)}</p>
                            <p className="text-xs text-green-600">£{fmtGbp(profit)} profit · {itemCount} lines</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">No order yet</p>
                        )}
                      </div>
                      <div className="flex gap-3">
                        {daysToCollection !== null && (
                          <div className="text-center">
                            <CountdownPill days={daysToCollection} />
                            <p className="mt-1 text-xs text-gray-400">collect</p>
                          </div>
                        )}
                        <div className="text-center">
                          <CountdownPill days={daysToConvention} />
                          <p className="mt-1 text-xs text-gray-400">conv</p>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Actions row — outside the link */}
                  <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-2.5">
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
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
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
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Past / Complete
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm opacity-70">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-500">
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
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        <Link href={`/ibsa/conventions/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {fmtDate(c.conventionDate, { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{csVal > 0 ? `£${fmtGbp(csVal)}` : "—"}</td>
                      <td className="px-5 py-3 text-gray-500">{faVal > 0 ? `£${fmtGbp(faVal)}` : "—"}</td>
                      <td className="px-5 py-3">
                        <form action={archiveConvention}>
                          <input type="hidden" name="conventionId" value={c.id} />
                          <button type="submit" className="text-xs text-gray-400 hover:text-red-500 transition-colors">
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
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Incoming Orders
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Group</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Lines</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Required by</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {incomingOrders.map((o, i) => {
                  const csCount = o.lines.filter((l) => l.dept === "CS").length;
                  const faCount = o.lines.filter((l) => l.dept === "FA").length;
                  const STATUS_STYLES: Record<string, string> = {
                    submitted:  "bg-blue-100 text-blue-700",
                    processing: "bg-amber-100 text-amber-700",
                    complete:   "bg-green-100 text-green-700",
                    cancelled:  "bg-gray-100 text-gray-500",
                  };
                  return (
                    <tr key={o.id} className={`${i > 0 ? "border-t border-gray-100" : ""} hover:bg-gray-50 transition-colors`}>
                      <td className="px-4 py-3">
                        <Link href={`/ibsa/orders/${o.id}`} className="block font-semibold text-gray-900 hover:text-orange-500 transition-colors">
                          {o.groupName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{o.contactName}</p>
                        <p className="text-xs text-gray-400">{o.contactEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {csCount > 0 && <span>{csCount} CS</span>}
                        {csCount > 0 && faCount > 0 && <span className="text-gray-300"> · </span>}
                        {faCount > 0 && <span>{faCount} FA</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{o.requiredBy ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {o.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
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
        </section>
      )}
    </IbsaAppShell>
  );
}
