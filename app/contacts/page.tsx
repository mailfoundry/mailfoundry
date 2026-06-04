import Link from "next/link";
import { prisma } from "../../src/lib/prisma";
import AppShell from "../../src/components/app-shell";

type ContactsPageProps = {
  searchParams: Promise<{
    filter?: string;
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

export default async function ContactsPage({
  searchParams,
}: ContactsPageProps) {
  const params = await searchParams;
  const filter = params.filter || "active";

  const contacts = await prisma.contact.findMany({
    where:
      filter === "archived"
        ? {
            archivedAt: {
              not: null,
            },
          }
        : filter === "all"
          ? undefined
          : {
              archivedAt: null,
              unsubscribedAt: null,
              bouncedAt: null,
              complainedAt: null,
              subscribedAt: {
                not: null,
              },
            },
    orderBy: {
      createdAt: "desc",
    },
  });

  const [
    activeContactsCount,
    archivedContactsCount,
    subscribedContactsCount,
    unsubscribedContactsCount,
    bouncedContactsCount,
    complainedContactsCount,
    unknownContactsCount,
  ] = await Promise.all([
    prisma.contact.count({
      where: {
        subscribedAt: {
          not: null,
        },
        unsubscribedAt: null,
        archivedAt: null,
        bouncedAt: null,
        complainedAt: null,
      },
    }),
    prisma.contact.count({
      where: {
        archivedAt: {
          not: null,
        },
      },
    }),
    prisma.contact.count({
      where: {
        subscribedAt: {
          not: null,
        },
        unsubscribedAt: null,
        archivedAt: null,
        bouncedAt: null,
        complainedAt: null,
      },
    }),
    prisma.contact.count({
      where: {
        unsubscribedAt: {
          not: null,
        },
      },
    }),
    prisma.contact.count({
      where: {
        bouncedAt: {
          not: null,
        },
      },
    }),
    prisma.contact.count({
      where: {
        complainedAt: {
          not: null,
        },
      },
    }),
    prisma.contact.count({
      where: {
        subscribedAt: null,
        unsubscribedAt: null,
        archivedAt: null,
        bouncedAt: null,
        complainedAt: null,
      },
    }),
  ]);

  return (
    <AppShell active="contacts">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Audience</p>
          <h2 className="text-3xl font-bold">Contacts</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1 text-sm">
            <Link
              href="/contacts?filter=active"
              className={
                filter === "active"
                  ? "rounded-md bg-slate-800 px-3 py-1.5 text-white"
                  : "px-3 py-1.5 text-slate-400 hover:text-white"
              }
            >
              Active
            </Link>

            <Link
              href="/contacts?filter=archived"
              className={
                filter === "archived"
                  ? "rounded-md bg-slate-800 px-3 py-1.5 text-white"
                  : "px-3 py-1.5 text-slate-400 hover:text-white"
              }
            >
              Archived
            </Link>

            <Link
              href="/contacts?filter=all"
              className={
                filter === "all"
                  ? "rounded-md bg-slate-800 px-3 py-1.5 text-white"
                  : "px-3 py-1.5 text-slate-400 hover:text-white"
              }
            >
              All
            </Link>
          </div>

          <Link
            href="/contacts/new"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Add Contact
          </Link>
        </div>
      </header>

      <div className="mb-8 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Active</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {activeContactsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Archived</p>
          <p className="mt-2 text-2xl font-bold text-slate-300">
            {archivedContactsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Subscribed</p>
          <p className="mt-2 text-2xl font-bold text-green-400">
            {subscribedContactsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Unsubscribed</p>
          <p className="mt-2 text-2xl font-bold text-red-400">
            {unsubscribedContactsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Bounced</p>
          <p className="mt-2 text-2xl font-bold text-orange-400">
            {bouncedContactsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Complained</p>
          <p className="mt-2 text-2xl font-bold text-red-400">
            {complainedContactsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Unknown</p>
          <p className="mt-2 text-2xl font-bold text-slate-400">
            {unknownContactsCount}
          </p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8">
          <h3 className="text-xl font-semibold">No contacts found</h3>
          <p className="mt-3 max-w-2xl text-slate-400">
            Contacts matching this view will appear here.
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
                <th className="px-6 py-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const status = getSubscriptionStatus(contact);

                return (
                  <tr key={contact.id} className="border-t border-slate-800">
                    <td className="px-6 py-4">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="hover:underline"
                      >
                        {contact.email}
                      </Link>
                    </td>
                    <td className="px-6 py-4">{contact.firstName || "—"}</td>
                    <td className="px-6 py-4">{contact.lastName || "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {contact.source || "—"}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(contact.createdAt).toLocaleDateString()}
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
