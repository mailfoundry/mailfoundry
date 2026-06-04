import Link from "next/link";
import { prisma } from "../../src/lib/prisma";
import AppShell from "../../src/components/app-shell";

export default async function ListsPage() {
  const lists = await prisma.list.findMany({
    include: {
      contacts: {
        include: {
          contact: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <AppShell active="lists">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Audience</p>
          <h2 className="text-3xl font-bold">Lists</h2>
        </div>

        <Link
          href="/lists/new"
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Add List
        </Link>
      </header>

      {lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8">
          <h3 className="text-xl font-semibold">No lists yet</h3>
          <p className="mt-3 max-w-2xl text-slate-400">
            Create your first list to start organising contacts for campaigns.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Contacts</th>
                <th className="px-6 py-4 font-medium">Eligible</th>
                <th className="px-6 py-4 font-medium">Unsubscribed</th>
                <th className="px-6 py-4 font-medium">Archived</th>
                <th className="px-6 py-4 font-medium">Bounced</th>
                <th className="px-6 py-4 font-medium">Complained</th>
                <th className="px-6 py-4 font-medium">Unknown</th>
                <th className="px-6 py-4 font-medium">Created</th>
              </tr>
            </thead>

            <tbody>
              {lists.map((list) => {
                const listContacts = list.contacts.map(
                  (entry) => entry.contact
                );

                const totalContacts = listContacts.length;

                const eligibleContacts = listContacts.filter(
                  (contact) =>
                    contact.email &&
                    contact.subscribedAt &&
                    !contact.unsubscribedAt &&
                    !contact.archivedAt &&
                    !contact.bouncedAt &&
                    !contact.complainedAt
                ).length;

                const unsubscribedContacts = listContacts.filter(
                  (contact) => contact.unsubscribedAt
                ).length;

                const archivedContacts = listContacts.filter(
                  (contact) => !contact.unsubscribedAt && contact.archivedAt
                ).length;

                const bouncedContacts = listContacts.filter(
                  (contact) =>
                    !contact.unsubscribedAt &&
                    !contact.archivedAt &&
                    contact.bouncedAt
                ).length;

                const complainedContacts = listContacts.filter(
                  (contact) =>
                    !contact.unsubscribedAt &&
                    !contact.archivedAt &&
                    !contact.bouncedAt &&
                    contact.complainedAt
                ).length;

                const unknownContacts = listContacts.filter(
                  (contact) =>
                    !contact.subscribedAt &&
                    !contact.unsubscribedAt &&
                    !contact.archivedAt &&
                    !contact.bouncedAt &&
                    !contact.complainedAt
                ).length;

                return (
                  <tr key={list.id} className="border-t border-slate-800">
                    <td className="px-6 py-4">
                      <Link
                        href={`/lists/${list.id}`}
                        className="hover:underline"
                      >
                        {list.name}
                      </Link>
                    </td>

                    <td className="px-6 py-4 text-slate-300">
                      {totalContacts}
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-semibold text-green-400">
                        {eligibleContacts}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-semibold text-red-400">
                        {unsubscribedContacts}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-300">
                        {archivedContacts}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-semibold text-orange-400">
                        {bouncedContacts}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-semibold text-red-400">
                        {complainedContacts}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-400">
                        {unknownContacts}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {new Date(list.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
