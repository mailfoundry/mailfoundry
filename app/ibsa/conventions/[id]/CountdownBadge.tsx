"use client";

type Props = {
  targetDate: string; // ISO string
  label?: string;
};

export default function CountdownBadge({ targetDate, label = "Collection" }: Props) {
  const target = new Date(targetDate);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / msPerDay);

  if (days < 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm p-5 text-center">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="mt-1 text-3xl font-bold text-gray-300">—</p>
        <p className="mt-1 text-xs text-gray-300">Passed</p>
      </div>
    );
  }

  const colour =
    days <= 7
      ? { ring: "border-red-200 bg-red-50", text: "text-red-600", sub: "text-red-400" }
      : days <= 14
      ? { ring: "border-amber-200 bg-amber-50", text: "text-amber-600", sub: "text-amber-400" }
      : { ring: "border-green-200 bg-green-50", text: "text-green-600", sub: "text-green-400" };

  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border p-5 text-center ${colour.ring}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-4xl font-black tabular-nums ${colour.text}`}>{days}</p>
      <p className={`mt-1 text-xs font-semibold uppercase tracking-wider ${colour.sub}`}>
        {days === 1 ? "day" : "days"}
      </p>
    </div>
  );
}
