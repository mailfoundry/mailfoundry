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

  const [groupOrderCounts, conventionCounts] = await Promise.all([
    prisma.ibsaGroupOrder.groupBy({
      by: ["groupType"],
      where: { status: "submitted" },
      _count: true,
    }),
    prisma.ibsaConvention.groupBy({
      by: ["eventType"],
      where: { archivedAt: null, status: { not: "complete" } },
      _count: true,
    }),
  ]);

  const goCount  = (t: string) => groupOrderCounts.find((r) => r.groupType === t)?._count ?? 0;
  const convCount = (t: string) => conventionCounts.find((r) => r.eventType === t)?._count ?? 0;

  return (
    <AppShell
      active={active}
      ibsaOnly={ibsaOnly}
      orderCounts={{
        regional:     goCount("regional")     + convCount("regional"),
        circuit:      goCount("circuit")      + convCount("circuit"),
        congregation: goCount("congregation") + convCount("congregation"),
      }}
    >
      {children}
    </AppShell>
  );
}
