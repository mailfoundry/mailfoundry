import Link from "next/link";
import { prisma } from "../../../src/lib/prisma";
import { notFound } from "next/navigation";
import { addContactToList, removeContactFromList } from "./actions";
import AppShell from "../../../src/components/app-shell";
import RemoveFromListButton from "../../../src/components/remove-from-list-button";

type ListPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getContactStatus(contact: {
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
  archivedAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
}) {
  if (contact.unsubscribedAt) {
    return {
      label: "Unsubscribed",
      className: "bg-red-500/10 text-red-400",
    };
  }

  if (contact.archivedAt) {
    return {
      label: "Archived",
      className: "bg-slate-500/10 text-slate-300",
    };
  }

  if (contact.bouncedAt) {
    return {
      label: "Bounced",
      className: "bg-orange-500/10 text-orange-400",
    };
  }

  if (contact.complainedAt) {
    return {
      label: "Complained",
      className: "bg-red-500/10 text-red-400",
    };
  }

  if (contact.subscribedAt) {
    return {
      label: "Subscribed",
      className: "bg-green-500/10 text-green-400",
    };
  }

  return {
    label: "Unknown",
    className: "bg-slate-500/10 text-slate-400",
  };
}

export default async function ListDetailPage({ params }: ListPageProps) {
  const { id } = await params;

  const [list, contacts] = await Promise.all([
    prisma.list.findUnique({
      where: { id },
      include: {
        contacts: {
          include: {
            contact: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    }),
    prisma.contact.findMany({
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  if (!list) {
    notFound();
  }

  const existingContactIds = new Set(
    list.contacts.map((entry) => entry.contactId)
  );

  const availableContacts = contacts.filter(
    (contact) => !existingContactIds.has(contact.id)
  );

  const listContacts = list.contacts.map((entry) => entry.contact);

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
      !contact.unsubscribedAt && !contact.archivedAt && contact.bouncedAt
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

  const addContactAction = addContactToList.bind(null, id);
  const removeContactAction = removeContactFromList.bind(null, id);

  return (
    <AppShell active="lists">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex w-full items-start justify-between gap-6">
          <div>
            <p className="text-sm text-slate-400">Audience</p>
            <h1 className="text-3xl font-bold text-white">{list.name}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {eligibleContacts} eligible of {totalContacts} contacts in this
              list
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              href={`/campaigns/new?listId=${list.id}`}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Create Campaign
            </Link>

            <Link
              href="/lists"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Back to Lists
            </Link>
          </div>
        </div>
      </header>

      <div className="mb-8 max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h3 className="mb-4 text-xl font-semibold">Add Contact to List</h3>

        <form action={addContactAction} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Choose Contact
            </label>
            <select
              name="contactId"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            >
              <option value="">
                {availableContacts.length === 0
                  ? "No contacts available"
                  : "Select a contact"}
              </option>
              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.email}
                  {contact.firstName || contact.lastName
                    ? ` — ${contact.firstName || ""} ${contact.lastName || ""}`.trim()
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={availableContacts.length === 0}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to List
          </button>
        </form>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Total Contacts</p>
          <p className="mt-2 text-2xl font-bold text-white">{totalContacts}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Eligible</p>
          <p className="mt-2 text-2xl font-bold text-green-400">
            {eligibleContacts}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Unsubscribed</p>
          <p className="mt-2 text-2xl font-bold text-red-400">
            {unsubscribedContacts}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Archived</p>
          <p className="mt-2 text-2xl font-bold text-slate-300">
            {archivedContacts}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Bounced</p>
          <p className="mt-2 text-2xl font-bold text-orange-400">
            {bouncedContacts}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Complained</p>
          <p className="mt-2 text-2xl font-bold text-red-400">
            {complainedContacts}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Unknown</p>
          <p className="mt-2 text-2xl font-bold text-slate-400">
            {unknownContacts}
          </p>
        </div>
      </div>

      {list.contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8">
          <h3 className="text-xl font-semibold">
            No contacts in this list yet
          </h3>
          <p className="mt-3 max-w-2xl text-slate-400">
            Add an existing contact above to start building this audience.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">First Name</th>
                <th className="px-6 py-4 font-medium">Last Name</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Source</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.contacts.map((entry) => {
                const status = getContactStatus(entry.contact);

                return (
                  <tr key={entry.id} className="border-t border-slate-800">
                    <td className="px-6 py-4">
                      <Link
                        href={`/contacts/${entry.contact.id}`}
                        className="hover:underline"
                      >
                        {entry.contact.email}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      {entry.contact.firstName || "—"}
                    </td>
                    <td className="px-6 py-4">
                      {entry.contact.lastName || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {entry.contact.source || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <RemoveFromListButton
                        contactId={entry.contactId}
                        removeAction={removeContactAction}
                      />
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
