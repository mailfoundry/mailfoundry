import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "../../../src/components/app-shell";
import { prisma } from "../../../src/lib/prisma";
import {
  addContactToList,
  archiveContact,
  removeContactFromList,
  restoreContact,
} from "./actions";

type ContactDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getSubscriptionStatus(contact: {
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

function getSendStatusClassName(status: string) {
  if (status === "sent") {
    return "rounded-full bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-400";
  }

  if (status === "skipped_unsubscribed") {
    return "rounded-full bg-yellow-500/10 px-2 py-1 text-xs font-semibold text-yellow-400";
  }

  if (status === "skipped_archived") {
    return "rounded-full bg-slate-500/10 px-2 py-1 text-xs font-semibold text-slate-300";
  }

  if (status === "skipped_bounced") {
    return "rounded-full bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-400";
  }

  if (status === "skipped_complained") {
    return "rounded-full bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-400";
  }

  if (status === "skipped_unknown") {
    return "rounded-full bg-slate-500/10 px-2 py-1 text-xs font-semibold text-slate-400";
  }

  return "rounded-full bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-400";
}

function formatDate(date: Date | null) {
  return date ? new Date(date).toLocaleString() : "—";
}

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const { id } = await params;

  const [contact, lists] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        lists: {
          include: {
            list: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        campaignSends: {
          include: {
            campaign: true,
          },
          orderBy: {
            sentAt: "desc",
          },
          take: 10,
        },
      },
    }),
    prisma.list.findMany({
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  if (!contact) {
    notFound();
  }

  const status = getSubscriptionStatus(contact);

  const existingListIds = new Set(contact.lists.map((entry) => entry.listId));

  const availableLists = lists.filter((list) => !existingListIds.has(list.id));

  const archiveContactAction = archiveContact.bind(null, contact.id);
  const restoreContactAction = restoreContact.bind(null, contact.id);
  const addContactToListAction = addContactToList.bind(null, contact.id);
  const removeContactFromListAction = removeContactFromList.bind(
    null,
    contact.id
  );

  return (
    <AppShell active="contacts">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Audience</p>
          <h2 className="text-3xl font-bold">{contact.email}</h2>
          <p className="mt-2 text-sm text-slate-400">
            Contact record and campaign history.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/contacts/${contact.id}/edit`}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Edit Contact
          </Link>

          {contact.archivedAt ? (
            <form action={restoreContactAction}>
              <button
                type="submit"
                className="rounded-lg border border-green-500/40 px-4 py-2 text-sm font-semibold text-green-300 hover:bg-green-500/10"
              >
                Restore Contact
              </button>
            </form>
          ) : (
            <form action={archiveContactAction}>
              <button
                type="submit"
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10"
              >
                Archive Contact
              </button>
            </form>
          )}

          <Link
            href="/contacts"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Back to Contacts
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Name</p>
          <p className="mt-3 text-lg font-semibold">
            {[contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
              "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Contact Status</p>
          <p className="mt-3">
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Source</p>
          <p className="mt-3 text-lg font-semibold">{contact.source || "—"}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Created</p>
          <p className="mt-3 text-lg font-semibold">
            {formatDate(contact.createdAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Subscribed At</p>
          <p className="mt-3 text-lg font-semibold">
            {formatDate(contact.subscribedAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Unsubscribed At</p>
          <p className="mt-3 text-lg font-semibold">
            {formatDate(contact.unsubscribedAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Archived At</p>
          <p className="mt-3 text-lg font-semibold">
            {formatDate(contact.archivedAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Bounced At</p>
          <p className="mt-3 text-lg font-semibold">
            {formatDate(contact.bouncedAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Complained At</p>
          <p className="mt-3 text-lg font-semibold">
            {formatDate(contact.complainedAt)}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h3 className="text-xl font-semibold">Lists</h3>

        <form action={addContactToListAction} className="mt-4 flex gap-3">
          <select
            name="listId"
            required
            disabled={availableLists.length === 0}
            className="min-w-80 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {availableLists.length === 0
                ? "No lists available"
                : "Select a list"}
            </option>

            {availableLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={availableLists.length === 0}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to List
          </button>
        </form>

        {contact.lists.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            This contact is not currently assigned to any lists.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">List</th>
                  <th className="px-4 py-3 font-medium">Added</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {contact.lists.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-slate-300">
                      <Link
                        href={`/lists/${entry.list.id}`}
                        className="hover:underline"
                      >
                        {entry.list.name}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      <form action={removeContactFromListAction}>
                        <input
                          type="hidden"
                          name="listId"
                          value={entry.listId}
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h3 className="text-xl font-semibold">Recent Campaign Activity</h3>

        {contact.campaignSends.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No campaign activity recorded for this contact yet.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Sent At</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {contact.campaignSends.map((send) => (
                  <tr key={send.id}>
                    <td className="px-4 py-3 text-slate-300">
                      <Link
                        href={`/campaigns/${send.campaign.id}`}
                        className="hover:underline"
                      >
                        {send.campaign.name}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <span className={getSendStatusClassName(send.status)}>
                        {send.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-400">
                      {new Date(send.sentAt).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {send.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
