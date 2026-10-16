import type { Metadata } from "next";
import Countdown from "./Countdown";
import ShareButton from "./ShareButton";
import StarDust from "./StarDust";
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
      <div className="mx-auto flex min-h-[100svh] max-w-2xl flex-col items-center justify-center px-3 py-6 text-center sm:px-5 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#7486ad]">Together with their families</p>

        <StarDust>
          <h1 className="font-serif text-[3rem] leading-none sm:text-7xl">
            {COUPLE.a}
            <span className="mx-2 inline-block italic text-[#5a7cc4] sm:mx-3">&amp;</span>
            {COUPLE.b}
          </h1>
        </StarDust>

        <div className="-mt-2 flex items-center gap-3 text-[#3f5f9e]">
          <span className="h-px w-8 bg-[#b9c8e6] sm:w-12" aria-hidden />
          <span className="text-lg italic">are getting married</span>
          <span className="h-px w-8 bg-[#b9c8e6] sm:w-12" aria-hidden />
        </div>

        <div className="mt-6 w-full space-y-4 sm:mt-8 sm:space-y-5">
          {EVENTS.map((e) => {
            const endsAt = new Date(Date.parse(e.startsAt) + (e.timeKnown ? e.durationMins : 24 * 60) * 60000).toISOString();
            return (
              <section key={e.id} className="rounded-3xl bg-white/80 px-2 pb-4 pt-5 shadow-sm ring-1 ring-[#d6e0f2] backdrop-blur-sm sm:px-10 sm:py-8">
                <h2 className="font-serif text-[1.65rem] leading-tight sm:text-3xl">{e.title}</h2>
                <p className="mt-1.5 text-[14.5px] text-[#3f5f9e] sm:text-base">
                  {fmtDate(e.startsAt)}
                  {e.timeKnown ? <> · <strong className="font-semibold text-[#1f3566]">{fmtTime(e.startsAt)}</strong></> : <span className="italic"> · time to be confirmed</span>}
                </p>
                {(e.location || e.extra) && (
                  <p className="mt-1 text-[13px] text-[#5a6f9c] sm:text-sm">
                    {e.location}
                    {e.location && e.extra ? " · " : ""}
                    {e.extra && <span className="italic">{e.extra}</span>}
                  </p>
                )}
                <div className="mt-4">
                  <Countdown target={e.startsAt} endsAt={endsAt} />
                </div>
                <a
                  href={`/ollie-maddy/calendar/${e.id}`}
                  className="mt-3 inline-block text-sm text-[#3f5f9e] underline decoration-[#b9c8e6] underline-offset-4 hover:text-[#1f3566]"
                >
                  Add to calendar
                </a>
              </section>
            );
          })}
        </div>

        <div className="mt-6">
          <ShareButton title={`${names} are getting married`} />
        </div>

        <p className="mt-6 text-sm italic text-[#7486ad]">With love, from Mum &amp; Dad</p>
      </div>
    </main>
  );
}
