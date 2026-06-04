import Link from "next/link";
import { prisma } from "../../src/lib/prisma";
import AppShell from "../../src/components/app-shell";

function getCampaignStatusBadge(status: string) {
  if (status === "sent") {
    return {
      label: "Sent",
      className: "bg-green-500/10 text-green-400",
    };
  }

  if (status === "partially_sent") {
    return {
      label: "Partially Sent",
      className: "bg-yellow-500/10 text-yellow-400",
    };
  }

  return {
    label: "Draft",
    className: "bg-slate-500/10 text-slate-300",
  };
}

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      list: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <AppShell active="campaigns">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Marketing</p>
          <h2 className="text-3xl font-bold">Campaigns</h2>
        </div>

        <Link
          href="/campaigns/new"
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          New Campaign
        </Link>
      </header>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8">
          <h3 className="text-xl font-semibold">No campaigns yet</h3>
          <p className="mt-3 max-w-2xl text-slate-400">
            Create your first draft campaign to start building your email flow.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Subject</th>
                <th className="px-6 py-4 font-medium">List</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-slate-800">
                  <td className="px-6 py-4">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="hover:underline"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">{campaign.subject}</td>
                  <td className="px-6 py-4">{campaign.list.name}</td>
                  <td className="px-6 py-4">
                    {(() => {
                      const status = getCampaignStatusBadge(campaign.status);

                      return (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
