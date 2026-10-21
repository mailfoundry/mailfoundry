import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Convention revenue/profit feed for the staffordshire-hub analytics page.
 * Auth: Authorization: Bearer <SCS_SYNC_SECRET> (the shared secret already set on both Railway services).
 *
 * Per convention (dated by conventionDate):
 *   revenue  = goods sale price ex VAT (IbsaProduct.unitCost × qty), CS + FA
 *   cost     = Xylo cost (IbsaProduct.xyloCost × qty; lines with no xyloCost count at sale price → £0 profit,
 *              same as the convention page) — costCoverage says how much revenue had a real cost
 *   shipping = shipping charged on the invoices (shown separately, not counted in revenue/profit)
 */
function authorised(req: Request): boolean {
  const secret = process.env.SCS_SYNC_SECRET;
  if (!secret) return false;
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const conventions = await prisma.ibsaConvention.findMany({
    orderBy: { conventionDate: "desc" },
    include: { orderItems: { where: { qty: { gt: 0 } }, include: { product: { select: { unitCost: true, xyloCost: true } } } } },
  });

  const rows = conventions
    .filter((c) => c.orderItems.length > 0)
    .map((c) => {
      let revenue = 0, cost = 0, costed = 0, csRevenue = 0, faRevenue = 0;
      for (const i of c.orderItems) {
        const sale = i.qty * i.product.unitCost;
        revenue += sale;
        if (i.dept === "FA") faRevenue += sale; else csRevenue += sale;
        if (i.product.xyloCost != null) {
          cost += i.qty * i.product.xyloCost;
          costed += sale;
        } else {
          cost += sale; // unknown cost → no profit claimed
        }
      }
      return {
        id: c.id,
        name: c.name,
        eventType: c.eventType,
        venue: c.venue,
        date: c.conventionDate.toISOString(),
        status: c.status,
        paid: !!c.paidAt && (!c.faEnabled || !!c.faPaidAt),
        archived: !!c.archivedAt,
        revenue: r2(revenue),
        csRevenue: r2(csRevenue),
        faRevenue: r2(faRevenue),
        cost: r2(cost),
        profit: r2(revenue - cost),
        shipping: r2(c.shippingCost + (c.faEnabled ? c.faShippingCost : 0)),
        costCoverage: revenue > 0 ? Math.round((costed / revenue) * 1000) / 10 : 100,
      };
    });

  return NextResponse.json({ generatedAt: new Date().toISOString(), conventions: rows });
}
