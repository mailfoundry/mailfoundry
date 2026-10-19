export const metadata = { title: "Campaign planner" };
export const dynamic = "force-dynamic";

import Link from "next/link";
import AppShell from "../../../src/components/app-shell";
import { prisma } from "../../../src/lib/prisma";
import {
  activeApproval, describeDays, describePreferred, finalFingerprint, parsePreferredTimes, preflight, ukMidnight, ukParts,
} from "../../../src/lib/brand-rules";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_STYLE: Record<string, string> = { go: "bg-green-100 text-green-800", hold: "bg-amber-100 text-amber-800", stop: "bg-red-100 text-red-800" };
const STAGE_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  concept_approved: "bg-blue-100 text-blue-800",
  final_approved: "bg-indigo-100 text-indigo-800",
  scheduled: "bg-green-100 text-green-800",
  sent: "bg-gray-200 text-gray-600",
  blocked: "bg-red-100 text-red-800",
};

export default async function PlannerPage() {
  const today = ukMidnight(new Date());
  const days = Array.from({ length: 14 }, (_, i) => ukMidnight(new Date(today.getTime() + i * 86400_000 + 12 * 3600_000)));
  const end = ukMidnight(new Date(today.getTime() + 15 * 86400_000));

  const [brands, campaigns, exceptions, lists] = await Promise.all([
    prisma.brand.findMany({ orderBy: { key: "asc" } }),
    prisma.campaign.findMany({
      where: { brandKey: { not: null }, plannedSendAt: { gte: today, lt: end }, status: { not: "cancelled" } },
      include: { list: true },
      orderBy: { plannedSendAt: "asc" },
    }),
    prisma.scheduleException.findMany({ where: { date: { gte: ukParts(today).ymd } } }),
    prisma.list.findMany({ where: { brandKey: { not: null } }, select: { id: true, name: true } }),
  ]);
  const listName = Object.fromEntries(lists.map((l) => [l.id, l.name]));

  const rows = await Promise.all(
    campaigns.map(async (c) => {
      const [concept, final] = await Promise.all([activeApproval(c.id, "concept"), activeApproval(c.id, "final")]);
      const finalValid = !!final && final.fingerprint === finalFingerprint(c);
      const stage = ["scheduled", "sending", "sent", "blocked", "failed"].includes(c.status) ? c.status : finalValid ? "final_approved" : concept ? "concept_approved" : "draft";
      const check = await preflight(c.id, finalValid ? "schedule" : "approve");
      return { c, stage, check };
    })
  );

  return (
    <AppShell active="campaigns">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Marketing</p>
          <h2 className="text-3xl font-bold">Campaign planner</h2>
          <p className="mt-1 text-sm text-gray-500">Next 14 days, UK time. Rules are enforced at approval, scheduling and send.</p>
        </div>
        <Link href="/campaigns" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">Back to Campaigns</Link>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {brands.map((b) => (
          <div key={b.key} className="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <strong>{b.name}</strong>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${STATUS_STYLE[b.status] ?? STATUS_STYLE.stop}`}>{b.status}</span>
            </div>
            <ul className="space-y-0.5 text-gray-600">
              <li>Days: {describeDays(b.sendDays)} · preferred {describePreferred(b.preferredTimes) || "—"} · window {b.sendWindowStart}–{b.sendWindowEnd}</li>
              <li>Max 1/day per contact (all brands) · max {b.weeklyCapPerContact} per contact per 7 days</li>
              {b.maxCampaignsPerWeek != null && <li className="font-medium text-amber-800">Max {b.maxCampaignsPerWeek} campaign(s) per week</li>}
              {b.requiredListId && <li className="font-medium text-amber-800">Recovery: {listName[b.requiredListId] ?? "engaged list"} only</li>}
              {b.maxAudiencePerSend != null && <li>Ramp cap {b.maxAudiencePerSend} per send</li>}
              <li>Agent scheduling {b.agentSchedulingEnabled ? "ON" : "OFF"}{b.statusReason ? ` · ${b.statusReason}` : ""}</li>
            </ul>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {days.map((d) => {
          const p = ukParts(d);
          const dayRows = rows.filter((r) => r.c.plannedSendAt && ukParts(r.c.plannedSendAt).ymd === p.ymd);
          const dayEx = exceptions.filter((e) => e.date === p.ymd);
          return (
            <div key={p.ymd} className="grid grid-cols-[120px_1fr] border-b border-gray-100 last:border-0">
              <div className="bg-gray-50 p-3 text-sm font-semibold">
                {DAYS[p.weekday]} {Number(p.ymd.slice(8))}/{Number(p.ymd.slice(5, 7))}
              </div>
              <div className="space-y-2 p-3 text-sm">
                <div className="flex flex-wrap gap-2 text-xs">
                  {brands.map((b) => {
                    const on = b.sendDays.split(",").map(Number).includes(p.weekday);
                    const pref = parsePreferredTimes(b.preferredTimes)[p.weekday];
                    return on ? (
                      <span key={b.key} className="rounded bg-gray-100 px-2 py-0.5">
                        {b.key.toUpperCase()} slot {pref ?? b.sendWindowStart} ({b.sendWindowStart}–{b.sendWindowEnd})
                      </span>
                    ) : null;
                  })}
                  {dayEx.map((e) => (
                    <span key={e.id} className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                      {e.brandKey.toUpperCase()} exception {e.startTime} (one campaign)
                    </span>
                  ))}
                </div>
                {dayRows.map(({ c, stage, check }) => (
                  <div key={c.id} className="rounded-lg border border-gray-200 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{ukParts(c.plannedSendAt!).hhmm}</strong>
                      <span className="text-xs uppercase text-gray-500">{c.brandKey}</span>
                      <Link className="underline" href={`/campaigns/${c.id}`}>{c.name}</Link>
                      <span className="text-gray-500">· {c.list.name}{c.list.isTest ? " (test)" : ""} · {c.cohort ? `Group ${c.cohort}` : "whole list"} · {check.audienceSize} eligible</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_STYLE[stage] ?? STAGE_STYLE.draft}`}>{stage.replace("_", " ")}</span>
                    </div>
                    {check.errors.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-red-700">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
                    {check.warnings.length > 0 && <p className="mt-1 text-xs text-amber-800">{check.warnings.join(" · ")}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
