import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import ContactsClient from "./ContactsClient";

export default async function IbsaContactsPage() {
  const suppliers = await prisma.ibsaSupplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactName: true, email: true, mobile: true, notes: true },
  });

  return (
    <IbsaAppShell active="ibsa-contacts">
      <header className="mb-10">
        <p className="text-sm text-slate-400">IBSA · Xylo Supplies</p>
        <h2 className="text-3xl font-bold">Supplier Contacts</h2>
        <p className="mt-1 text-sm text-slate-500">
          {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} · Renaming a supplier automatically updates all product links
        </p>
      </header>

      <ContactsClient suppliers={suppliers} />
    </IbsaAppShell>
  );
}
