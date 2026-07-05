import Link from "next/link";
import AppShell from "../../src/components/app-shell";
import { prisma } from "../../src/lib/prisma";

export default async function ReportsPage() {
  const [totals, campaigns] = await Promise.all([
    Promise.all([
      prisma.campaign.count(),
      prisma.campaignSend.count({ where: { status: "sent" } }),
      prisma.campaignSend.count({ where: { status: "failed" } }),
      prisma.campaignSend.count({ where: { openedAt: { not: null } } }),
      prisma.campaignClick.count(),
    ]),
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        list: { select: { name: true } },
        _count: { select: { sends: true } },
        sends: {
          select: { status: true, openedAt: true },
        },
      },
    }),
  ]);

  const [totalCampaigns, totalSent, totalFailed, totalOpens, totalClicks] = totals;

  const overallOpenRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;
  const overallClickRate = totalSent > 0 ? Math.round((totalClicks / totalSent) * 100) : 0;

  const campaignRows = campaigns.map((c) => {
    const sent = c.sends.filter((s) => s.status === "sent").length;
    const opens = c.sends.filter((s) => s.openedAt !== null).length;
    const skipped = c.sends.filter((s) => s.status.startsWith("skipped_")).length;
    const failed = c.sends.filter((s) => s.status === "failed").length;
    const openRate = sent > 0 ? Math.round((opens / sent) * 100) : 0;
    return { ...c, sent, opens, skipped, failed, openRate };
  });

  return (
    <AppShell active="reports">
      <header className="mb-10">
        <p className="text-sm text-slate-400">Analytics</p>
        <h2 className="text-3xl font-bold">Reports</h2>
      </header>

      {/* Top-level stats */}
      <div className="mb-10 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Campaigns", value: totalCampaigns, color: "text-white" },
          { label: "Emails Sent", value: totalSent, color: "text-green-400" },
          { label: "Total Opens", value: totalOpens, color: "text-sky-400" },
          { label: "Total Clicks", value: totalClicks, color: "text-orange-400" },
          { label: "Failed Sends", value: totalFailed, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className={`mt-3 text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Overall rates */}
      <div className="mb-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Overall Open Rate</p>
          <p className="mt-3 text-4xl font-bold text-sky-400">{overallOpenRate}%</p>
          <div className="mt-4 h-2 w-full rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-sky-500" style={{ width: `${overallOpenRate}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{totalOpens} opens from {totalSent} sent</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Overall Click Rate</p>
          <p className="mt-3 text-4xl font-bold text-orange-400">{overallClickRate}%</p>
          <div className="mt-4 h-2 w-full rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-orange-500" style={{ width: `${overallClickRate}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{totalClicks} clicks from {totalSent} sent</p>
        </div>
      </div>

      {/* Per-campaign table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <h3 className="text-lg font-semibold">Campaign Breakdown</h3>
        </div>
        {campaignRows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500">No campaigns yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Campaign</th>
                <th className="px-6 py-4 font-medium">List</th>
                <th className="px-6 py-4 font-medium">Sent</th>
                <th className="px-6 py-4 font-medium">Opens</th>
                <th className="px-6 py-4 font-medium">Open Rate</th>
                <th className="px-6 py-4 font-medium">Skipped</th>
                <th className="px-6 py-4 font-medium">Failed</th>
                <th className="px-6 py-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.map((c) => (
                <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-950/30">
                  <td className="px-6 py-4">
                    <Link href={`/campaigns/${c.id}`} className="hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{c.list.name}</td>
                  <td className="px-6 py-4 text-green-400 font-semibold">{c.sent}</td>
                  <td className="px-6 py-4 text-sky-400">{c.opens}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-slate-800">
                        <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${c.openRate}%` }} />
                      </div>
                      <span className="text-slate-300">{c.openRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{c.skipped}</td>
                  <td className="px-6 py-4 text-red-400">{c.failed || "—"}</td>
                  <td className="px-6 py-4 text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
