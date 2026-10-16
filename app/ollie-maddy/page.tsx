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
    <main
      className="min-h-screen text-[#1f3566]"
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        // soft watercolour washes, echoing the invitation's blue florals
        background:
          "radial-gradient(ellipse 60% 40% at 0% 0%, rgba(90,124,196,0.18), transparent 70%)," +
          "radial-gradient(ellipse 55% 35% at 100% 8%, rgba(63,95,158,0.16), transparent 70%)," +
          "radial-gradient(ellipse 60% 40% at 100% 100%, rgba(90,124,196,0.14), transparent 70%)," +
          "radial-gradient(ellipse 50% 35% at 0% 85%, rgba(63,95,158,0.12), transparent 70%), #f7f9fd",
      }}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center px-3 pb-10 pt-8 text-center sm:px-5 sm:py-16">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#7486ad]">Together with their families</p>

        <h1 className="mt-3 font-serif text-[3.4rem] leading-none sm:text-7xl">
          {COUPLE.a}
          <span className="mx-3 inline-block italic text-[#5a7cc4]">&amp;</span>
          {COUPLE.b}
        </h1>

        <div className="mt-4 flex items-center gap-3 text-[#5a7cc4]" aria-hidden>
          <span className="h-px w-12 bg-[#b9c8e6]" />
          <span>❦</span>
          <span className="h-px w-12 bg-[#b9c8e6]" />
        </div>

        <p className="mt-3 max-w-md text-lg italic text-[#3f5f9e]">are getting married</p>

        <div className="mt-7 w-full space-y-4">
          {EVENTS.map((e) => {
            const endsAt = new Date(Date.parse(e.startsAt) + (e.timeKnown ? e.durationMins : 24 * 60) * 60000).toISOString();
            return (
              <section key={e.id} className="rounded-3xl bg-white/80 px-2 py-6 shadow-sm ring-1 ring-[#d6e0f2] backdrop-blur-sm sm:px-10 sm:py-8">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#7486ad]">{e.subtitle}</p>
                <h2 className="mt-1 font-serif text-[1.9rem] leading-tight">{e.title}</h2>
                <p className="mt-2 text-[15px] text-[#3f5f9e]">
                  {fmtDate(e.startsAt)}
                  {e.timeKnown ? <> · <strong className="font-semibold text-[#1f3566]">{fmtTime(e.startsAt)}</strong></> : <span className="italic"> · time to be confirmed</span>}
                </p>
                {e.location && <p className="mt-1 text-sm text-[#5a6f9c]">{e.location}</p>}
                {e.extra && <p className="mt-1 text-sm italic text-[#5a6f9c]">{e.extra}</p>}
                <div className="mt-5">
                  <Countdown target={e.startsAt} endsAt={endsAt} />
                </div>
                <a
                  href={`/ollie-maddy/calendar/${e.id}`}
                  className="mt-4 inline-block text-sm text-[#3f5f9e] underline decoration-[#b9c8e6] underline-offset-4 hover:text-[#1f3566]"
                >
                  Add to calendar
                </a>
              </section>
            );
          })}
        </div>

        <div className="mt-8">
          <ShareButton title={`${names} are getting married`} />
        </div>

        <p className="mt-8 text-sm italic text-[#7486ad]">With love, from Mum &amp; Dad</p>
      </div>
    </main>
  );
}
