import { ReactNode } from "react";
import { cookies } from "next/headers";
import AppShell from "./app-shell";
import { prisma } from "../lib/prisma";

type Props = {
  active: "ibsa" | "ibsa-circuits" | "ibsa-congregations" | "ibsa-products" | "ibsa-purchasing" | "ibsa-suppliers" | "ibsa-orders" | "ibsa-contacts";
  children: ReactNode;
};

export default async function IbsaAppShell({ active, children }: Props) {
  const cookieStore = await cookies();
  const isMainUser = cookieStore.get("mailfoundry_auth")?.value === "1";
  const ibsaOnly = !isMainUser && cookieStore.get("ibsa_auth")?.value === "1";

  const submittedOrdersCount = await prisma.ibsaGroupOrder.count({
    where: { status: "submitted" },
  });

  return (
    <AppShell active={active} ibsaOnly={ibsaOnly} submittedOrdersCount={submittedOrdersCount}>
      {children}
    </AppShell>
  );
}
