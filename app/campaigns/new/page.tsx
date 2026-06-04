import Link from "next/link";
import { prisma } from "../../../src/lib/prisma";
import AppShell from "../../../src/components/app-shell";
import { createCampaign } from "./actions";
import SubmitButton from "../../../src/components/submit-button";

function getEligibleContactCount(
  contacts: {
    contact: {
      email: string;
      subscribedAt: Date | null;
      unsubscribedAt: Date | null;
      archivedAt: Date | null;
      bouncedAt: Date | null;
      complainedAt: Date | null;
    };
  }[]
) {
  return contacts.filter(({ contact }) => {
    return (
      contact.email &&
      contact.subscribedAt &&
      !contact.unsubscribedAt &&
      !contact.archivedAt &&
      !contact.bouncedAt &&
      !contact.complainedAt
    );
  }).length;
}

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const { listId } = await searchParams;

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

  const listsWithCounts = lists.map((list) => {
    const totalContacts = list.contacts.length;
    const eligibleContacts = getEligibleContactCount(list.contacts);

    return {
      ...list,
      totalContacts,
      eligibleContacts,
    };
  });

  const selectedList = listId
    ? listsWithCounts.find((list) => list.id === listId)
    : null;

  return (
    <AppShell active="campaigns">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Marketing</p>
          <h2 className="text-3xl font-bold">New Campaign</h2>
        </div>

        <Link
          href="/campaigns"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Back to Campaigns
        </Link>
      </header>

      <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <form action={createCampaign} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Campaign Name
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              placeholder="May Charcoal Promo"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Subject Line
            </label>
            <input
              type="text"
              name="subject"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              placeholder="Serious heat for your next BBQ"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Target List
            </label>

            {selectedList ? (
              <p className="mb-3 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
                Campaign will be sent to: {selectedList.name} —{" "}
                {selectedList.eligibleContacts} eligible of{" "}
                {selectedList.totalContacts} contacts
              </p>
            ) : null}

            <select
              name="listId"
              required
              defaultValue={selectedList?.id ?? ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            >
              <option value="" disabled>
                Select a list
              </option>

              {listsWithCounts.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} — {list.eligibleContacts} eligible of{" "}
                  {list.totalContacts} contacts
                </option>
              ))}
            </select>

            <p className="mt-2 text-sm text-slate-500">
              Only subscribed contacts with no unsubscribe, archive, bounce or
              complaint status will be eligible to receive campaigns.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Email Body
            </label>
            <textarea
              name="body"
              required
              rows={10}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              placeholder="Write your email here..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              HTML Email
            </label>
            <textarea
              name="html"
              rows={12}
              placeholder="Paste your full HTML email here..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none"
            />
            <p className="mt-2 text-sm text-slate-500">
              Optional. If left blank, MailFoundry will create basic HTML from
              the plain text body.
            </p>
          </div>

          <SubmitButton pendingText="Saving draft...">Save Draft</SubmitButton>
        </form>
      </div>
    </AppShell>
  );
}
