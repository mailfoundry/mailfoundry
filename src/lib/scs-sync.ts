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
 * Products are matched by SCS variant SKU = IbsaProduct.code, or an IbsaSkuAlias row
 * (set from /ibsa/purchasing/scs-links). Christeyns products not in IBSA are created automatically.
 * Any other unmatched SKU is left off the order and listed on the SCS links page; once linked,
 * the next sync adds the missing lines to any order that hasn't been dispatched yet.
 *
 * Idempotent: each SCS order maps to exactly one group order via externalRef "scs:<orderNumber>".
 */

export type ScsItem = {
  sku: string | null;
  name: string;
  productName: string;
  variant: string | null;
  qty: number;
  costPrice: number | null;
  christeyns: boolean;
};
export type ScsOrder = {
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
  linesAdded: number;
  completed: number;
  cancelled: number;
  productsCreated: string[];
  unmatched: string[];
};

export type UnlinkedSku = {
  sku: string;
  name: string;
  productName: string;
  variant: string | null;
  costPrice: number | null;
  totalQty: number;
  orders: number[];
  supplierGuess: string;
};

function formatAddress(a: unknown): string | null {
  if (!a || typeof a !== "object") return typeof a === "string" ? a : null;
  const parts = Object.values(a as Record<string, unknown>).filter((v): v is string => typeof v === "string" && !!v.trim());
  return parts.length ? parts.join(", ") : null;
}

export function guessSupplier(name: string, sku: string | null): string {
  const n = name.toLowerCase();
  if (n.startsWith("robert scott") || (sku ?? "").toUpperCase().startsWith("RS_")) return "Robert Scott";
  if (n.includes("christeyns") || (sku ?? "").toUpperCase().startsWith("CHR-")) return "Christeyns";
  return "Robert Scott";
}

export async function fetchScsOrders(days = 30): Promise<ScsOrder[]> {
  const secret = process.env.SCS_SYNC_SECRET;
  if (!secret) throw new Error("SCS_SYNC_SECRET is not set");
  const base = (process.env.SCS_SITE_URL ?? "https://www.staffordshirecleaningsupplies.co.uk").replace(/\/$/, "");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${base}/api/internal/scs-orders?since=${encodeURIComponent(since)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SCS feed returned ${res.status}`);
  return ((await res.json()) as { orders: ScsOrder[] }).orders;
}

/** SKU (lower-case) → IbsaProduct.id, from product codes plus aliases. */
export async function loadSkuLookup(): Promise<Map<string, string>> {
  const [products, aliases] = await Promise.all([
    prisma.ibsaProduct.findMany({ select: { id: true, code: true } }),
    prisma.ibsaSkuAlias.findMany({ select: { sku: true, productId: true } }),
  ]);
  const map = new Map<string, string>(products.map((p: { id: string; code: string }) => [p.code.trim().toLowerCase(), p.id]));
  for (const a of aliases as { sku: string; productId: string }[]) map.set(a.sku.trim().toLowerCase(), a.productId);
  return map;
}

/** SCS SKUs from recent orders that don't match any IBSA product or alias (for the links page). */
export async function findUnlinkedSkus(days = 90): Promise<UnlinkedSku[]> {
  const [orders, lookup] = await Promise.all([fetchScsOrders(days), loadSkuLookup()]);
  const out = new Map<string, UnlinkedSku>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    for (const i of o.items) {
      const sku = i.sku?.trim();
      if (!sku || lookup.has(sku.toLowerCase()) || i.christeyns) continue;
      const row = out.get(sku) ?? {
        sku, name: i.name, productName: i.productName, variant: i.variant, costPrice: i.costPrice,
        totalQty: 0, orders: [], supplierGuess: guessSupplier(i.productName, sku),
      };
      row.totalQty += i.qty;
      if (!row.orders.includes(o.orderNumber)) row.orders.push(o.orderNumber);
      out.set(sku, row);
    }
  }
  return [...out.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

export async function syncScsOrders(opts: { days?: number } = {}): Promise<ScsSyncResult> {
  const orders = await fetchScsOrders(opts.days ?? 30);
  const result: ScsSyncResult = { fetched: orders.length, created: 0, linesAdded: 0, completed: 0, cancelled: 0, productsCreated: [], unmatched: [] };
  if (!orders.length) return result;

  const byCode = await loadSkuLookup();

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

  /** Work out the IBSA lines for an SCS order, plus any items that still can't be linked. */
  async function resolveLines(o: ScsOrder) {
    const qtyByProduct = new Map<string, number>();
    const notLinked: string[] = [];
    for (const item of o.items) {
      const pid = await resolveProduct(item);
      if (pid) qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + item.qty);
      else notLinked.push(`${item.sku ?? "no SKU"} × ${item.qty} (${item.name})`);
    }
    return { qtyByProduct, notLinked };
  }
  const notesFor = (notLinked: string[]) =>
    notLinked.length ? `Not linked to IBSA stock: ${notLinked.join("; ")} — link at /ibsa/purchasing/scs-links` : null;

  type GroupOrderLite = {
    id: string;
    status: string;
    stockDeductedAt: Date | null;
    adminNotes: string | null;
    lines: { productId: string; qty: number }[];
  };
  const liteSelect = { id: true, status: true, stockDeductedAt: true, adminNotes: true, lines: { select: { productId: true, qty: true } } } as const;

  for (const o of orders) {
    const ref = `scs:${o.orderNumber}`;
    let order = (await prisma.ibsaGroupOrder.findUnique({
      where: { externalRef: ref },
      select: liteSelect,
    })) as GroupOrderLite | null;

    if (!order) {
      // Create on first sight (skip orders that were cancelled before we ever saw them)
      if (o.status === "CANCELLED") continue;
      const { qtyByProduct, notLinked } = await resolveLines(o);
      if (notLinked.length) result.unmatched.push(...notLinked.map((n) => `SCS #${o.orderNumber}: ${n}`));

      order = (await prisma.ibsaGroupOrder.create({
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
          adminNotes: notesFor(notLinked),
          lines: { create: [...qtyByProduct].map(([productId, qty]) => ({ productId, qty, dept: "CS" })) },
        },
        select: liteSelect,
      })) as GroupOrderLite;
      result.created++;
    } else if (!order.stockDeductedAt && order.status !== "cancelled" && order.adminNotes?.startsWith("Not linked")) {
      // Previously-unlinked items may now be linked → add any missing lines (existing lines are left as-is)
      const { qtyByProduct, notLinked } = await resolveLines(o);
      const have = new Set(order.lines.map((l) => l.productId));
      const toAdd = [...qtyByProduct].filter(([pid]) => !have.has(pid));
      if (toAdd.length || notesFor(notLinked) !== order.adminNotes) {
        await prisma.ibsaGroupOrder.update({
          where: { id: order.id },
          data: {
            adminNotes: notesFor(notLinked),
            lines: { create: toAdd.map(([productId, qty]) => ({ productId, qty, dept: "CS" })) },
          },
        });
        result.linesAdded += toAdd.length;
        order = { ...order, lines: [...order.lines, ...toAdd.map(([productId, qty]) => ({ productId, qty }))] };
      }
      if (notLinked.length) result.unmatched.push(...notLinked.map((n) => `SCS #${o.orderNumber}: ${n}`));
    }

    // Dispatched/delivered → complete + deduct stock once
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

    // Cancelled → cancel (and put stock back if it had been deducted)
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
