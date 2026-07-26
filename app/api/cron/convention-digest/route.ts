import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { sendEmail } from "../../../../src/lib/sendEmail";

export const dynamic = "force-dynamic";

const RECIPIENTS = ["paulwridge@gmail.com", "ridgejason@me.com", "carol@xylouk.co.uk"];
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Fetch upcoming regional conventions ───────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const conventions = await prisma.ibsaConvention.findMany({
    where: {
      eventType: "regional",
      archivedAt: null,
      status: { not: "complete" },
      conventionDate: { gte: today }, // only future/today conventions
    },
  });

  // ── Sort by collection date (nearest first; TBC at end) ───────────────────
  const daysUntil = (d: Date | null) => {
    if (!d) return Infinity;
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const sorted = [...conventions].sort((a, b) =>
    daysUntil(a.collectionDate) - daysUntil(b.collectionDate)
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtDate = (d: Date | null) =>
    d
      ? d.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "TBC";

  const daysLabel = (d: Date | null) => {
    const days = daysUntil(d);
    if (days === Infinity) return { text: "TBC", color: "#94a3b8", bold: false };
    if (days < 0)  return { text: `OVERDUE (${Math.abs(days)}d ago)`, color: "#ef4444", bold: true };
    if (days === 0) return { text: "TODAY", color: "#ef4444", bold: true };
    if (days === 1) return { text: "Tomorrow", color: "#f97316", bold: true };
    if (days <= 7)  return { text: `${days} days`, color: "#f97316", bold: true };
    if (days <= 14) return { text: `${days} days`, color: "#d97706", bold: false };
    return { text: `${days} days`, color: "#64748b", bold: false };
  };

  const rowBg = (d: Date | null) => {
    const days = daysUntil(d);
    if (days === Infinity) return "#ffffff";
    if (days < 0)   return "#fef2f2";
    if (days <= 7)  return "#fef2f2";
    if (days <= 14) return "#fff7ed";
    return "#ffffff";
  };

  const statusPill = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      pending:  { bg: "#fef9c3", color: "#a16207", label: "Pending" },
      ordered:  { bg: "#dcfce7", color: "#16a34a", label: "Ordered" },
      complete: { bg: "#f0fdf4", color: "#15803d", label: "Complete" },
    };
    const s = map[status] ?? { bg: "#f1f5f9", color: "#64748b", label: status };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${s.bg};color:${s.color};">${s.label}</span>`;
  };

  // ── Build table rows ───────────────────────────────────────────────────────
  const tableRows = sorted
    .map((c, i) => {
      const dl = daysLabel(c.collectionDate);
      const daysCell = `<span style="color:${dl.color};font-weight:${dl.bold ? "bold" : "normal"};">${dl.text}</span>`;
      return `
      <tr style="background:${rowBg(c.collectionDate)};border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px;color:#0f172a;font-size:13px;font-weight:600;">${i + 1}. ${c.name}</td>
        <td style="padding:10px 12px;color:#64748b;font-size:12px;white-space:nowrap;">${fmtDate(c.conventionDate)}</td>
        <td style="padding:10px 12px;color:#64748b;font-size:12px;white-space:nowrap;">${fmtDate(c.collectionDate)}</td>
        <td style="padding:10px 12px;font-size:12px;white-space:nowrap;">${daysCell}</td>
        <td style="padding:10px 12px;">${statusPill(c.status)}</td>
        ${c.venue ? `<td style="padding:10px 12px;color:#94a3b8;font-size:11px;">${c.venue}</td>` : `<td style="padding:10px 12px;"></td>`}
      </tr>`;
    })
    .join("");

  const todayLabel = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const overdueCount = sorted.filter((c) => c.collectionDate && daysUntil(c.collectionDate) < 0).length;
  const urgentCount  = sorted.filter((c) => c.collectionDate && daysUntil(c.collectionDate) >= 0 && daysUntil(c.collectionDate) <= 7).length;

  // ── Build HTML ────────────────────────────────────────────────────────────
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;padding:8px;">
    <div style="background:#ffffff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
      <img src="${BASE_URL}/logo-horizontal.svg" alt="Xylo (UK) Ltd" width="140" height="35" style="display:block;margin-bottom:16px;" />
      <h1 style="color:#0f172a;font-size:20px;margin:0 0 4px;">Regional Convention Digest</h1>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;">${todayLabel}</p>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">
        ${sorted.length} upcoming regional convention${sorted.length !== 1 ? "s" : ""}
        ${overdueCount > 0 ? ` · <span style="color:#ef4444;font-weight:bold;">${overdueCount} overdue</span>` : ""}
        ${urgentCount > 0 ? ` · <span style="color:#f97316;font-weight:bold;">${urgentCount} within 7 days</span>` : ""}
      </p>

      ${
        sorted.length === 0
          ? `<p style="color:#64748b;font-size:14px;">No upcoming regional conventions at this time.</p>`
          : `
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;color:#94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;">Convention</th>
            <th style="padding:8px 12px;color:#94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">Event Date</th>
            <th style="padding:8px 12px;color:#94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">RF Collection</th>
            <th style="padding:8px 12px;color:#94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">Days Left</th>
            <th style="padding:8px 12px;color:#94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;">Status</th>
            <th style="padding:8px 12px;color:#94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;">Venue</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`
      }

      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f1f5f9;text-align:center;">
        <p style="color:#f97316;font-size:13px;font-weight:bold;margin:0 0 4px;">Xylo (UK) Ltd</p>
        <p style="color:#94a3b8;font-size:11px;margin:0 0 2px;line-height:1.6;">R08 Regent Works Studio, Regent Works, Lawley Street, Longton, Staffs. ST3 1LZ</p>
        <p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6;">Co. Reg: GB:073 23863 &nbsp;·&nbsp; VAT Reg No: 442 8892 61</p>
      </div>
    </div>
  </div>`;

  // ── Build plain text ──────────────────────────────────────────────────────
  const text = [
    `IBSA Regional Convention Digest — ${todayLabel}`,
    `${sorted.length} upcoming convention${sorted.length !== 1 ? "s" : ""}`,
    "",
    ...sorted.map((c, i) => {
      const dl = daysLabel(c.collectionDate);
      return [
        `${i + 1}. ${c.name}`,
        `   Event date:    ${fmtDate(c.conventionDate)}`,
        `   RF Collection: ${fmtDate(c.collectionDate)}`,
        `   Days left:     ${dl.text}`,
        `   Status:        ${c.status}`,
        c.venue ? `   Venue:         ${c.venue}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "",
    "Xylo (UK) Ltd",
    "R08 Regent Works Studio, Regent Works, Lawley Street, Longton, Staffs. ST3 1LZ",
    "Co. Reg: GB:073 23863 · VAT Reg No: 442 8892 61",
  ].join("\n");

  // ── Send email ────────────────────────────────────────────────────────────
  const dateShort = today.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const urgencyFlag = overdueCount > 0 ? " 🔴" : urgentCount > 0 ? " 🟡" : "";

  await sendEmail({
    to: RECIPIENTS,
    subject: `IBSA Regional Digest — ${sorted.length} conventions · ${dateShort}${urgencyFlag}`,
    text,
    html,
  });

  return NextResponse.json({ ok: true, conventions: sorted.length });
}
