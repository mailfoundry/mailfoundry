import { prisma } from "../../src/lib/prisma";
import OrderFormClient from "./OrderFormClient";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OrderPage({ searchParams }: Props) {
  const { error } = await searchParams;

  const csProducts = await prisma.ibsaProduct.findMany({
    where: { type: "CS" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, variant: true, code: true, category: true, unitCost: true },
  });

  const faProducts = await prisma.ibsaProduct.findMany({
    where: { type: "FA" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, variant: true, code: true, category: true, unitCost: true },
  });

  return <OrderFormClient csProducts={csProducts} faProducts={faProducts} error={error} />;
}
