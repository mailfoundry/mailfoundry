import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const CONVENTION_ID = "cmrbvjtw50083foa9cuxzxje4";

async function applyFix() {
  "use server";

  // Find the wooden handle product (code contains HNDL_WOODEN)
  const handleProducts = await prisma.ibsaProduct.findMany({
    where: { code: { contains: "HNDL_WOODEN" } },
    select: { id: true, code: true, name: true },
  });

  // Find the jug funnel product
  const funnelProducts = await prisma.ibsaProduct.findMany({
    where: { code: { contains: "JUG_FUNNEL" } },
    select: { id: true, code: true, name: true },
  });

  const results: string[] = [];

  // Handle the wooden squeegee handles
  // Check if HNDL_WOODEN_2 exists as its own product
  const handle2 = handleProducts.find(p => p.code === "HNDL_WOODEN_2");
  const handle1 = handleProducts.find(p => p.code === "HNDL_WOODEN");

  if (handle2) {
    // Separate product — upsert with qty 7
    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId_dept: { conventionId: CONVENTION_ID, productId: handle2.id, dept: "CS" } },
      create: { conventionId: CONVENTION_ID, productId: handle2.id, dept: "CS", qty: 7 },
      update: { qty: 7 },
    });
    results.push(`✓ Set ${handle2.code} (${handle2.name}) qty = 7`);
  } else if (handle1) {
    // Same product — increment the existing 81 by 7 → 88
    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId_dept: { conventionId: CONVENTION_ID, productId: handle1.id, dept: "CS" } },
      create: { conventionId: CONVENTION_ID, productId: handle1.id, dept: "CS", qty: 88 },
      update: { qty: 88 },
    });
    results.push(`✓ Updated ${handle1.code} (${handle1.name}) qty 81 → 88 (+7 squeegee handles)`);
  } else {
    results.push("✗ No wooden handle product found");
  }

  // Handle the jug funnel
  const funnel = funnelProducts[0];
  if (funnel) {
    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId_dept: { conventionId: CONVENTION_ID, productId: funnel.id, dept: "CS" } },
      create: { conventionId: CONVENTION_ID, productId: funnel.id, dept: "CS", qty: 4 },
      update: { qty: 4 },
    });
    results.push(`✓ Set ${funnel.code} (${funnel.name}) qty = 4`);
  } else {
    results.push("✗ No jug funnel product found");
  }

  revalidatePath(`/ibsa/conventions/${CONVENTION_ID}`);
  revalidatePath("/ibsa/purchasing");

  return results;
}

export default async function FixLiverpoolPage() {
  // Read current state
  const handleProducts = await prisma.ibsaProduct.findMany({
    where: { code: { contains: "HNDL_WOODEN" } },
    select: { id: true, code: true, name: true },
  });
  const funnelProducts = await prisma.ibsaProduct.findMany({
    where: { code: { contains: "JUG_FUNNEL" } },
    select: { id: true, code: true, name: true },
  });

  const currentItems = await prisma.ibsaOrderItem.findMany({
    where: {
      conventionId: CONVENTION_ID,
      productId: { in: [...handleProducts, ...funnelProducts].map(p => p.id) },
    },
    include: { product: { select: { code: true, name: true } } },
  });

  return (
    <IbsaAppShell active="ibsa">
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Liverpool — Missing Items Fix</h1>
        <p className="text-sm text-gray-500 mb-6">Convention: {CONVENTION_ID}</p>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Products found in DB</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2">Code</th>
              <th className="text-left pb-2">Name</th>
              <th className="text-left pb-2">ID</th>
            </tr></thead>
            <tbody>
              {[...handleProducts, ...funnelProducts].map(p => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="py-2 font-mono text-xs text-gray-600">{p.code}</td>
                  <td className="py-2 text-gray-800">{p.name}</td>
                  <td className="py-2 font-mono text-xs text-gray-400">{p.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Current Liverpool order items for these products</h2>
          {currentItems.length === 0
            ? <p className="text-sm text-gray-400">None found yet</p>
            : <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Code</th>
                  <th className="text-left pb-2">Name</th>
                  <th className="text-right pb-2">Qty</th>
                </tr></thead>
                <tbody>
                  {currentItems.map(i => (
                    <tr key={i.productId} className="border-b border-gray-50">
                      <td className="py-2 font-mono text-xs text-gray-600">{i.product.code}</td>
                      <td className="py-2 text-gray-800">{i.product.name}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        <form action={applyFix}>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Apply fix — add missing items to Liverpool
          </button>
        </form>
      </div>
    </IbsaAppShell>
  );
}
