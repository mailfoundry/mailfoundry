import type { Metadata } from "next";
import Countdown from "./Countdown";
import ShareButton from "./ShareButton";
import { COUPLE, EVENTS } from "./config";

const names = `${COUPLE.a} & ${COUPLE.b}`;

export const metadata: Metadata = {
  title: `${names} — counting down`,
  description: `Counting down to ${names}'s wedding — Saturday 24 October 2026.`,
  robots: { index: false, follow: false }, // shared by link only, kept out of search engines
  openGraph: {
    title: `${names} are getting married 💍`,
    description: "Counting down to the big day — Saturday 24 October 2026",
    type: "website",
  },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Europe/London" }).replace(" ", "");

export default function OllieMaddyPage() {
  return (
    <main className="min-h-screen bg-[#faf6ef] text-[#3d3326]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-14 text-center sm:py-20">
        <p className="text-xs uppercase tracking-[0.35em] text-[#9b8b72]">Together with their families</p>

        <h1 className="mt-6 font-serif text-5xl leading-tight sm:text-7xl">
          {COUPLE.a}
          <span className="mx-3 inline-block italic text-[#b8935a]">&amp;</span>
          {COUPLE.b}
        </h1>

        <div className="mt-6 flex items-center gap-3 text-[#b8935a]" aria-hidden>
          <span className="h-px w-12 bg-[#d9c7a6]" />
          <span>❦</span>
          <span className="h-px w-12 bg-[#d9c7a6]" />
        </div>

        <p className="mt-6 max-w-md text-lg italic text-[#6b5c47]">are getting married</p>

        <div className="mt-12 w-full space-y-8">
          {EVENTS.map((e) => {
            const endsAt = new Date(Date.parse(e.startsAt) + (e.timeKnown ? e.durationMins : 24 * 60) * 60000).toISOString();
            return (
              <section key={e.id} className="rounded-3xl bg-[#f3ece0] px-5 py-8 shadow-sm ring-1 ring-[#e7dcc8] sm:px-10">
                <p className="text-xs uppercase tracking-[0.3em] text-[#9b8b72]">{e.subtitle}</p>
                <h2 className="mt-2 font-serif text-3xl">{e.title}</h2>
                <p className="mt-3 text-[#6b5c47]">
                  {fmtDate(e.startsAt)}
                  {e.timeKnown ? <> · <strong className="font-semibold text-[#3d3326]">{fmtTime(e.startsAt)}</strong></> : <span className="italic"> · time to be confirmed</span>}
                </p>
                {e.location && <p className="mt-1 text-sm text-[#8a7a62]">{e.location}</p>}
                <div className="mt-6">
                  <Countdown target={e.startsAt} endsAt={endsAt} />
                </div>
                <a
                  href={`/ollie-maddy/calendar/${e.id}`}
                  className="mt-6 inline-block text-sm text-[#8a6d3b] underline decoration-[#d9c7a6] underline-offset-4 hover:text-[#3d3326]"
                >
                  Add to calendar
                </a>
              </section>
            );
          })}
        </div>

        <div className="mt-12">
          <ShareButton title={`${names} are getting married`} />
        </div>

        <p className="mt-14 text-sm italic text-[#9b8b72]">With love, from Mum &amp; Dad</p>
      </div>
    </main>
  );
}
