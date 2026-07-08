import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";
import AppShell from "../../../../src/components/app-shell";
import { updateConventionStatus, updateDeliveryDate, updateShippingCost } from "./actions";
import ConventionProductTable from "./ConventionProductTable";

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const csProducts = allProducts
    .filter((p) => p.type === "CS")
    .map(({ id, name, variant, unitCost, xyloCost, category }) => ({
      id, name, variant, unitCost, xyloCost, category,
    }));

  const faProducts = allProducts
    .filter((p) => p.type === "FA")
    .map(({ id, name, variant, unitCost, xyloCost, category }) => ({
      id, name, variant, unitCost, xyloCost, category,
    }));

  const orderSaleTotal = convention.orderItems.reduce(
    (sum, item) => sum + item.qty * item.product.unitCost,
    0
  );
  const orderCostTotal = convention.orderItems.reduce(
    (sum, item) => sum + item.qty * (item.product.xyloCost ?? item.product.unitCost),
    0
  );
  const orderProfit = orderSaleTotal - orderCostTotal;
  const orderMarginPct = orderSaleTotal > 0 ? (orderProfit / orderSaleTotal) * 100 : 0;
  const itemsWithQty = convention.orderItems.filter((i) => i.qty > 0).length;

  return (
    <AppShell active="ibsa">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/ibsa" className="mb-1 block text-sm text-slate-400 hover:text-white">
            ← All Conventions
          </Link>
          <h2 className="text-3xl font-bold">{convention.name}</h2>
          {convention.venue && <p className="mt-1 text-slate-400">{convention.venue}</p>}
        </div>
        <div className="flex gap-2">
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

      {/* Stats — 2 rows of 3 */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {/* Row 1 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Convention Date</p>
          <p className="mt-1 font-semibold">
            {convention.conventionDate.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-1 text-xs text-slate-500">Delivery Date</p>
          <form action={updateDeliveryDate} className="flex items-center gap-2">
            <input type="hidden" name="conventionId" value={convention.id} />
            <input
              type="date"
              name="date"
              defaultValue={
                convention.deliveryDate
                  ? convention.deliveryDate.toISOString().split("T")[0]
                  : ""
              }
              className="w-full bg-transparent text-sm text-white outline-none"
            />
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-300">
              ✓
            </button>
          </form>
        </div>

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
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-300">
              ✓
            </button>
          </form>
        </div>

        {/* Row 2 */}
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
          <p
            className={`mt-1 text-2xl font-bold ${
              orderProfit >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            £{fmtGbp(orderProfit)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{orderMarginPct.toFixed(1)}% margin</p>
        </div>
      </div>

      <ConventionProductTable
        products={csProducts}
        qtyMap={qtyMap}
        conventionId={convention.id}
        title="Cleaning Supplies"
      />

      <ConventionProductTable
        products={faProducts}
        qtyMap={qtyMap}
        conventionId={convention.id}
        title="First Aid"
      />
    </AppShell>
  );
}
