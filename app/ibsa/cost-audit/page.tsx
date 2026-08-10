export const metadata = { title: "Cost Audit" };

import { prisma } from "../../../src/lib/prisma";

export const dynamic = "force-dynamic";

const fmt = (n: number) => `£${n.toFixed(4)}`;
const fmt2 = (n: number) => `£${n.toFixed(2)}`;

export default async function CostAuditPage() {
  const products = await prisma.ibsaProduct.findMany({
    include: {
      rsProducts: {
        where: {
          cartonPrice: { not: null },
          cartonSize: { not: null },
          ibsaProductId: { not: null },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  type Row = {
    code: string;
    name: string;
    variant: string | null;
    xyloCost: number | null;
    supplier: string;
    rsCode: string | null;
    cartonPrice: number;
    cartonSize: number;
    derivedUnit: number;
    diff: number;
  };

  const mismatches: Row[] = [];

  for (const p of products) {
    for (const rs of p.rsProducts) {
      if (!rs.cartonPrice || !rs.cartonSize) continue;
      const derived = rs.cartonPrice / rs.cartonSize;
      const current = p.xyloCost ?? 0;
      const diff = Math.abs(current - derived);
      if (diff > 0.005) {
        mismatches.push({
          code: p.code,
          name: p.name,
          variant: p.variant,
          xyloCost: p.xyloCost,
          supplier: rs.supplier,
          rsCode: rs.rsCode,
          cartonPrice: rs.cartonPrice,
          cartonSize: rs.cartonSize,
          derivedUnit: derived,
          diff,
        });
      }
    }
  }

  mismatches.sort((a, b) => b.diff - a.diff);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Cost Price Audit</h1>
      <p className="text-sm text-gray-500 mb-6">
        Products where <code>xyloCost</code> differs from{" "}
        <code>cartonPrice ÷ cartonSize</code> by more than £0.005
      </p>

      {mismatches.length === 0 ? (
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-green-800 font-medium">
          ✓ All linked products match their supplier cost prices.
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-amber-700 font-medium">
            {mismatches.length} mismatch{mismatches.length !== 1 ? "es" : ""} found
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">RS Code</th>
                  <th className="px-4 py-3 text-right">Carton £</th>
                  <th className="px-4 py-3 text-right">÷ Size</th>
                  <th className="px-4 py-3 text-right">Derived £/unit</th>
                  <th className="px-4 py-3 text-right">Xylo Cost £</th>
                  <th className="px-4 py-3 text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {mismatches.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-100 hover:bg-amber-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.code}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {r.name}
                      {r.variant && (
                        <span className="ml-1 text-gray-400">({r.variant})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.supplier}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {r.rsCode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt2(r.cartonPrice)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{r.cartonSize}</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700">
                      {fmt(r.derivedUnit)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.xyloCost != null ? fmt(r.xyloCost) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      £{r.diff.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
