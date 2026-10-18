import { ReactNode } from "react";
import { getIbsaUser, getMainUser } from "../lib/auth";
import AppShell from "./app-shell";
import { prisma } from "../lib/prisma";

type Props = {
  active: "ibsa" | "ibsa-circuits" | "ibsa-congregations" | "ibsa-products" | "ibsa-purchasing" | "ibsa-pos" | "ibsa-suppliers" | "ibsa-orders" | "ibsa-contacts";
  children: ReactNode;
};

export default async function IbsaAppShell({ active, children }: Props) {
  const [mainUser, ibsaUser] = await Promise.all([getMainUser(), getIbsaUser()]);
  const ibsaOnly = !mainUser && !!ibsaUser;

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
      ibsaOnly={true}
      isMainUser={!!mainUser}
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
