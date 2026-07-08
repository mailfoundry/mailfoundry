"use client";

type Props = {
  targetDate: string; // ISO string
  label?: string;
};

export default function CountdownBadge({ targetDate, label = "Collection" }: Props) {
  const target = new Date(targetDate);
  const now = new Date();
  // Strip time — count whole days
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / msPerDay);

  if (days < 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 p-5 text-center">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-bold text-slate-500">—</p>
        <p className="mt-1 text-xs text-slate-600">Passed</p>
      </div>
    );
  }

  const colour =
    days <= 7
      ? { ring: "border-red-500/60 bg-red-950/30", text: "text-red-400", sub: "text-red-500/70" }
      : days <= 14
      ? { ring: "border-amber-500/60 bg-amber-950/30", text: "text-amber-400", sub: "text-amber-500/70" }
      : { ring: "border-green-500/60 bg-green-950/20", text: "text-green-400", sub: "text-green-600/70" };

  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border p-5 text-center ${colour.ring}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-4xl font-black tabular-nums ${colour.text}`}>{days}</p>
      <p className={`mt-1 text-xs font-semibold uppercase tracking-wider ${colour.sub}`}>
        {days === 1 ? "day" : "days"}
      </p>
    </div>
  );
}
