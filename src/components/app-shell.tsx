import { ReactNode } from "react";
import Sidebar from "./sidebar";

type AppShellProps = {
  active:
    | "dashboard"
    | "contacts"
    | "lists"
    | "templates"
    | "campaigns"
    | "reports"
    | "settings"
    | "ibsa"
    | "ibsa-products"
    | "ibsa-purchasing"
    | "ibsa-suppliers"
    | "ibsa-orders";
  children: ReactNode;
  ibsaOnly?: boolean;
};

export default function AppShell({ active, children, ibsaOnly = false }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <Sidebar active={active} ibsaOnly={ibsaOnly} />
        <section className="flex-1 p-10">{children}</section>
      </div>
    </main>
  );
}
