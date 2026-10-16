import { prisma } from "./prisma";

/**
 * SCS → IBSA stock link.
 *
 * Staffordshire Cleaning Supplies (staffordshire-hub) sells the same stock that IBSA holds.
 * This pulls paid SCS web orders and mirrors each one as an IbsaGroupOrder (groupType "scs"),
 * so it shows up as demand in Purchasing → POs, exactly like a group/convention order.
 *
 *   SCS CONFIRMED            → group order "submitted"  (counts as demand in Purchasing)
 *   SCS DISPATCHED/DELIVERED → "complete" + In Stock decremented once (stockDeductedAt)
 *   SCS CANCELLED            → "cancelled" (+ stock restored if it had already been deducted)
 *
 * Products are matched SCS variant SKU = IbsaProduct.code. Christeyns products that aren't in IBSA
 * yet are created automatically (hidden from the convention order form) with a Christeyns supplier
 * line so they can go on POs. Any other unmatched SKU is noted on the order for manual linking.
 *
 * Idempotent: each SCS order maps to exactly one group order via externalRef "scs:<orderNumber>".
 */

type ScsItem = {
  sku: string | null;
  name: string;
  productName: string;
  variant: string | null;
  qty: number;
  costPrice: number | null;
  christeyns: boolean;
};
type ScsOrder = {
  orderNumber: number;
  status: "CONFIRMED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  createdAt: string;
  customerName: string;
  customerEmail: string | null;
  phone: string | null;
  shippingAddress: unknown;
  trackingRef: string | null;
  items: ScsItem[];
};

export type ScsSyncResult = {
  fetched: number;
  created: number;
  completed: number;
  cancelled: number;
  productsCreated: string[];
  unmatched: string[];
};

function formatAddress(a: unknown): string | null {
  if (!a || typeof a !== "object") return typeof a === "string" ? a : null;
  const parts = Object.values(a as Record<string, unknown>).filter((v): v is string => typeof v === "string" && !!v.trim());
  return parts.length ? parts.join(", ") : null;
}

export async function syncScsOrders(opts: { days?: number } = {}): Promise<ScsSyncResult> {
  const secret = process.env.SCS_SYNC_SECRET;
  if (!secret) throw new Error("SCS_SYNC_SECRET is not set");
  const base = (process.env.SCS_SITE_URL ?? "https://www.staffordshirecleaningsupplies.co.uk").replace(/\/$/, "");
  const since = new Date(Date.now() - (opts.days ?? 30) * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`${base}/api/internal/scs-orders?since=${encodeURIComponent(since)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SCS feed returned ${res.status}`);
  const { orders } = (await res.json()) as { orders: ScsOrder[] };

  const result: ScsSyncResult = { fetched: orders.length, created: 0, completed: 0, cancelled: 0, productsCreated: [], unmatched: [] };
  if (!orders.length) return result;

  // Product lookup by code (case-insensitive)
  const products = await prisma.ibsaProduct.findMany({ select: { id: true, code: true } });
  const byCode = new Map(products.map((p) => [p.code.trim().toLowerCase(), p.id]));

  async function resolveProduct(item: ScsItem): Promise<string | null> {
    const code = item.sku?.trim();
    if (!code) return null;
    const hit = byCode.get(code.toLowerCase());
    if (hit) return hit;
    if (!item.christeyns) return null;

    // Christeyns product not yet in IBSA → create it (hidden from convention form) + supplier line for POs
    const created = await prisma.ibsaProduct.create({
      data: {
        code,
        name: item.productName,
        variant: item.variant,
        category: "chemicals",
        type: "CS",
        unitCost: item.costPrice ?? 0,
        visibleInOrderForm: false,
        rsProducts: {
          create: {
            supplier: "Christeyns",
            rsCode: code.replace(/^CHR-/i, ""),
            rsVariant: item.variant,
            rsDescription: [item.productName, item.variant].filter(Boolean).join(" — "),
            cartonSize: 1,
            cartonPrice: item.costPrice ?? null,
            notes: "Auto-created from an SCS web order — check carton size and price.",
          },
        },
      },
      select: { id: true },
    });
    byCode.set(code.toLowerCase(), created.id);
    result.productsCreated.push(`${code} (${item.productName}${item.variant ? ` — ${item.variant}` : ""})`);
    return created.id;
  }

  for (const o of orders) {
    const ref = `scs:${o.orderNumber}`;
    let order = await prisma.ibsaGroupOrder.findUnique({
      where: { externalRef: ref },
      select: { id: true, status: true, stockDeductedAt: true, lines: { select: { productId: true, qty: true } } },
    });

    // ── Create on first sight (skip orders that were cancelled before we ever saw them) ──
    if (!order) {
      if (o.status === "CANCELLED") continue;

      const qtyByProduct = new Map<string, number>();
      const notLinked: string[] = [];
      for (const item of o.items) {
        const pid = await resolveProduct(item);
        if (pid) qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + item.qty);
        else notLinked.push(`${item.sku ?? "no SKU"} × ${item.qty} (${item.name})`);
      }
      if (notLinked.length) result.unmatched.push(...notLinked.map((n) => `SCS #${o.orderNumber}: ${n}`));

      order = await prisma.ibsaGroupOrder.create({
        data: {
          externalRef: ref,
          groupType: "scs",
          groupName: `SCS #${o.orderNumber} — ${o.customerName}`,
          contactName: o.customerName,
          contactEmail: o.customerEmail ?? "",
          contactMobile: o.phone,
          deliveryAddress: formatAddress(o.shippingAddress),
          paymentMethod: "card",
          paidAt: new Date(o.createdAt),
          submittedAt: new Date(o.createdAt),
          status: "submitted",
          trackingRef: o.trackingRef,
          adminNotes: notLinked.length ? `Not linked to IBSA stock: ${notLinked.join("; ")}` : null,
          lines: { create: [...qtyByProduct].map(([productId, qty]) => ({ productId, qty, dept: "CS" })) },
        },
        select: { id: true, status: true, stockDeductedAt: true, lines: { select: { productId: true, qty: true } } },
      });
      result.created++;
    }

    // ── Dispatched/delivered → complete + deduct stock once ──
    if ((o.status === "DISPATCHED" || o.status === "DELIVERED") && !order.stockDeductedAt) {
      await prisma.$transaction([
        prisma.ibsaGroupOrder.update({
          where: { id: order.id },
          data: { status: "complete", stockDeductedAt: new Date(), trackingRef: o.trackingRef ?? undefined },
        }),
        ...order.lines
          .filter((l) => l.qty > 0)
          .map((l) => prisma.ibsaProduct.update({ where: { id: l.productId }, data: { inStock: { decrement: l.qty } } })),
      ]);
      result.completed++;
    }

    // ── Cancelled → cancel (and put stock back if it had been deducted) ──
    if (o.status === "CANCELLED" && order.status !== "cancelled") {
      await prisma.$transaction([
        prisma.ibsaGroupOrder.update({ where: { id: order.id }, data: { status: "cancelled", stockDeductedAt: null } }),
        ...(order.stockDeductedAt
          ? order.lines
              .filter((l) => l.qty > 0)
              .map((l) => prisma.ibsaProduct.update({ where: { id: l.productId }, data: { inStock: { increment: l.qty } } }))
          : []),
      ]);
      result.cancelled++;
    }
  }

  return result;
}
