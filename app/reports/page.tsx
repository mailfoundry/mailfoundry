import Link from "next/link";
import AppShell from "../../src/components/app-shell";
import { prisma } from "../../src/lib/prisma";

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

export default async function ReportsPage() {
  const [
    totalCampaigns,
    totalEmailsSent,
    failedSends,
    skippedUnsubscribedSends,
    skippedArchivedSends,
    skippedBouncedSends,
    skippedComplainedSends,
    skippedUnknownSends,
    recentSends,
  ] = await Promise.all([
    prisma.campaign.count(),
    prisma.campaignSend.count({
      where: {
        status: "sent",
      },
    }),
    prisma.campaignSend.count({
      where: {
        status: "failed",
      },
    }),
    prisma.campaignSend.count({
      where: {
        status: "skipped_unsubscribed",
      },
    }),
    prisma.campaignSend.count({
      where: {
        status: "skipped_archived",
      },
    }),
    prisma.campaignSend.count({
      where: {
        status: "skipped_bounced",
      },
    }),
    prisma.campaignSend.count({
      where: {
        status: "skipped_complained",
      },
    }),
    prisma.campaignSend.count({
      where: {
        status: "skipped_unknown",
      },
    }),
    prisma.campaignSend.findMany({
      orderBy: {
        sentAt: "desc",
      },
      take: 10,
      include: {
        campaign: true,
        contact: true,
      },
    }),
  ]);

  return (
    <AppShell active="reports">
      <header className="mb-10">
        <p className="text-sm text-slate-400">Analytics</p>
        <h2 className="text-3xl font-bold">Reports</h2>
        <p className="mt-2 text-sm text-slate-400">
          A quick overview of campaign sending activity.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Total Campaigns</p>
          <p className="mt-3 text-3xl font-bold">{totalCampaigns}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Emails Sent</p>
          <p className="mt-3 text-3xl font-bold text-green-400">
            {totalEmailsSent}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Failed Sends</p>
          <p className="mt-3 text-3xl font-bold text-red-400">{failedSends}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Skipped Unsubscribed</p>
          <p className="mt-3 text-3xl font-bold text-yellow-400">
            {skippedUnsubscribedSends}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Skipped Archived</p>
          <p className="mt-3 text-3xl font-bold text-slate-300">
            {skippedArchivedSends}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Skipped Bounced</p>
          <p className="mt-3 text-3xl font-bold text-orange-400">
            {skippedBouncedSends}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Skipped Complained</p>
          <p className="mt-3 text-3xl font-bold text-red-400">
            {skippedComplainedSends}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Skipped Unknown</p>
          <p className="mt-3 text-3xl font-bold text-slate-300">
            {skippedUnknownSends}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h3 className="text-xl font-semibold">Recent Send Activity</h3>

        {recentSends.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No send activity yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Sent At</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentSends.map((send) => (
                  <tr key={send.id}>
                    <td className="px-4 py-3 text-slate-300">
                      <Link
                        href={`/campaigns/${send.campaign.id}`}
                        className="hover:underline"
                      >
                        {send.campaign.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{send.email}</td>
                    <td className="px-4 py-3">
                      <span className={getSendStatusClassName(send.status)}>
                        {send.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(send.sentAt).toLocaleString()}
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
    </AppShell>
  );
}
