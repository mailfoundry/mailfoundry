"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 70s-style split-flap countdown (same mechanism as the SWF/SCS FlipClock), in the wedding palette.
 * Card size scales with the screen via CSS variables so 4 groups always fit on a phone.
 */

const TOP_BG = "#2a4580";
const BOT_BG = "#1f3566";
const DIGIT = "#ffffff";
const LABEL = "#7486ad";
const DOT = "#5a7cc4";

const half: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: "calc(var(--h) / 2)",
  overflow: "hidden",
  backfaceVisibility: "hidden",
};

function face(n: string, isTop: boolean) {
  return (
    <span
      style={{
        display: "block",
        width: "100%",
        textAlign: "center",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "var(--fs)",
        fontWeight: 500,
        lineHeight: "var(--h)",
        color: DIGIT,
        userSelect: "none",
        ...(isTop ? {} : { marginTop: "calc(var(--h) / -2)" }),
      }}
    >
      {n}
    </span>
  );
}

function FlipCard({ digit }: { digit: string }) {
  const [curr, setCurr] = useState(digit);
  const [flipping, setFlip] = useState(false);
  const prev = useRef(digit);

  useEffect(() => {
    if (digit === prev.current) return;
    setFlip(true);
    const id = setTimeout(() => {
      prev.current = digit;
      setCurr(digit);
      setFlip(false);
    }, 520);
    return () => clearTimeout(id);
  }, [digit]);

  return (
    <div
      style={{
        position: "relative",
        width: "var(--w)",
        height: "var(--h)",
        perspective: "400px",
        flexShrink: 0,
        borderRadius: 6,
        boxShadow: "0 4px 10px rgba(31,53,102,0.25)",
      }}
    >
      <div style={{ ...half, top: 0, backgroundColor: TOP_BG, borderRadius: "6px 6px 0 0" }}>{face(digit, true)}</div>
      <div style={{ ...half, bottom: 0, backgroundColor: BOT_BG, borderRadius: "0 0 6px 6px" }}>{face(curr, false)}</div>
      <div style={{ position: "absolute", top: "calc(var(--h) / 2 - 1px)", left: 0, right: 0, height: 2, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10 }} />
      {flipping && (
        <div style={{ ...half, top: 0, backgroundColor: TOP_BG, borderRadius: "6px 6px 0 0", transformOrigin: "center bottom", animation: "omFlipTop 0.25s ease-in forwards", zIndex: 20 }}>
          {face(curr, true)}
        </div>
      )}
      {flipping && (
        <div style={{ ...half, bottom: 0, backgroundColor: BOT_BG, borderRadius: "0 0 6px 6px", transformOrigin: "center top", animation: "omFlipBottom 0.25s ease-out 0.25s forwards", transform: "rotateX(90deg)", zIndex: 20 }}>
          {face(digit, false)}
        </div>
      )}
    </div>
  );
}

function Group({ value, label }: { value: number; label: string }) {
  const digits = String(value).padStart(2, "0").split("");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {digits.map((d, i) => <FlipCard key={`${label}-${digits.length - i}`} digit={d} />)}
      </div>
      <span style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: LABEL }}>{label}</span>
    </div>
  );
}

function Colon() {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, height: "var(--h)", marginBottom: 20 }}>
      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: DOT }} />
      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: DOT }} />
    </div>
  );
}

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
  const vars = {
    // card width scales with the screen: ~31px on a small phone, up to 50px on desktop
    "--w": "clamp(28px, 8.2vw, 50px)",
    "--h": "calc(var(--w) * 1.35)",
    "--fs": "calc(var(--w) * 0.95)",
  } as React.CSSProperties;

  if (now === null) return <div style={{ ...vars, height: "calc(var(--h) + 26px)" }} aria-hidden />;
  if (now >= end) return <p className="font-serif text-3xl italic text-[#3f5f9e]">Married! 💍</p>;
  if (now >= start) return <p className="font-serif text-3xl italic text-[#3f5f9e]">Happening now ✨</p>;

  const { days, hours, mins, secs } = parts(start - now);
  return (
    <>
      <style>{`
        @keyframes omFlipTop { 0% { transform: rotateX(0deg); } 100% { transform: rotateX(-90deg); } }
        @keyframes omFlipBottom { 0% { transform: rotateX(90deg); } 100% { transform: rotateX(0deg); } }
      `}</style>
      <div style={{ ...vars, display: "flex", justifyContent: "center", alignItems: "center", gap: "clamp(4px, 1.6vw, 12px)" }} role="timer">
        <Group value={days} label={days === 1 ? "day" : "days"} />
        <Colon />
        <Group value={hours} label="hours" />
        <Colon />
        <Group value={mins} label="mins" />
        <Colon />
        <Group value={secs} label="secs" />
      </div>
    </>
  );
}
