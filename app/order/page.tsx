import { cookies } from "next/headers";
import { prisma } from "../../src/lib/prisma";
import OrderFormClient from "./OrderFormClient";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OrderPage({ searchParams }: Props) {
  const { error } = await searchParams;

  const [csProducts, faProducts] = await Promise.all([
    prisma.ibsaProduct.findMany({
      where: { type: "CS", visibleInOrderForm: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, variant: true, code: true, category: true, unitCost: true, description: true, groupDescription: true, imageUrl: true, groupImageUrl: true, groupWithVariants: true, venueType: true },
    }),
    prisma.ibsaProduct.findMany({
      where: { type: "FA", visibleInOrderForm: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, variant: true, code: true, category: true, unitCost: true, description: true, groupDescription: true, imageUrl: true, groupImageUrl: true, groupWithVariants: true, venueType: true },
    }),
  ]);

  // Pre-fill from last order if the user is logged in
  let prefill: {
    groupType: string; groupName: string; contactName: string;
    contactEmail: string; contactMobile: string; deliveryAddress: string;
  } | null = null;

  const jar = await cookies();
  const groupAccountId = jar.get("group_auth")?.value;
  if (groupAccountId) {
    const lastOrder = await prisma.ibsaGroupOrder.findFirst({
      where: { groupAccountId },
      orderBy: { submittedAt: "desc" },
      select: { groupType: true, groupName: true, contactName: true, contactEmail: true, contactMobile: true, deliveryAddress: true },
    });
    if (lastOrder) {
      prefill = {
        groupType:      lastOrder.groupType,
        groupName:      lastOrder.groupName,
        contactName:    lastOrder.contactName,
        contactEmail:   lastOrder.contactEmail,
        contactMobile:  lastOrder.contactMobile ?? "",
        deliveryAddress: lastOrder.deliveryAddress ?? "",
      };
    }
  }

  return <OrderFormClient csProducts={csProducts} faProducts={faProducts} error={error} prefill={prefill} />;
}
