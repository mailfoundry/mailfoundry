import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";

export const dynamic = "force-dynamic";
import IbsaAppShell from "../../../../src/components/ibsa-app-shell";
import {
  updateConventionStatus,
  updateLogistics,
  updateFaLogistics,
  updateNotes,
  markPaid,
  markUnpaid,
  markFaPaid,
  markFaUnpaid,
  updateFaStatus,
  enableFa,
} from "./actions";
import { updateConventionDetails } from "../../actions";
import ConventionProductTable from "./ConventionProductTable";
import CountdownBadge from "./CountdownBadge";
import CompleteButton from "./CompleteButton";
import type { StockItem } from "./CompleteButton";
import SendOrderLinkButton from "./SendOrderLinkButton";
import DateCard from "./DateCard";
import ShippingCostCard from "./ShippingCostCard";
import ConventionImportButton from "./ConventionImportButton";
import DeleteConventionButton from "./DeleteConventionButton";

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const toInput = (d: Date | null | undefined) =>
  d ? d.toISOString().split("T")[0] : "";

export default async function ConventionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const convention = await prisma.ibsaConvention.findUnique({
    where: { id },
    include: { orderItems: { include: { product: true } } },
  });

  if (!convention) notFound();

  // Normalise variant string → size rank. Handles compound variants like "Blue / Large"
  // by scanning each token so "Blue / Large" → ["blue","large"] → rank 3.
  function sizeRank(v: string | null): number {
    if (!v) return 99;
    const sizeMap: Record<string, number> = {
      s: 1, small: 1,
      m: 2, medium: 2, med: 2,
      l: 3, large: 3,
      xl: 4, xlarge: 4, extralarge: 4,
      xxl: 5, xxlarge: 5, extraextralarge: 5,
      xxxl: 6, xxxlarge: 6,
    };
    const tokens = v.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    let best = 99;
    for (const t of tokens) {
      const r = sizeMap[t];
      if (r !== undefined && r < best) best = r;
    }
    return best;
  }

  const allProducts = (await prisma.ibsaProduct.findMany({
    orderBy: [{ type: "asc" }, { category: "asc" }, { name: "asc" }],
  })).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return sizeRank(a.variant) - sizeRank(b.variant);
  });

  const csQtyMap: Record<string, number> = {};
  const faQtyMap: Record<string, number> = {};
  for (const item of convention.orderItems) {
    if (item.dept === "FA") {
      faQtyMap[item.productId] = (faQtyMap[item.productId] ?? 0) + item.qty;
    } else {
      csQtyMap[item.productId] = (csQtyMap[item.productId] ?? 0) + item.qty;
    }
  }

  const allProductRows = allProducts.map(({ id, code, name, variant, unitCost, xyloCost, category, type }) => ({
    id, code, name, variant, unitCost, xyloCost, category, type,
  }));

  const csProductRows = allProductRows.filter((p) => p.type === "CS");
  const faProductRows = allProductRows.filter(
    (p) => p.type === "FA" || (faQtyMap[p.id] ?? 0) > 0
  );

  const csItems = convention.orderItems.filter((i) => i.dept !== "FA");
  const faItems = convention.orderItems.filter((i) => i.dept === "FA");

  const csOverrideMap: Record<string, number> = {};
  const faOverrideMap: Record<string, number> = {};

  const topItems = csItems.length > 0 ? csItems : faItems;
  const orderSaleTotal = topItems.reduce((sum, item) => sum + item.qty * item.product.unitCost, 0);
  const orderCostTotal = topItems.reduce(
    (sum, item) => sum + item.qty * (item.product.xyloCost ?? item.product.unitCost),
    0
  );
  const orderProfit = orderSaleTotal - orderCostTotal;
  const orderMarginPct = orderSaleTotal > 0 ? (orderProfit / orderSaleTotal) * 100 : 0;
  const itemsWithQty = topItems.filter((i) => i.qty > 0).length;

  const faSaleTotal = faItems.reduce((sum, item) => sum + item.qty * item.product.unitCost, 0);
  const faCostTotal = faItems.reduce(
    (sum, item) => sum + item.qty * (item.product.xyloCost ?? item.product.unitCost),
    0
  );
  const faProfit = faSaleTotal - faCostTotal;
  const faItemsWithQty = faItems.filter((i) => i.qty > 0).length;

  const csStockItems: StockItem[] = csItems
    .filter((i) => i.qty > 0)
    .map((i) => ({ name: i.product.name, variant: i.product.variant ?? null, qty: i.qty }));

  const faStockItems: StockItem[] = faItems
    .filter((i) => i.qty > 0)
    .map((i) => ({ name: i.product.name, variant: i.product.variant ?? null, qty: i.qty }));

  const hasFaData =
    convention.faEnabled ||
    convention.orderItems.some((i) => i.product.type === "FA") ||
    !!convention.faCollectionDate ||
    !!convention.faPaymentDueDate ||
    !!convention.faDeliveryDate ||
    !!convention.faDeliveryAddress ||
    convention.faShippingCost > 0;

  return (
    <IbsaAppShell active="ibsa">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <Link href="/ibsa" className="mb-1 block text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← All Conventions
          </Link>
          {/* Editable name + venue */}
          <form action={updateConventionDetails} className="group flex flex-col gap-1">
            <input type="hidden" name="conventionId" value={convention.id} />
            <input
              type="text"
              name="name"
              defaultValue={convention.name}
              className="w-full bg-transparent text-3xl font-bold text-gray-900 outline-none focus:border-b focus:border-orange-500 group-hover:border-b group-hover:border-gray-200"
            />
            <input
              type="text"
              name="venue"
              defaultValue={convention.venue ?? ""}
              placeholder="Venue"
              className="w-full bg-transparent text-sm text-gray-500 outline-none placeholder:text-gray-300 focus:border-b focus:border-orange-500 group-hover:border-b group-hover:border-gray-100"
            />
            <button
              type="submit"
              className="mt-1 self-start text-xs text-gray-400 hover:text-orange-500 transition-colors"
            >
              Save name
            </button>
          </form>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <ConventionImportButton conventionId={convention.id} />
          <DeleteConventionButton conventionId={convention.id} conventionName={convention.name} />
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">CS Status</p>
          <div className="flex gap-2">
            {(["pending", "ordered"] as const).map((s) => (
              <form key={s} action={updateConventionStatus}>
                <input type="hidden" name="conventionId" value={convention.id} />
                <input type="hidden" name="status" value={s} />
                <button
                  type="submit"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${
                    convention.status === s
                      ? "bg-blue-600 text-white"
                      : "border border-gray-200 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {s}
                </button>
              </form>
            ))}
            <CompleteButton
              conventionId={convention.id}
              conventionName={convention.name}
              dept="CS"
              items={csStockItems}
              isActive={convention.status === "complete"}
            />
          </div>
        </div>
      </header>

      {/* ── Row 1: Order summary stats ──────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">Order Lines</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{itemsWithQty}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">Order Value (ex VAT)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">£{fmtGbp(orderSaleTotal)}</p>
          {convention.shippingCost > 0 && (
            <p className="mt-0.5 text-xs text-gray-400">
              + £{fmtGbp(convention.shippingCost)} shipping
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">Order Profit</p>
          <p className={`mt-1 text-2xl font-bold ${orderProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
            £{fmtGbp(orderProfit)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{orderMarginPct.toFixed(1)}% margin</p>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500">Payment</p>
          {convention.paidAt ? (
            <div className="mt-1">
              <p className="font-semibold text-green-600">✓ Paid</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {fmtDate(convention.paidAt)}
              </p>
              <form action={markUnpaid} className="mt-2">
                <input type="hidden" name="conventionId" value={convention.id} />
                <button type="submit" className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                  Mark unpaid
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-1">
              {convention.paymentDueDate && (
                <p className="text-sm text-amber-600">
                  Due {fmtDate(convention.paymentDueDate)}
                </p>
              )}
              <form action={markPaid} className="mt-2">
                <input type="hidden" name="conventionId" value={convention.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                >
                  Mark paid
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Countdown + key dates ───────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {/* Countdown to collection */}
        {convention.collectionDate ? (
          <CountdownBadge
            targetDate={convention.collectionDate.toISOString()}
            label="Days to Collection"
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm p-5 text-center">
            <p className="text-xs text-gray-500">Days to Collection</p>
            <p className="mt-2 text-xs text-gray-400">Set collection date</p>
          </div>
        )}

        {/* Convention date */}
        <DateCard
          label="Convention Date"
          field="convention"
          conventionId={convention.id}
          initialValue={toInput(convention.conventionDate)}
        />

        {/* Delivery date */}
        <DateCard
          label="Delivery Date"
          field="delivery"
          conventionId={convention.id}
          initialValue={toInput(convention.deliveryDate)}
        />

        {/* Shipping cost */}
        <ShippingCostCard
          conventionId={convention.id}
          initialValue={convention.shippingCost}
          field="cs"
        />
      </div>

      {/* ── Logistics panel ────────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Logistics
        </h3>
        <form action={updateLogistics} className="grid grid-cols-1 gap-y-4 sm:grid-cols-3 sm:gap-x-6">
          <input type="hidden" name="conventionId" value={convention.id} />

          <div>
            <label className="mb-1 block text-xs text-gray-500">Reid Freight Collection Date</label>
            <input
              type="date"
              name="collectionDate"
              defaultValue={toInput(convention.collectionDate)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Payment Due Date</label>
            <input
              type="date"
              name="paymentDueDate"
              defaultValue={toInput(convention.paymentDueDate)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Delivery Address</label>
            <input
              type="text"
              name="deliveryAddress"
              defaultValue={convention.deliveryAddress ?? ""}
              placeholder="Venue address"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Contact Name</label>
            <input
              type="text"
              name="contactName"
              defaultValue={convention.contactName ?? ""}
              placeholder="On-site contact"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Contact Email</label>
            <input
              type="email"
              name="contactEmail"
              defaultValue={convention.contactEmail ?? ""}
              placeholder="email@example.com"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500"
            />
            <div className="mt-2">
              <SendOrderLinkButton
                conventionId={convention.id}
                contactEmail={convention.contactEmail ?? null}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Contact Mobile</label>
            <input
              type="tel"
              name="contactMobile"
              defaultValue={convention.contactMobile ?? ""}
              placeholder="+44 7700 000000"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500"
            />
          </div>

          <div className="col-span-3 border-t border-gray-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Cleaning Overseer</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Name</label>
                <input type="text" name="cleaningOverseerName" defaultValue={convention.cleaningOverseerName ?? ""} placeholder="Full name" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Email</label>
                <input type="email" name="cleaningOverseerEmail" defaultValue={convention.cleaningOverseerEmail ?? ""} placeholder="email@example.com" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Mobile</label>
                <input type="tel" name="cleaningOverseerMobile" defaultValue={convention.cleaningOverseerMobile ?? ""} placeholder="+44 7700 000000" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500" />
              </div>
            </div>
          </div>

          <div className="col-span-3 border-t border-gray-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Delivery Contact</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Name</label>
                <input type="text" name="deliveryContactName" defaultValue={convention.deliveryContactName ?? ""} placeholder="Full name" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Email</label>
                <input type="email" name="deliveryContactEmail" defaultValue={convention.deliveryContactEmail ?? ""} placeholder="email@example.com" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Mobile</label>
                <input type="tel" name="deliveryContactMobile" defaultValue={convention.deliveryContactMobile ?? ""} placeholder="+44 7700 000000" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500" />
              </div>
            </div>
          </div>

          <div className="col-span-3 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
            >
              Save logistics
            </button>
          </div>
        </form>
      </div>

      {/* ── FA Logistics panel (only when FA data exists) ──────────── */}
      {hasFaData && <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            First Aid Logistics
          </h3>
          <div className="flex items-center gap-3">
            {/* FA Payment */}
            {convention.faPaidAt ? (
              <>
                <span className="text-xs text-green-600">✓ FA Paid {fmtDate(convention.faPaidAt)}</span>
                <form action={markFaUnpaid}>
                  <input type="hidden" name="conventionId" value={convention.id} />
                  <button type="submit" className="text-xs text-gray-400 hover:text-red-500 transition-colors">Mark FA unpaid</button>
                </form>
              </>
            ) : (
              <form action={markFaPaid} className="flex items-center gap-2">
                <input type="hidden" name="conventionId" value={convention.id} />
                {convention.faPaymentDueDate && (
                  <span className="text-xs text-amber-600">FA due {fmtDate(convention.faPaymentDueDate)}</span>
                )}
                <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
                  Mark FA paid
                </button>
              </form>
            )}
            {/* FA Status */}
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600">FA Status</p>
              <div className="flex gap-1">
                {(["pending", "ordered"] as const).map((s) => (
                  <form key={s} action={updateFaStatus}>
                    <input type="hidden" name="conventionId" value={convention.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      type="submit"
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${
                        convention.faStatus === s
                          ? "bg-green-600 text-white"
                          : "border border-gray-200 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {s}
                    </button>
                  </form>
                ))}
                <CompleteButton
                  conventionId={convention.id}
                  conventionName={convention.name}
                  dept="FA"
                  items={faStockItems}
                  isActive={convention.faStatus === "complete"}
                />
              </div>
            </div>
          </div>
        </div>

        {/* FA order mini-stats */}
        {faItemsWithQty > 0 && (
          <div className="mb-4 flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">FA Lines </span>
              <span className="font-semibold text-gray-900">{faItemsWithQty}</span>
            </div>
            <div>
              <span className="text-gray-500">Value </span>
              <span className="font-semibold text-gray-900">£{fmtGbp(faSaleTotal)}</span>
              {convention.faShippingCost > 0 && (
                <span className="ml-1 text-xs text-gray-400">+ £{fmtGbp(convention.faShippingCost)} shipping</span>
              )}
            </div>
            <div>
              <span className="text-gray-500">Profit </span>
              <span className={`font-semibold ${faProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                £{fmtGbp(faProfit)}
              </span>
            </div>
          </div>
        )}

        <form action={updateFaLogistics} className="grid grid-cols-1 gap-y-4 sm:grid-cols-3 sm:gap-x-6">
          <input type="hidden" name="conventionId" value={convention.id} />
          <div>
            <label className="mb-1 block text-xs text-gray-500">FA Collection Date</label>
            <input type="date" name="faCollectionDate" defaultValue={toInput(convention.faCollectionDate)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">FA Delivery Date</label>
            <input type="date" name="faDeliveryDate" defaultValue={toInput(convention.faDeliveryDate)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">FA Payment Due</label>
            <input type="date" name="faPaymentDueDate" defaultValue={toInput(convention.faPaymentDueDate)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">FA Delivery Address</label>
            <input type="text" name="faDeliveryAddress" defaultValue={convention.faDeliveryAddress ?? ""}
              placeholder="If different from CS delivery"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">FA Shipping Cost</label>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <span className="text-sm text-gray-400">£</span>
              <input type="number" name="faShippingCost" min="0" step="0.01"
                defaultValue={convention.faShippingCost > 0 ? convention.faShippingCost : ""}
                placeholder="0.00"
                className="w-full bg-transparent text-sm text-gray-900 outline-none" />
            </div>
          </div>
          <div className="flex items-end">
            <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors">
              Save FA logistics
            </button>
          </div>
        </form>
      </div>}

      {/* ── Notes ─────────────────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Notes</h3>
        <form action={updateNotes} className="flex flex-col gap-3">
          <input type="hidden" name="conventionId" value={convention.id} />
          <textarea
            name="notes"
            defaultValue={convention.notes ?? ""}
            rows={3}
            placeholder="e.g. Dublin invoice INV-0206 shows Bio Hazard Kits at £7.00 — invoice error, correct price is £6.59."
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-orange-500 resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
            >
              Save notes
            </button>
          </div>
        </form>
      </div>

      <ConventionProductTable
        products={csProductRows}
        qtyMap={csQtyMap}
        overrideMap={csOverrideMap}
        conventionId={convention.id}
        conventionName={convention.name}
        paymentDueDate={convention.paymentDueDate ? convention.paymentDueDate.toISOString() : null}
        shippingCost={convention.shippingCost}
        title="Cleaning Supplies Order"
        dept="CS"
      />

      {/* ── Add First Aid button (shown when FA not yet enabled) ─────── */}
      {!hasFaData && (
        <form action={enableFa} className="mb-8">
          <input type="hidden" name="conventionId" value={convention.id} />
          <button
            type="submit"
            className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors"
          >
            + Add First Aid Order
          </button>
        </form>
      )}

      {/* ── First Aid order (only when FA items exist) ─────────────── */}
      {hasFaData && (
        <ConventionProductTable
          products={faProductRows}
          qtyMap={faQtyMap}
          overrideMap={faOverrideMap}
          conventionId={convention.id}
          conventionName={convention.name}
          paymentDueDate={convention.faPaymentDueDate ? convention.faPaymentDueDate.toISOString() : null}
          shippingCost={convention.faShippingCost}
          title="First Aid Order"
          dept="FA"
        />
      )}
    </IbsaAppShell>
  );
}
