import Link from "next/link";
import { prisma } from "../../src/lib/prisma";
import AppShell from "../../src/components/app-shell";

export default async function DashboardPage() {
  const [
    totalContacts,
    eligibleContacts,
    totalLists,
    totalCampaigns,
    sentCampaigns,
    emailsSent,
    failedSends,
    totalOpens,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({
      where: {
        subscribedAt: { not: null },
        unsubscribedAt: null,
        archivedAt: null,
        bouncedAt: null,
        complainedAt: null,
      },
    }),
    prisma.list.count(),
    prisma.campaign.count(),
    prisma.campaign.count({
      where: { status: { in: ["sent", "partially_sent"] } },
    }),
    prisma.campaignSend.count({ where: { status: "sent" } }),
    prisma.campaignSend.count({ where: { status: "failed" } }),
    prisma.campaignSend.count({
      where: { status: "sent", openedAt: { not: null } },
    }),
  ]);

  const openRate =
    emailsSent > 0 ? Math.round((totalOpens / emailsSent) * 100) : 0;

  return (
    <AppShell active="dashboard">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Welcome back</p>
          <h2 className="text-3xl font-bold">Dashboard</h2>
        </div>

        <Link
          href="/campaigns/new"
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          New Campaign
        </Link>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Total Contacts</p>
          <p className="mt-3 text-3xl font-bold">{totalContacts}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Eligible Contacts</p>
          <p className="mt-3 text-3xl font-bold text-green-400">
            {eligibleContacts}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Lists</p>
          <p className="mt-3 text-3xl font-bold">{totalLists}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Campaigns</p>
          <p className="mt-3 text-3xl font-bold">{totalCampaigns}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Campaigns Sent</p>
          <p className="mt-3 text-3xl font-bold text-green-400">
            {sentCampaigns}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Emails Sent</p>
          <p className="mt-3 text-3xl font-bold text-green-400">{emailsSent}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Overall Open Rate</p>
          <p className="mt-3 text-3xl font-bold text-sky-400">{openRate}%</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Failed Sends</p>
          <p className="mt-3 text-3xl font-bold text-red-400">{failedSends}</p>
        </div>
      </div>
    </AppShell>
  );
}
