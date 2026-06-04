import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "../../../../src/components/app-shell";
import { prisma } from "../../../../src/lib/prisma";
import { updateContact } from "./actions";

type EditContactPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getCurrentContactStatus(contact: {
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
  archivedAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
}) {
  if (contact.unsubscribedAt) {
    return "unsubscribed";
  }

  if (contact.archivedAt) {
    return "archived";
  }

  if (contact.bouncedAt) {
    return "bounced";
  }

  if (contact.complainedAt) {
    return "complained";
  }

  if (contact.subscribedAt) {
    return "subscribed";
  }

  return "unknown";
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: {
      id,
    },
  });

  if (!contact) {
    notFound();
  }

  const updateContactAction = updateContact.bind(null, contact.id);
  const currentContactStatus = getCurrentContactStatus(contact);

  return (
    <AppShell active="contacts">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Audience</p>
          <h2 className="text-3xl font-bold">Edit Contact</h2>
          <p className="mt-2 text-sm text-slate-400">{contact.email}</p>
        </div>

        <Link
          href={`/contacts/${contact.id}`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Back to Contact
        </Link>
      </header>

      <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <form action={updateContactAction} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              value={contact.email}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-500 outline-none"
            />
            <p className="mt-2 text-sm text-slate-500">
              Email editing is disabled for now to avoid accidental duplicate
              contacts.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                defaultValue={contact.firstName || ""}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                defaultValue={contact.lastName || ""}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Source
            </label>
            <input
              type="text"
              name="source"
              defaultValue={contact.source || ""}
              placeholder="manual, internal_test, customer, imported..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Contact Status
            </label>
            <select
              name="contactStatus"
              defaultValue={currentContactStatus}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            >
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="archived">Archived</option>
              <option value="bounced">Bounced</option>
              <option value="complained">Complained</option>
              <option value="unknown">Unknown</option>
            </select>
            <p className="mt-2 text-sm text-slate-500">
              Changing this updates the relevant contact status timestamp and
              clears conflicting status fields.
            </p>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Save Contact
          </button>
        </form>
      </div>
    </AppShell>
  );
}
