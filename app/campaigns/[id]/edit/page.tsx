import Link from "next/link";
import { prisma } from "../../../../src/lib/prisma";
import { notFound } from "next/navigation";
import AppShell from "../../../../src/components/app-shell";
import { updateCampaign } from "./actions";

type EditCampaignPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

export default async function EditCampaignPage({
  params,
}: EditCampaignPageProps) {
  const { id } = await params;

  const [campaign, lists] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
    }),
    prisma.list.findMany({
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
    }),
  ]);

  if (!campaign) {
    notFound();
  }

  const listsWithCounts = lists.map((list) => {
    const totalContacts = list.contacts.length;
    const eligibleContacts = getEligibleContactCount(list.contacts);

    return {
      ...list,
      totalContacts,
      eligibleContacts,
    };
  });

  const selectedList = listsWithCounts.find(
    (list) => list.id === campaign.listId
  );

  const updateCampaignAction = updateCampaign.bind(null, id);

  return (
    <AppShell active="campaigns">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Marketing</p>
          <h2 className="text-3xl font-bold">Edit Campaign</h2>
        </div>

        <Link
          href={`/campaigns/${campaign.id}`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Back to Campaign
        </Link>
      </header>

      <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <form action={updateCampaignAction} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Campaign Name
            </label>
            <input
              type="text"
              name="name"
              defaultValue={campaign.name}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Subject Line
            </label>
            <input
              type="text"
              name="subject"
              defaultValue={campaign.subject}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Target List
            </label>

            {selectedList ? (
              <p className="mb-3 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
                Current target list: {selectedList.name} —{" "}
                {selectedList.eligibleContacts} eligible of{" "}
                {selectedList.totalContacts} contacts
              </p>
            ) : (
              <p className="mb-3 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                The saved target list could not be found. Please choose a new
                list before saving.
              </p>
            )}

            <select
              name="listId"
              defaultValue={campaign.listId}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            >
              <option value="">Select a list</option>

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
              defaultValue={campaign.body}
              required
              rows={10}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              HTML Email
            </label>
            <textarea
              name="html"
              defaultValue={campaign.html || ""}
              rows={12}
              placeholder="Paste your full HTML email here..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none"
            />
            <p className="mt-2 text-sm text-slate-500">
              Optional. If left blank, MailFoundry will create basic HTML from
              the plain text body.
            </p>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Save Changes
          </button>
        </form>
      </div>
    </AppShell>
  );
}
