import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Logo from "../../src/components/logo";
import { prisma } from "../../src/lib/prisma";
import { accountLogout, reorder } from "./actions";

export const metadata = { title: "My Account — Xylo (UK) Ltd" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; colour: string }> = {
  submitted:  { label: "Submitted",  colour: "text-sky-400 bg-sky-400/10" },
  processing: { label: "Processing", colour: "text-amber-400 bg-amber-400/10" },
  complete:   { label: "Complete",   colour: "text-green-400 bg-green-400/10" },
  cancelled:  { label: "Cancelled",  colour: "text-slate-500 bg-slate-500/10" },
};

type Props = { searchParams: Promise<{ reordered?: string; error?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const jar = await cookies();
  const groupAccountId = jar.get("group_auth")?.value;
  if (!groupAccountId) redirect("/account/login");

  const account = await prisma.groupAccount.findUnique({
    where: { id: groupAccountId },
    include: {
      orders: {
        orderBy: { submittedAt: "desc" },
        include: { lines: { include: { product: true } } },
      },
    },
  });

  if (!account) {
    // Stale cookie
    jar.delete("group_auth");
    redirect("/account/login");
  }

  const params = await searchParams;
  const reordered = params.reordered === "1";
  const notFound = params.error === "not-found";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Logo height={28} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{account.groupName}</span>
          <form action={accountLogout}>
            <button type="submit" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500 mb-1">
            Your account
          </p>
          <h1 className="text-2xl font-black tracking-tight">{account.groupName}</h1>
          <p className="mt-1 text-sm text-slate-400">{account.contactEmail}</p>
        </div>

        {/* Banners */}
        {reordered && (
          <div className="mb-6 rounded-xl border border-green-800 bg-green-900/20 px-5 py-4 text-sm text-green-400">
            Re-order submitted — we&apos;ll be in touch to confirm.
          </div>
        )}
        {notFound && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-900/20 px-5 py-4 text-sm text-red-400">
            Order not found.
          </div>
        )}

        {/* Orders */}
        {account.orders.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
            <p className="text-slate-400 text-sm mb-4">No orders yet.</p>
            <Link
              href="/order"
              className="inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
            >
              Place your first order
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {account.orders.map((order, i) => {
              const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.submitted;
              const date = order.submittedAt.toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              });
              const csLines = order.lines.filter((l) => l.dept === "CS");
              const faLines = order.lines.filter((l) => l.dept === "FA");
              const fmtGbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              const lineTotal = (lines: typeof csLines) => lines.reduce((s, l) => s + l.qty * l.product.unitCost, 0);
              const grandTotal = lineTotal(order.lines);

              const SectionTable = ({ lines, label }: { lines: typeof csLines; label: string }) =>
                lines.length === 0 ? null : (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">{label}</p>
                    <div className="overflow-hidden rounded-lg border border-slate-800">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-950">
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-20">Code</th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Product</th>
                            <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-10">Qty</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-16">Unit</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-20">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => (
                            <tr key={l.id} className="border-t border-slate-800">
                              <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{l.product.code}</td>
                              <td className="px-3 py-2.5 text-slate-200">
                                {l.product.name}
                                {l.product.variant && (
                                  <span className="block text-[11px] text-slate-500">{l.product.variant}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-white">{l.qty}</td>
                              <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{fmtGbp(l.product.unitCost)}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">{fmtGbp(l.qty * l.product.unitCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-700">
                            <td colSpan={4} className="px-3 py-2 text-right text-xs text-slate-500">Section total</td>
                            <td className="px-3 py-2 text-right font-bold text-orange-400 tabular-nums">{fmtGbp(lineTotal(lines))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );

              return (
                <div key={order.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  {/* Order header */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.colour}`}>
                          {status.label}
                        </span>
                        {i === 0 && (
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{date}</p>
                      {order.requiredBy && (
                        <p className="text-xs text-slate-500 mt-0.5">Required by: <span className="text-slate-400">{order.requiredBy}</span></p>
                      )}
                      {order.deliveryAddress && (
                        <p className="text-xs text-slate-500 mt-0.5">Delivery: <span className="text-slate-400">{order.deliveryAddress.split("\n")[0]}</span></p>
                      )}
                    </div>
                    <form action={reorder.bind(null, order.id)}>
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Re-order
                      </button>
                    </form>
                  </div>

                  {/* Line items */}
                  <SectionTable lines={csLines} label="Cleaning Supplies" />
                  <SectionTable lines={faLines} label="First Aid" />

                  {/* Grand total */}
                  <div className="mt-2 flex justify-end">
                    <div className="flex items-center gap-6 rounded-lg bg-slate-950 px-4 py-2.5">
                      <span className="text-xs text-slate-500">Order total</span>
                      <span className="text-base font-black text-orange-400 tabular-nums">{fmtGbp(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/order"
            className="inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
          >
            Place a new order
          </Link>
        </div>
      </main>
    </div>
  );
}
