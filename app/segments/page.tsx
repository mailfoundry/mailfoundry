export const metadata = { title: "Segments" };

import Link from "next/link";
import AppShell from "../../src/components/app-shell";
import { prisma } from "../../src/lib/prisma";
import {
  ACTIVITY_OPTIONS, ELIGIBLE_WHERE, buildContactWhere, hasAnyFilter, readFilterParams,
} from "../../src/lib/segments";
import { saveSegmentAsList } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | undefined>>;

const selectCls = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900";

export default async function SegmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const f = readFilterParams(sp);

  const [campaigns, lists] = await Promise.all([
    prisma.campaign.findMany({
      where:   { status: { in: ["sent", "partially_sent"] } },
      orderBy: { createdAt: "desc" },
      select:  { id: true, name: true },
    }),
    prisma.list.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const isFiltered = hasAnyFilter(f);
  const where = buildContactWhere(f);

  const [total, eligible, contacts] = isFiltered
    ? await Promise.all([
        prisma.contact.count({ where }),
        prisma.contact.count({ where: { AND: [where, ELIGIBLE_WHERE] } }),
        prisma.contact.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take:    100,
          select: {
            id: true, email: true, firstName: true, lastName: true, country: true, source: true,
            subscribedAt: true, unsubscribedAt: true, bouncedAt: true, complainedAt: true, archivedAt: true,
          },
        }),
      ])
    : [0, 0, []];

  function badge(c: typeof contacts[number]) {
    if (c.complainedAt)   return { label: "Complained", cls: "bg-red-500/10 text-red-600" };
    if (c.unsubscribedAt) return { label: "Unsub",      cls: "bg-red-500/10 text-red-500" };
    if (c.archivedAt)     return { label: "Archived",   cls: "bg-gray-100 text-gray-600" };
    if (c.bouncedAt)      return { label: "Bounced",    cls: "bg-orange-500/10 text-orange-400" };
    if (c.subscribedAt)   return { label: "Subscribed", cls: "bg-green-500/10 text-green-600" };
    return { label: "Unknown", cls: "bg-gray-100 text-gray-500" };
  }

  // Warm-up presets — keep the currently chosen list (e.g. SWF Customers) if one is selected
  const preset = (activity: string) => {
    const p = new URLSearchParams({ status: "subscribed", activity });
    if (f.list) p.set("list", f.list);
    return `/segments?${p}`;
  };

  return (
    <AppShell active="segments">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Marketing</p>
          <h2 className="text-3xl font-bold">Segments</h2>
          <p className="mt-1 text-sm text-gray-500">
            Filter your audience by behaviour, status, and engagement — then save it as a list to send to.
          </p>
        </div>
      </header>

      {/* Warm-up presets */}
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-semibold text-amber-900">Reputation warm-up presets</h3>
        <p className="mt-1 text-xs text-amber-800">
          Send to the most engaged first, grow slowly, and leave never-engaged contacts until last (or drop them).
          Pick a list below first to scope these to SWF or SCS.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={preset("opened_30")}     className="rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">1 · Opened in 30 days</Link>
          <Link href={preset("opened_90")}     className="rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">2 · Opened in 90 days</Link>
          <Link href={preset("clicked_180")}   className="rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">3 · Clicked in 180 days</Link>
          <Link href={preset("never_sent")}    className="rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">4 · Never emailed yet</Link>
          <Link href={preset("never_engaged")} className="rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">5 · Never engaged (hold back)</Link>
        </div>
        <p className="mt-2 text-[11px] text-amber-700">
          Note: Apple Mail pre-loads images, so some &ldquo;opens&rdquo; are automatic. Clicks are the stronger signal.
        </p>
      </div>

      {/* Filter form */}
      <form method="GET" className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">
        <h3 className="font-semibold text-gray-800">Filters</h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">List</label>
            <select name="list" defaultValue={f.list} className={selectCls}>
              <option value="">Any list</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Contact status</label>
            <select name="status" defaultValue={f.status} className={selectCls}>
              <option value="any">Any status</option>
              <option value="subscribed">Subscribed (eligible)</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="bounced">Bounced</option>
              <option value="complained">Complained</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Activity (all campaigns)</label>
            <select name="activity" defaultValue={f.activity} className={selectCls}>
              {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Country</label>
            <select name="country" defaultValue={f.country} className={selectCls}>
              <option value="any">Any country</option>
              <option value="gb">UK only (GB)</option>
              <option value="non-gb">Non-UK</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Campaign</label>
            <select name="campaign" defaultValue={f.campaign} className={selectCls}>
              <option value="">Any campaign</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Engagement (selected campaign)</label>
            <select name="engagement" defaultValue={f.engagement} className={selectCls}>
              <option value="any">Any</option>
              <option value="sent">Sent to</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked a link</option>
              <option value="failed">Skipped / failed</option>
              <option value="not_sent">Not yet sent</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Import source contains</label>
            <input type="text" name="source" defaultValue={f.source} placeholder="e.g. shopify"
              className={`${selectCls} placeholder-gray-400`} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Link clicked contains</label>
            <input type="text" name="urlContains" defaultValue={f.urlContains} placeholder="e.g. /products/kindling"
              className={`${selectCls} placeholder-gray-400`} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
            Apply filters
          </button>
          <Link href="/segments" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Clear
          </Link>
        </div>
      </form>

      {/* Save as list */}
      {isFiltered && eligible > 0 && (
        <form action={saveSegmentAsList} className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          {Object.entries(f).map(([k, v]) => <input key={k} type="hidden" name={k} value={v ?? ""} />)}
          <h3 className="font-semibold text-gray-800">Save as list</h3>
          <p className="mt-1 text-xs text-gray-500">
            Adds up to the chosen number of the <strong>{eligible.toLocaleString()}</strong> send-eligible contacts in this
            segment. Contacts already in the target list are skipped — so you can add the next batch to the same list
            each day, then press <em>Continue Sending</em> on the campaign to email only the new ones.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Add to existing list</label>
              <select name="targetListId" defaultValue="" className={selectCls}>
                <option value="">— New list —</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">…or new list name</label>
              <input type="text" name="newListName" placeholder="e.g. SWF Warm-up" className={`${selectCls} placeholder-gray-400`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Max contacts to add</label>
              <input type="number" name="limit" min={1} defaultValue={500} className={selectCls} />
            </div>
            <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
              Save to list
            </button>
          </div>
        </form>
      )}

      {/* Results */}
      {isFiltered && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              {total === 0 ? "No contacts match" : (
                <>
                  <span className="text-gray-900 font-bold">{total.toLocaleString()}</span>
                  {" "}contact{total !== 1 ? "s" : ""} match
                  <span className="ml-2 text-sm font-normal text-gray-500">({eligible.toLocaleString()} eligible to send)</span>
                  {total > 100 ? <span className="text-sm font-normal text-gray-500"> — showing first 100</span> : ""}
                </>
              )}
            </h3>
          </div>

          {total > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Email</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Source</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Country</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map(c => {
                    const b = badge(c);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{c.email}</td>
                        <td className="px-4 py-3 text-gray-600">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>{b.label}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.source || "—"}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.country || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/contacts/${c.id}`} className="text-xs text-gray-400 hover:text-gray-700 hover:underline">View →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!isFiltered && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Apply one or more filters above, or use a warm-up preset.</p>
        </div>
      )}
    </AppShell>
  );
}
