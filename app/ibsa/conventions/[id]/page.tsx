import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";
import IbsaAppShell from "../../../../src/components/ibsa-app-shell";
import {
  updateConventionStatus,
  updateConventionDate,
  updateDeliveryDate,
  updateShippingCost,
  updateLogistics,
  updateFaLogistics,
  markPaid,
  markUnpaid,
  markFaPaid,
  markFaUnpaid,
  updateFaStatus,
} from "./actions";
import { updateConventionDetails } from "../../actions";
import ConventionProductTable from "./ConventionProductTable";
import CountdownBadge from "./CountdownBadge";

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

  const allProducts = await prisma.ibsaProduct.findMany({
    orderBy: [{ type: "asc" }, { category: "asc" }, { name: "asc" }],
  });

  const qtyMap: Record<string, number> = {};
  for (const item of convention.orderItems) {
    qtyMap[item.productId] = item.qty;
  }

  const allProductRows = allProducts.map(({ id, code, name, variant, unitCost, xyloCost, category }) => ({
    id, code, name, variant, unitCost, xyloCost, category,
  }));

  const csItems = convention.orderItems.filter((i) => i.product.type === "CS");
  const faItems = convention.orderItems.filter((i) => i.product.type === "FA");

  const orderSaleTotal = csItems.reduce((sum, item) => sum + item.qty * item.product.unitCost, 0);
  const orderCostTotal = csItems.reduce(
    (sum, item) => sum + item.qty * (item.product.xyloCost ?? item.product.unitCost),
    0
  );
  const orderProfit = orderSaleTotal - orderCostTotal;
  const orderMarginPct = orderSaleTotal > 0 ? (orderProfit / orderSaleTotal) * 100 : 0;
  const itemsWithQty = csItems.filter((i) => i.qty > 0).length;

  const faSaleTotal = faItems.reduce((sum, item) => sum + item.qty * item.product.unitCost, 0);
  const faCostTotal = faItems.reduce(
    (sum, item) => sum + item.qty * (item.product.xyloCost ?? item.product.unitCost),
    0
  );
  const faProfit = faSaleTotal - faCostTotal;
  const faItemsWithQty = faItems.filter((i) => i.qty > 0).length;

  const hasFaData =
    convention.orderItems.some((i) => i.product.type === "FA") ||
    !!convention.faCollectionDate ||
    !!convention.faPaymentDueDate ||
    !!convention.faDeliveryDate ||
    !!convention.faDeliveryAddress ||
    convention.faShippingCost > 0;

  return (
    <IbsaAppShell active="ibsa">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <Link href="/ibsa" className="mb-1 block text-sm text-slate-400 hover:text-white">
            ← All Conventions
          </Link>
          {/* Editable name + venue */}
          <form action={updateConventionDetails} className="group flex flex-col gap-1">
            <input type="hidden" name="conventionId" value={convention.id} />
            <input
              type="text"
              name="name"
              defaultValue={convention.name}
              className="w-full bg-transparent text-3xl font-bold text-white outline-none focus:border-b focus:border-orange-500 group-hover:border-b group-hover:border-slate-700"
            />
            <input
              type="text"
              name="venue"
              defaultValue={convention.venue ?? ""}
              placeholder="Venue"
              className="w-full bg-transparent text-sm text-slate-400 outline-none placeholder:text-slate-700 focus:border-b focus:border-orange-500 group-hover:border-b group-hover:border-slate-800"
            />
            <button
              type="submit"
              className="mt-1 self-start text-xs text-slate-700 hover:text-orange-400 transition-colors"
            >
              Save name
            </button>
          </form>
        </div>
        <div className="flex shrink-0 gap-2">
          {(["pending", "ordered", "complete"] as const).map((s) => (
            <form key={s} action={updateConventionStatus}>
              <input type="hidden" name="conventionId" value={convention.id} />
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${
                  convention.status === s
                    ? "bg-white text-slate-900"
                    : "border border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {s}
              </button>
            </form>
          ))}
        </div>
      </header>

      {/* ── Row 1: Order summary stats ──────────────────────────────── */}
      <div className="mb-4 grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Order Lines</p>
          <p className="mt-1 text-2xl font-bold">{itemsWithQty}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Order Value (ex VAT)</p>
          <p className="mt-1 text-2xl font-bold">£{fmtGbp(orderSaleTotal)}</p>
          {convention.shippingCost > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">
              + £{fmtGbp(convention.shippingCost)} shipping
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Order Profit</p>
          <p className={`mt-1 text-2xl font-bold ${orderProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            £{fmtGbp(orderProfit)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{orderMarginPct.toFixed(1)}% margin</p>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Payment</p>
          {convention.paidAt ? (
            <div className="mt-1">
              <p className="font-semibold text-green-400">✓ Paid</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {fmtDate(convention.paidAt)}
              </p>
              <form action={markUnpaid} className="mt-2">
                <input type="hidden" name="conventionId" value={convention.id} />
                <button type="submit" className="text-xs text-slate-600 hover:text-red-400">
                  Mark unpaid
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-1">
              {convention.paymentDueDate && (
                <p className="text-sm text-amber-400">
                  Due {fmtDate(convention.paymentDueDate)}
                </p>
              )}
              <form action={markPaid} className="mt-2">
                <input type="hidden" name="conventionId" value={convention.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
                >
                  Mark paid
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Countdown + key dates ───────────────────────────── */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        {/* Countdown to collection */}
        {convention.collectionDate ? (
          <CountdownBadge
            targetDate={convention.collectionDate.toISOString()}
            label="Days to Collection"
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 p-5 text-center">
            <p className="text-xs text-slate-500">Days to Collection</p>
            <p className="mt-2 text-xs text-slate-600">Set collection date</p>
          </div>
        )}

        {/* Convention date */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-1 text-xs text-slate-500">Convention Date</p>
          <form action={updateConventionDate} className="flex items-center gap-2">
            <input type="hidden" name="conventionId" value={convention.id} />
            <input
              type="date"
              name="date"
              defaultValue={toInput(convention.conventionDate)}
              className="w-full bg-transparent text-sm text-white outline-none"
            />
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-300">✓</button>
          </form>
        </div>

        {/* Delivery date */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-1 text-xs text-slate-500">Delivery Date</p>
          <form action={updateDeliveryDate} className="flex items-center gap-2">
            <input type="hidden" name="conventionId" value={convention.id} />
            <input
              type="date"
              name="date"
              defaultValue={toInput(convention.deliveryDate)}
              className="w-full bg-transparent text-sm text-white outline-none"
            />
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-300">✓</button>
          </form>
        </div>

        {/* Shipping cost */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-1 text-xs text-slate-500">Shipping Cost</p>
          <form action={updateShippingCost} className="flex items-center gap-1">
            <input type="hidden" name="conventionId" value={convention.id} />
            <span className="text-sm text-slate-400">£</span>
            <input
              type="number"
              name="shippingCost"
              min="0"
              step="0.01"
              defaultValue={convention.shippingCost > 0 ? convention.shippingCost : ""}
              placeholder="0.00"
              className="w-full bg-transparent text-sm text-white outline-none"
            />
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-300">✓</button>
          </form>
        </div>
      </div>

      {/* ── Logistics panel ────────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Logistics
        </h3>
        <form action={updateLogistics} className="grid grid-cols-3 gap-x-6 gap-y-4">
          <input type="hidden" name="conventionId" value={convention.id} />

          {/* Collection date */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Reid Freight Collection Date</label>
            <input
              type="date"
              name="collectionDate"
              defaultValue={toInput(convention.collectionDate)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>

          {/* Payment due */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Payment Due Date</label>
            <input
              type="date"
              name="paymentDueDate"
              defaultValue={toInput(convention.paymentDueDate)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>

          {/* Delivery address */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Delivery Address</label>
            <input
              type="text"
              name="deliveryAddress"
              defaultValue={convention.deliveryAddress ?? ""}
              placeholder="Venue address"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>

          {/* Contact name */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Contact Name</label>
            <input
              type="text"
              name="contactName"
              defaultValue={convention.contactName ?? ""}
              placeholder="On-site contact"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>

          {/* Contact email */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Contact Email</label>
            <input
              type="email"
              name="contactEmail"
              defaultValue={convention.contactEmail ?? ""}
              placeholder="email@example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>

          {/* Contact mobile */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Contact Mobile</label>
            <input
              type="tel"
              name="contactMobile"
              defaultValue={convention.contactMobile ?? ""}
              placeholder="+44 7700 000000"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>

          <div className="col-span-3 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              Save logistics
            </button>
          </div>
        </form>
      </div>

      {/* ── FA Logistics panel (only when FA data exists) ──────────── */}
      {hasFaData && <div className="mb-8 rounded-2xl border border-blue-900/40 bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400">
            First Aid Logistics
          </h3>
          <div className="flex items-center gap-3">
            {/* FA Payment */}
            {convention.faPaidAt ? (
              <>
                <span className="text-xs text-green-400">✓ FA Paid {fmtDate(convention.faPaidAt)}</span>
                <form action={markFaUnpaid}>
                  <input type="hidden" name="conventionId" value={convention.id} />
                  <button type="submit" className="text-xs text-slate-600 hover:text-red-400">Mark FA unpaid</button>
                </form>
              </>
            ) : (
              <form action={markFaPaid} className="flex items-center gap-2">
                <input type="hidden" name="conventionId" value={convention.id} />
                {convention.faPaymentDueDate && (
                  <span className="text-xs text-amber-400">FA due {fmtDate(convention.faPaymentDueDate)}</span>
                )}
                <button type="submit" className="rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                  Mark FA paid
                </button>
              </form>
            )}
            {/* FA Status */}
            <div className="flex gap-1">
              {(["pending", "ordered", "complete"] as const).map((s) => (
                <form key={s} action={updateFaStatus}>
                  <input type="hidden" name="conventionId" value={convention.id} />
                  <input type="hidden" name="status" value={s} />
                  <button
                    type="submit"
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${
                      convention.faStatus === s
                        ? "bg-blue-700 text-white"
                        : "border border-slate-700 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {s}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>

        {/* FA order mini-stats */}
        {faItemsWithQty > 0 && (
          <div className="mb-4 flex gap-6 text-sm">
            <div>
              <span className="text-slate-500">FA Lines </span>
              <span className="font-semibold text-white">{faItemsWithQty}</span>
            </div>
            <div>
              <span className="text-slate-500">Value </span>
              <span className="font-semibold text-white">£{fmtGbp(faSaleTotal)}</span>
              {convention.faShippingCost > 0 && (
                <span className="ml-1 text-xs text-slate-500">+ £{fmtGbp(convention.faShippingCost)} shipping</span>
              )}
            </div>
            <div>
              <span className="text-slate-500">Profit </span>
              <span className={`font-semibold ${faProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                £{fmtGbp(faProfit)}
              </span>
            </div>
          </div>
        )}

        <form action={updateFaLogistics} className="grid grid-cols-3 gap-x-6 gap-y-4">
          <input type="hidden" name="conventionId" value={convention.id} />
          <div>
            <label className="mb-1 block text-xs text-slate-500">FA Collection Date</label>
            <input type="date" name="faCollectionDate" defaultValue={toInput(convention.faCollectionDate)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">FA Delivery Date</label>
            <input type="date" name="faDeliveryDate" defaultValue={toInput(convention.faDeliveryDate)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">FA Payment Due</label>
            <input type="date" name="faPaymentDueDate" defaultValue={toInput(convention.faPaymentDueDate)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">FA Delivery Address</label>
            <input type="text" name="faDeliveryAddress" defaultValue={convention.faDeliveryAddress ?? ""}
              placeholder="If different from CS delivery"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">FA Shipping Cost</label>
            <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
              <span className="text-sm text-slate-400">£</span>
              <input type="number" name="faShippingCost" min="0" step="0.01"
                defaultValue={convention.faShippingCost > 0 ? convention.faShippingCost : ""}
                placeholder="0.00"
                className="w-full bg-transparent text-sm text-white outline-none" />
            </div>
          </div>
          <div className="flex items-end">
            <button type="submit" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600">
              Save FA logistics
            </button>
          </div>
        </form>
      </div>}

      {/* ── Product table (all depts combined) ─────────────────────── */}
      <ConventionProductTable
        products={allProductRows}
        qtyMap={qtyMap}
        conventionId={convention.id}
        title="Order"
      />
    </IbsaAppShell>
  );
}
