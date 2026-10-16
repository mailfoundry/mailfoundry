import { EVENTS, COUPLE } from "../../config";

const ics = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Add-to-calendar file for one of the wedding events. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = EVENTS.find((x) => x.id === id);
  if (!e) return new Response("Not found", { status: 404 });

  const start = new Date(e.startsAt);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ollieandmaddy//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}-${COUPLE.a}-${COUPLE.b}@xylouk.co.uk`.toLowerCase(),
    `DTSTAMP:${ics(new Date())}`,
    ...(e.timeKnown
      ? [`DTSTART:${ics(start)}`, `DTEND:${ics(new Date(start.getTime() + e.durationMins * 60000))}`]
      : [`DTSTART;VALUE=DATE:${e.startsAt.slice(0, 10).replace(/-/g, "")}`]),
    `SUMMARY:${esc(`${COUPLE.a} & ${COUPLE.b} — ${e.title}`)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ollie-maddy-${e.id}.ics"`,
    },
  });
}
