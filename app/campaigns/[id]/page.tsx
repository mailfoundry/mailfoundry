import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "../../../src/components/app-shell";
import SendCampaignButton from "../../../src/components/send-campaign-button";
import SendTestEmailForm from "../../../src/components/send-test-email-form";
import { prisma } from "../../../src/lib/prisma";

type CampaignPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

function getFriendlySendError(error: string | null) {
  if (!error) {
    return "—";
  }

  if (error.includes("Email address is not verified")) {
    return "SES sandbox: recipient not verified";
  }

  return error;
}

export default async function CampaignDetailPage({
  params,
}: CampaignPageProps) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      list: {
        include: {
          contacts: {
            include: {
              contact: true,
            },
          },
        },
      },
      sends: {
        orderBy: {
          sentAt: "desc",
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const listContacts = campaign.list.contacts.map((entry) => entry.contact);

  const eligibleContacts = listContacts.filter(
    (contact) =>
      contact.email &&
      contact.subscribedAt &&
      !contact.unsubscribedAt &&
      !contact.archivedAt &&
      !contact.bouncedAt &&
      !contact.complainedAt
  );

  const unsubscribedContacts = listContacts.filter(
    (contact) => contact.unsubscribedAt
  );

  const archivedContacts = listContacts.filter(
    (contact) => !contact.unsubscribedAt && contact.archivedAt
  );

  const bouncedContacts = listContacts.filter(
    (contact) =>
      !contact.unsubscribedAt && !contact.archivedAt && contact.bouncedAt
  );

  const complainedContacts = listContacts.filter(
    (contact) =>
      !contact.unsubscribedAt &&
      !contact.archivedAt &&
      !contact.bouncedAt &&
      contact.complainedAt
  );

  const unknownStatusContacts = listContacts.filter(
    (contact) =>
      !contact.subscribedAt &&
      !contact.unsubscribedAt &&
      !contact.archivedAt &&
      !contact.bouncedAt &&
      !contact.complainedAt
  );

  const sentSends = campaign.sends.filter((send) => send.status === "sent");
  const openedSends = sentSends.filter((send) => send.openedAt !== null);
  const openRate =
    sentSends.length > 0
      ? Math.round((openedSends.length / sentSends.length) * 100)
      : 0;

  const failedSends = campaign.sends.filter((send) => send.status === "failed");

  const skippedUnsubscribedSends = campaign.sends.filter(
    (send) => send.status === "skipped_unsubscribed"
  );

  const skippedArchivedSends = campaign.sends.filter(
    (send) => send.status === "skipped_archived"
  );

  const skippedBouncedSends = campaign.sends.filter(
    (send) => send.status === "skipped_bounced"
  );

  const skippedComplainedSends = campaign.sends.filter(
    (send) => send.status === "skipped_complained"
  );

  const skippedUnknownSends = campaign.sends.filter(
    (send) => send.status === "skipped_unknown"
  );

  return (
    <AppShell active="campaigns">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Marketing</p>
          <h2 className="text-3xl font-bold">{campaign.name}</h2>
          <p className="mt-2 text-sm text-slate-400">
            Status: <span className="capitalize">{campaign.status}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/campaigns/${campaign.id}/preview`}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Preview
          </Link>

          <Link
            href={`/campaigns/${campaign.id}/edit`}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Edit Campaign
          </Link>

          <Link
            href="/campaigns"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Back to Campaigns
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Subject Line</p>
          <p className="mt-3 text-lg font-semibold">{campaign.subject}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Target List</p>
          <p className="mt-3 text-lg font-semibold">{campaign.list.name}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Created</p>
          <p className="mt-3 text-lg font-semibold">
            {new Date(campaign.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Send Eligibility</h3>
          <p className="mt-1 text-sm text-slate-400">
            Current status of contacts in the selected target list.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Total Contacts</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {listContacts.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Eligible to Send</p>
            <p className="mt-2 text-2xl font-bold text-green-400">
              {eligibleContacts.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Unsubscribed</p>
            <p className="mt-2 text-2xl font-bold text-red-400">
              {unsubscribedContacts.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Archived</p>
            <p className="mt-2 text-2xl font-bold text-slate-300">
              {archivedContacts.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Bounced</p>
            <p className="mt-2 text-2xl font-bold text-orange-400">
              {bouncedContacts.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Complained</p>
            <p className="mt-2 text-2xl font-bold text-red-400">
              {complainedContacts.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Unknown</p>
            <p className="mt-2 text-2xl font-bold text-slate-300">
              {unknownStatusContacts.length}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SendTestEmailForm campaignId={campaign.id} />
        <div className="flex items-end">
          <SendCampaignButton
            campaignId={campaign.id}
            campaignStatus={campaign.status}
          />
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Campaign Send Summary</h3>
          <p className="mt-1 text-sm text-slate-400">
            All recorded send outcomes for this campaign.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Sent</p>
            <p className="mt-2 text-2xl font-bold text-green-400">
              {sentSends.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Opened</p>
            <p className="mt-2 text-2xl font-bold text-sky-400">
              {openedSends.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Open Rate</p>
            <p className="mt-2 text-2xl font-bold text-sky-400">
              {openRate}%
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Failed</p>
            <p className="mt-2 text-2xl font-bold text-red-400">
              {failedSends.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Skipped Unsubscribed</p>
            <p className="mt-2 text-2xl font-bold text-yellow-400">
              {skippedUnsubscribedSends.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Skipped Archived</p>
            <p className="mt-2 text-2xl font-bold text-slate-300">
              {skippedArchivedSends.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Skipped Bounced</p>
            <p className="mt-2 text-2xl font-bold text-orange-400">
              {skippedBouncedSends.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Skipped Complained</p>
            <p className="mt-2 text-2xl font-bold text-red-400">
              {skippedComplainedSends.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Skipped Unknown</p>
            <p className="mt-2 text-2xl font-bold text-slate-300">
              {skippedUnknownSends.length}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h3 className="text-xl font-semibold">Recent Sends</h3>

        {campaign.sends.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No send history yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Sent At</th>
                  <th className="px-4 py-3 font-medium">Opened</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {campaign.sends.slice(0, 10).map((send) => (
                  <tr key={send.id}>
                    <td className="px-4 py-3 text-slate-300">{send.email}</td>
                    <td className="px-4 py-3">
                      <span className={getSendStatusClassName(send.status)}>
                        {send.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(send.sentAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {send.openedAt
                        ? new Date(send.openedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {getFriendlySendError(send.error)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <div className="mb-4">
          <h3 className="text-xl font-semibold">Email Preview</h3>
          <p className="mt-1 text-sm text-slate-400">
            {campaign.html
              ? "Showing the HTML version of this campaign."
              : "No HTML version found, showing the plain text body."}
          </p>
        </div>

        {campaign.html ? (
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-white">
            <iframe
              title="Email preview"
              srcDoc={campaign.html}
              className="h-[600px] w-full bg-white"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="whitespace-pre-wrap text-sm text-slate-300">
              {campaign.body}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
