import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../src/lib/prisma";
import OrderFormClient from "./OrderFormClient";

type Props = { params: Promise<{ id: string }> };

export default async function ConventionOrderPage({ params }: Props) {
  const { id } = await params;

  // Auth: convention_auth cookie must match this convention
  const cookieStore = await cookies();
  const authConventionId = cookieStore.get("convention_auth")?.value;
  if (authConventionId !== id) {
    redirect(`/convention?error=invalid-token`);
  }

  const convention = await prisma.ibsaConvention.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      venue: true,
      conventionDate: true,
      deliveryDate: true,
      status: true,
      faStatus: true,
      contactName: true,
      contactEmail: true,
      contactMobile: true,
      cleaningOverseerName: true,
      cleaningOverseerEmail: true,
      cleaningOverseerMobile: true,
      deliveryAddress: true,
      deliveryContactName: true,
      deliveryContactEmail: true,
      deliveryContactMobile: true,
      orderItems: {
        select: { productId: true, qty: true, dept: true },
      },
    },
  });

  if (!convention) redirect("/convention?error=not-found");

  // Product IDs already ordered under FA dept for this convention
  const faOrderedIds = convention.orderItems
    .filter((i) => i.dept === "FA")
    .map((i) => i.productId);

  const csProducts = await prisma.ibsaProduct.findMany({
    where: { type: "CS", visibleInOrderForm: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, variant: true, code: true, category: true, unitCost: true, description: true, groupDescription: true, imageUrl: true, groupImageUrl: true, groupWithVariants: true },
  });

  // FA tab: native FA-type products + any CS-type products already ordered under FA
  // (mirrors the logic in the admin detail page)
  const faProducts = await prisma.ibsaProduct.findMany({
    where: {
      OR: [
        { type: "FA", visibleInOrderForm: true },
        ...(faOrderedIds.length > 0 ? [{ id: { in: faOrderedIds } }] : []),
      ],
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, variant: true, code: true, category: true, unitCost: true, description: true, groupDescription: true, imageUrl: true, groupImageUrl: true, groupWithVariants: true },
  });

  // Build existing qty map: productId → qty
  const existingQty: Record<string, number> = {};
  for (const item of convention.orderItems) {
    existingQty[item.productId] = item.qty;
  }

  const isLocked   = convention.status   === "ordered" || convention.status   === "complete";
  const isFaLocked = convention.faStatus === "ordered" || convention.faStatus === "complete";

  return (
    <OrderFormClient
      convention={{
        id:                    convention.id,
        name:                  convention.name,
        venue:                 convention.venue ?? null,
        conventionDate:        convention.conventionDate.toISOString(),
        deliveryDate:          convention.deliveryDate?.toISOString() ?? null,
        contactName:           convention.contactName ?? null,
        contactEmail:          convention.contactEmail ?? null,
        contactMobile:         convention.contactMobile ?? null,
        cleaningOverseerName:  convention.cleaningOverseerName ?? null,
        cleaningOverseerEmail: convention.cleaningOverseerEmail ?? null,
        cleaningOverseerMobile:convention.cleaningOverseerMobile ?? null,
        deliveryAddress:       convention.deliveryAddress ?? null,
        deliveryContactName:   convention.deliveryContactName ?? null,
        deliveryContactEmail:  convention.deliveryContactEmail ?? null,
        deliveryContactMobile: convention.deliveryContactMobile ?? null,
        isLocked,
        isFaLocked,
      }}
      csProducts={csProducts}
      faProducts={faProducts}
      existingQty={existingQty}
    />
  );
}
