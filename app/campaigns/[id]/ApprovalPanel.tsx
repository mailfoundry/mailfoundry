import { prisma } from "../../../src/lib/prisma";
import { activeApproval, finalFingerprint, preflight } from "../../../src/lib/brand-rules";
import { approveConcept, approveFinal, cancelCampaign, revokeFinal, scheduleApproved, unschedule } from "./approval-actions";

const fmt = (d: Date | null | undefined) =>
  d
    ? d.toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

const STATUS_STYLE: Record<string, string> = {
  go: "bg-green-100 text-green-800",
  hold: "bg-amber-100 text-amber-800",
  stop: "bg-red-100 text-red-800",
};

/** Brand rules + approvals for SCS/SWF campaigns. Renders nothing for unbranded campaigns. */
export default async function ApprovalPanel({ campaignId }: { campaignId: string }) {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { brand: true, list: true } });
  if (!c?.brandKey || !c.brand) return null;

  const [concept, final, approveCheck, scheduleCheck, history] = await Promise.all([
    activeApproval(c.id, "concept"),
    activeApproval(c.id, "final"),
    preflight(c.id, "approve"),
    preflight(c.id, "schedule"),
    prisma.auditLog.findMany({ where: { campaignId: c.id }, orderBy: { at: "desc" }, take: 15 }),
  ]);
  const finalValid = !!final && final.fingerprint === finalFingerprint(c);
  const editable = !["sending", "sent", "cancelled"].includes(c.status);
  const btn = "rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Brand rules &amp; approval — {c.brand.name}</h3>
          <p className="mt-1 text-sm text-gray-500">
            From {c.fromEmail} · {c.list.name}
            {c.list.isTest ? " (test list)" : ""} · {c.cohort ? `Group ${c.cohort}` : "whole list"} · {approveCheck.audienceSize} eligible
            · planned {fmt(c.plannedSendAt)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS_STYLE[c.brand.status] ?? STATUS_STYLE.stop}`}>
          {c.brand.status}
          {c.brand.statusReason ? ` · ${c.brand.statusReason}` : ""}
        </span>
      </div>

      {c.status === "blocked" && c.blockedReason && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Blocked at send time:</strong> {c.blockedReason}
        </p>
      )}

      {approveCheck.errors.length > 0 && (
        <ul className="mb-4 list-disc rounded-lg border border-amber-200 bg-amber-50 p-3 pl-8 text-sm text-amber-900">
          {approveCheck.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {approveCheck.warnings.length > 0 && (
        <p className="mb-4 text-sm text-gray-500">Note: {approveCheck.warnings.join(" · ")}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-700">1 · Concept</p>
          <p className="mt-1 text-sm text-gray-500">
            {concept ? `Approved by ${concept.approvedBy}, ${fmt(concept.approvedAt)}` : "Not approved"}
          </p>
          {c.conceptNotes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{c.conceptNotes}</p>}
          {editable && !concept && (
            <form action={approveConcept.bind(null, c.id)} className="mt-3">
              <button className={`${btn} bg-gray-900 text-white`}>Approve concept</button>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-700">2 · Final campaign</p>
          <p className="mt-1 text-sm text-gray-500">
            {final
              ? finalValid
                ? `Approved by ${final.approvedBy}, ${fmt(final.approvedAt)} — ${final.audienceSize} contacts at ${fmt(final.sendAt)}`
                : "Approval is out of date — the campaign changed"
              : "Not approved"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {editable && !finalValid && (
              <form action={approveFinal.bind(null, c.id)}>
                <button className={`${btn} bg-orange-600 text-white`} disabled={!approveCheck.ok}>
                  Approve final for {approveCheck.audienceSize} contacts
                </button>
              </form>
            )}
            {finalValid && ["draft", "blocked"].includes(c.status) && (
              <form action={scheduleApproved.bind(null, c.id)}>
                <button className={`${btn} bg-green-700 text-white`} disabled={!scheduleCheck.ok}>
                  Schedule for {fmt(c.plannedSendAt)}
                </button>
              </form>
            )}
            {c.status === "scheduled" && (
              <form action={unschedule.bind(null, c.id)}>
                <button className={`${btn} border border-gray-300 bg-white text-gray-700`}>Unschedule</button>
              </form>
            )}
            {finalValid && editable && (
              <form action={revokeFinal.bind(null, c.id)}>
                <button className={`${btn} border border-gray-300 bg-white text-gray-700`}>Revoke approval</button>
              </form>
            )}
            {editable && (
              <form action={cancelCampaign.bind(null, c.id)}>
                <button className={`${btn} border border-red-300 bg-white text-red-700`}>Cancel campaign</button>
              </form>
            )}
          </div>
          {finalValid && !scheduleCheck.ok && ["draft", "blocked"].includes(c.status) && (
            <p className="mt-2 text-xs text-red-600">{scheduleCheck.errors.join(" · ")}</p>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-600">Audit trail ({history.length})</summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {history.map((h) => (
              <li key={h.id}>
                {fmt(h.at)} · <strong>{h.action}</strong> · {h.actor}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
