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
    | "ibsa-products";
  children: ReactNode;
};

export default function AppShell({ active, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <Sidebar active={active} />
        <section className="flex-1 p-10">{children}</section>
      </div>
    </main>
  );
}
