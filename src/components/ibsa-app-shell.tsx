import { ReactNode } from "react";
import { cookies } from "next/headers";
import AppShell from "./app-shell";

type Props = {
  active: "ibsa" | "ibsa-products" | "ibsa-purchasing";
  children: ReactNode;
};

export default async function IbsaAppShell({ active, children }: Props) {
  const cookieStore = await cookies();
  const isMainUser = cookieStore.get("mailfoundry_auth")?.value === "1";
  const ibsaOnly = !isMainUser && cookieStore.get("ibsa_auth")?.value === "1";

  return (
    <AppShell active={active} ibsaOnly={ibsaOnly}>
      {children}
    </AppShell>
  );
}
