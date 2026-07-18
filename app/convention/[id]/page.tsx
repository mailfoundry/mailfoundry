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

  const csProducts = await prisma.ibsaProduct.findMany({
    where: { type: "CS" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, variant: true, code: true, category: true, unitCost: true, imageUrl: true, groupImageUrl: true, groupWithVariants: true },
  });

  const faProducts = await prisma.ibsaProduct.findMany({
    where: { type: "FA" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, variant: true, code: true, category: true, unitCost: true, imageUrl: true, groupImageUrl: true, groupWithVariants: true },
  });

  // Build existing qty map: productId → qty
  const existingQty: Record<string, number> = {};
  for (const item of convention.orderItems) {
    existingQty[item.productId] = item.qty;
  }

  const isLocked =
    convention.status === "ordered" || convention.status === "complete";

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
      }}
      csProducts={csProducts}
      faProducts={faProducts}
      existingQty={existingQty}
    />
  );
}
