export const metadata = { title: "Brands & sending rules" };
export const dynamic = "force-dynamic";

import AppShell from "../../../src/components/app-shell";
import ActionButton from "../../../src/components/action-button";
import { prisma } from "../../../src/lib/prisma";
import { computeBrandHealth, describeDays, describePreferred, ELIGIBLE_CONTACT, THRESHOLDS } from "../../../src/lib/brand-rules";
import { assignList, deleteException, setBrandStatus, setPostmaster, updateBrandRules } from "./actions";

const input = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none";
const label = "mb-1 block text-xs font-medium text-gray-500";
const STATUS_STYLE: Record<string, string> = {
  go: "bg-green-100 text-green-800",
  hold: "bg-amber-100 text-amber-800",
  stop: "bg-red-100 text-red-800",
};

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const { flash } = await searchParams;
  const [brands, lists, exceptions] = await Promise.all([
    prisma.brand.findMany({ orderBy: { key: "asc" } }),
    prisma.list.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { contacts: { where: { contact: ELIGIBLE_CONTACT } } } } } }),
    prisma.scheduleException.findMany({ orderBy: [{ date: "desc" }, { startTime: "asc" }] }),
  ]);
  const campaignNames = Object.fromEntries(
    (await prisma.campaign.findMany({ where: { id: { in: exceptions.map((e) => e.campaignId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name])
  );
  const health = Object.fromEntries(await Promise.all(brands.map(async (b) => [b.key, await computeBrandHealth(b.key)] as const)));

  return (
    <AppShell active="settings">
      <header className="mb-8">
        <p className="text-sm text-gray-500">Settings</p>
        <h2 className="text-3xl font-bold">Brands &amp; sending rules</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-500">
          These rules apply to every campaign on a list assigned to a brand, whether it&apos;s created here or by the ChatGPT agent.
          Status escalates automatically (Go → Hold → Stop) from the last 7 days&apos; complaints ({THRESHOLDS.complaints.hold}% / {THRESHOLDS.complaints.stop}%),
          bounces ({THRESHOLDS.bounces.hold}% / {THRESHOLDS.bounces.stop}%), unsubscribes ({THRESHOLDS.unsubscribes.hold}% / {THRESHOLDS.unsubscribes.stop}%) and the Postmaster
          rate you enter. Only you can move a brand back down.
        </p>
      </header>

      {flash && <p role="status" className="mb-6 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-800"><span aria-hidden="true">✓</span>{flash}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        {brands.map((b) => {
          const h = health[b.key];
          return (
            <section key={b.key} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">{b.name}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS_STYLE[b.status] ?? STATUS_STYLE.stop}`}>{b.status}</span>
              </div>
              {b.statusReason && <p className="mb-3 text-sm text-gray-600">Reason: {b.statusReason} {b.statusSetBy ? `(${b.statusSetBy})` : ""}</p>}

              <div className="mb-5 grid grid-cols-4 gap-2 text-center text-sm">
                {[
                  ["Sends 7d", String(h.sends)],
                  ["Complaints", `${h.complaints} · ${h.complaintRate}%`],
                  ["Bounces", `${h.bounces} · ${h.bounceRate}%`],
                  ["Unsubs", `${h.unsubscribes} · ${h.unsubscribeRate}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">{k}</p>
                    <p className="font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <p className="mb-5 text-sm text-gray-600">
                Rules suggest: <strong className="uppercase">{h.recommended}</strong>
                {h.reasons.length ? ` — ${h.reasons.join(", ")}` : ""}
              </p>

              <form key={`${b.key}-status-${b.updatedAt.getTime()}`} action={setBrandStatus.bind(null, b.key)} className="mb-5 flex flex-wrap items-end gap-2">
                <div>
                  <label className={label}>Set status</label>
                  <select name="status" defaultValue={b.status} className={input}>
                    <option value="go">Go</option>
                    <option value="hold">Hold</option>
                    <option value="stop">Stop</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className={label}>Reason</label>
                  <input name="reason" className={input} placeholder="e.g. Week 2 passed — growing to 2,000" />
                </div>
                <ActionButton pendingText="Saving…" className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white">Save status</ActionButton>
              </form>

              <form key={`${b.key}-pm-${b.updatedAt.getTime()}`} action={setPostmaster.bind(null, b.key)} className="mb-5 flex items-end gap-2">
                <div className="flex-1">
                  <label className={label}>
                    Postmaster spam rate % {b.postmasterUpdatedAt ? `(last entered ${b.postmasterUpdatedAt.toLocaleDateString("en-GB")})` : "(not entered)"} — blank = no data
                  </label>
                  <input name="rate" defaultValue={b.postmasterSpamRate ?? ""} className={input} placeholder="e.g. 0.05" />
                </div>
                <ActionButton pendingText="Saving…" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">Save</ActionButton>
              </form>

              <form key={`${b.key}-rules-${b.updatedAt.getTime()}`} action={updateBrandRules.bind(null, b.key)} className="grid grid-cols-2 gap-3">
                <div><label className={label}>From name</label><input name="fromName" defaultValue={b.fromName} className={input} /></div>
                <div><label className={label}>From email</label><input name="fromEmail" defaultValue={b.fromEmail} className={input} /></div>
                <div><label className={label}>Max emails per contact / 7 days</label><input name="weeklyCapPerContact" type="number" min={1} defaultValue={b.weeklyCapPerContact} className={input} /></div>
                <div><label className={label}>Max audience per send (ramp cap, blank = none)</label><input name="maxAudiencePerSend" type="number" min={0} defaultValue={b.maxAudiencePerSend ?? ""} className={input} /></div>
                <div><label className={label}>Send days (1=Mon … 7=Sun) — now {describeDays(b.sendDays)}</label><input name="sendDays" defaultValue={b.sendDays} className={input} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={label}>Window from (UK)</label><input name="sendWindowStart" defaultValue={b.sendWindowStart} className={input} /></div>
                  <div><label className={label}>to</label><input name="sendWindowEnd" defaultValue={b.sendWindowEnd} className={input} /></div>
                </div>
                <div><label className={label}>Preferred times (e.g. 1=09:30,3=09:30) — {describePreferred(b.preferredTimes) || "none"}</label><input name="preferredTimes" defaultValue={b.preferredTimes ?? ""} className={input} /></div>
                <div><label className={label}>Max campaigns per week (blank = none)</label><input name="maxCampaignsPerWeek" type="number" min={0} defaultValue={b.maxCampaignsPerWeek ?? ""} className={input} /></div>
                <div className="col-span-2">
                  <label className={label}>Recovery: campaigns must use this list (blank = any {b.key.toUpperCase()} list)</label>
                  <select name="requiredListId" defaultValue={b.requiredListId ?? ""} className={input}>
                    <option value="">— any list —</option>
                    {lists.filter((l) => l.brandKey === b.key && !l.isTest).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" name="agentSchedulingEnabled" defaultChecked={b.agentSchedulingEnabled} />
                  Allow the ChatGPT agent to schedule approved {b.key.toUpperCase()} campaigns
                </label>
                <ActionButton pendingText="Saving rules…" className="col-span-2 justify-center rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white">Save rules</ActionButton>
              </form>
            </section>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">One-off schedule exceptions</h3>
        <p className="mb-4 mt-1 text-sm text-gray-500">Each lets ONE campaign send outside its brand&apos;s days/window, on one date and time. Every other rule and approval still applies.</p>
        {exceptions.length === 0 ? (
          <p className="text-sm text-gray-400">None.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {exceptions.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <strong>{e.brandKey.toUpperCase()}</strong> · {e.date} {e.startTime}
                  {e.endTime !== e.startTime ? `–${e.endTime}` : ""} UK · <a className="underline" href={`/campaigns/${e.campaignId}`}>{campaignNames[e.campaignId] ?? e.campaignId}</a> · {e.reason}
                </span>
                <form action={deleteException.bind(null, e.id)}>
                  <ActionButton pendingText="Removing…" className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700">Remove</ActionButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Lists</h3>
        <p className="mb-4 mt-1 text-sm text-gray-500">
          Assigning a list to a brand switches on that brand&apos;s rules for every campaign sent to it. Unassigned lists keep the old behaviour
          and can&apos;t be used by the agent. Mark exactly one small list of your own addresses as a test list (&quot;Agent Test&quot;).
        </p>
        <div className="divide-y divide-gray-100">
          {lists.map((l) => (
            <form key={l.id} action={assignList.bind(null, l.id)} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="min-w-64 flex-1 font-medium">
                {l.name} <span className="font-normal text-gray-400">· {l._count.contacts} eligible</span>
              </span>
              <select name="brandKey" defaultValue={l.brandKey ?? ""} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                <option value="">Unassigned</option>
                {brands.map((b) => <option key={b.key} value={b.key}>{b.key.toUpperCase()}</option>)}
              </select>
              <label className="flex items-center gap-1">
                <input type="checkbox" name="isTest" defaultChecked={l.isTest} /> test list
              </label>
              <ActionButton pendingText="Saving…" className="rounded-lg border border-gray-300 px-3 py-1 font-semibold">Save</ActionButton>
            </form>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
