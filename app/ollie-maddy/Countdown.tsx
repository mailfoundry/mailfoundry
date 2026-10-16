"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60 };
}

export default function Countdown({ target, endsAt }: { target: string; endsAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = Date.parse(target);
  const end = Date.parse(endsAt);

  if (now === null) {
    return <div className="h-[84px]" aria-hidden />;
  }
  if (now >= end) {
    return <p className="font-serif text-2xl italic text-[#8a6d3b]">Married! 💍</p>;
  }
  if (now >= start) {
    return <p className="font-serif text-2xl italic text-[#8a6d3b]">Happening now ✨</p>;
  }

  const { days, hours, mins, secs } = parts(start - now);
  const cells: [number, string][] = [[days, days === 1 ? "day" : "days"], [hours, "hours"], [mins, "mins"], [secs, "secs"]];
  return (
    <div className="flex justify-center gap-2 sm:gap-4" role="timer" aria-live="off">
      {cells.map(([n, label]) => (
        <div key={label} className="w-[68px] rounded-2xl bg-white/70 py-3 shadow-sm ring-1 ring-[#e7dcc8] sm:w-20">
          <div className="font-serif text-3xl tabular-nums text-[#3d3326] sm:text-4xl">{String(n).padStart(2, "0")}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9b8b72]">{label}</div>
        </div>
      ))}
    </div>
  );
}
