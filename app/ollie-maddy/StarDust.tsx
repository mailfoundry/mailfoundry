"use client";

import { useEffect, useRef } from "react";

/**
 * Playful stardust around the couple's names:
 *  - sparkles, dots and tiny hearts on two crossing, counter-rotating orbits (near side in front of the names)
 *  - a few comets with glowing tails
 *  - a firework-style sparkle burst every few seconds, and on every tap/click of the names
 * Honours prefers-reduced-motion (everything holds still and just twinkles).
 */

type Shape = "dot" | "star" | "heart";
type Orbiter = {
  angle: number; speed: number; rx: number; ry: number; wobble: number; phase: number;
  size: number; shape: Shape; colour: number[]; ring: 0 | 1; comet: boolean;
};
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; shape: Shape; colour: number[]; spin: number };

const BLUE = [90, 124, 196];
const NAVY = [63, 95, 158];
const GOLD = [214, 178, 104];
const WHITE = [255, 255, 255];
const PINK = [232, 150, 176];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function makeOrbiters(n: number): Orbiter[] {
  return Array.from({ length: n }, (_, i) => {
    const r = Math.random();
    const shape: Shape = r < 0.14 ? "heart" : r < 0.5 ? "star" : "dot";
    return {
      angle: (i / n) * Math.PI * 2 + Math.random() * 0.5,
      speed: (0.3 + Math.random() * 0.35) * (i % 3 === 0 ? -1 : 1),
      rx: 0.84 + Math.random() * 0.24,
      ry: 0.75 + Math.random() * 0.45,
      wobble: 2 + Math.random() * 7,
      phase: Math.random() * Math.PI * 2,
      size: shape === "heart" ? 2.4 + Math.random() * 1.6 : 1 + Math.random() * 2.2,
      shape,
      colour: shape === "heart" ? pick([PINK, GOLD, BLUE]) : pick([BLUE, BLUE, GOLD, GOLD, WHITE, NAVY]),
      ring: i % 3 === 0 ? 1 : 0,
      comet: i % 11 === 0,
    };
  });
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, s: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.beginPath();
  if (shape === "dot") {
    ctx.arc(0, 0, s, 0, Math.PI * 2);
  } else if (shape === "star") {
    const k = s * 2.6;
    ctx.moveTo(0, -k);
    ctx.quadraticCurveTo(0, 0, k, 0);
    ctx.quadraticCurveTo(0, 0, 0, k);
    ctx.quadraticCurveTo(0, 0, -k, 0);
    ctx.quadraticCurveTo(0, 0, 0, -k);
  } else {
    const k = s * 1.15;
    ctx.moveTo(0, k * 0.9);
    ctx.bezierCurveTo(-k * 1.9, -k * 0.3, -k * 0.9, -k * 1.6, 0, -k * 0.55);
    ctx.bezierCurveTo(k * 0.9, -k * 1.6, k * 1.9, -k * 0.3, 0, k * 0.9);
  }
  ctx.fill();
  ctx.restore();
}

export default function StarDust({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef<((x?: number, y?: number, big?: boolean) => void) | null>(null);

  useEffect(() => {
    const el = wrap.current, cb = back.current, cf = front.current;
    if (!el || !cb || !cf) return;
    const bctx = cb.getContext("2d"), fctx = cf.getContext("2d");
    if (!bctx || !fctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const orbiters = makeOrbiters(window.innerWidth < 640 ? 40 : 56);
    const sparks: Spark[] = [];
    let w = 0, h = 0, raf = 0, last = performance.now(), nextBurst = last + 2500;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = el.getBoundingClientRect();
      w = r.width; h = r.height;
      for (const c of [cb, cf]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const burst = (x?: number, y?: number, big = false) => {
      if (reduce) return;
      const bx = x ?? w * (0.2 + Math.random() * 0.6);
      const by = y ?? h * (0.3 + Math.random() * 0.4);
      const n = big ? 26 : 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const sp = (big ? 70 : 50) + Math.random() * 60;
        const r = Math.random();
        sparks.push({
          x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
          life: 0, max: 0.9 + Math.random() * 0.7,
          size: 1.2 + Math.random() * 1.8,
          shape: r < 0.2 ? "heart" : r < 0.65 ? "star" : "dot",
          colour: pick([GOLD, GOLD, BLUE, PINK, WHITE]),
          spin: (Math.random() - 0.5) * 6,
        });
      }
    };
    burstRef.current = burst;

    const glow = (ctx: CanvasRenderingContext2D, c: number[], alpha: number, blur: number) => {
      ctx.globalAlpha = alpha;
      ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.95)`;
      ctx.shadowBlur = blur;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      bctx.clearRect(0, 0, w, h);
      fctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, RX = w * 0.5, RY = h * 0.42;

      // Orbiting stardust on two crossing rings
      for (const p of orbiters) {
        if (!reduce) p.angle += p.speed * dt;
        const tilt = p.ring === 0 ? -0.14 : 0.32;
        const pulse = 1 + 0.25 * Math.sin(t * 2.2 + p.phase);
        const wob = Math.sin(t * 1.4 + p.phase) * p.wobble;
        const pos = (ang: number) => {
          const ex = Math.cos(ang) * (RX * p.rx + wob);
          const ey = Math.sin(ang) * (RY * p.ry + wob * 0.5);
          return [cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), cy + ex * Math.sin(tilt) + ey * Math.cos(tilt)];
        };
        const [x, y] = pos(p.angle);
        const depth = Math.sin(p.angle);
        const near = depth > 0;
        const ctx = near ? fctx : bctx;
        const scale = (0.62 + 0.38 * (depth + 1) / 2) * pulse;
        const twinkle = 0.55 + 0.45 * Math.sin(t * 3.2 + p.phase * 2);
        const alpha = (0.35 + 0.6 * (depth + 1) / 2) * twinkle;

        ctx.save();
        if (p.comet && !reduce) {
          // glowing tail behind the comet
          for (let k = 1; k <= 7; k++) {
            const [tx, ty] = pos(p.angle - Math.sign(p.speed) * k * 0.045);
            glow(ctx, p.colour, alpha * (1 - k / 8) * 0.6, 6);
            drawShape(ctx, "dot", tx, ty, p.size * scale * (1 - k / 10));
          }
        }
        glow(ctx, p.colour, alpha, p.size * 5);
        drawShape(ctx, p.shape, x, y, p.size * scale, p.shape === "star" ? t * 0.6 + p.phase : 0);
        ctx.restore();
      }

      // Firework sparkle bursts
      if (!reduce && now > nextBurst) {
        burst();
        nextBurst = now + 3200 + Math.random() * 2600;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life >= s.max) { sparks.splice(i, 1); continue; }
        s.vx *= 0.985; s.vy = s.vy * 0.985 + 55 * dt; // drag + gentle gravity
        s.x += s.vx * dt; s.y += s.vy * dt;
        const k = 1 - s.life / s.max;
        fctx.save();
        glow(fctx, s.colour, k, s.size * 5);
        drawShape(fctx, s.shape, s.x, s.y, s.size * (0.6 + k * 0.6), s.spin * s.life);
        fctx.restore();
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    raf = requestAnimationFrame(frame);
    const kick = setTimeout(() => burst(w / 2, h / 2, true), 600); // welcome burst
    return () => { cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(kick); burstRef.current = null; };
  }, []);

  const onTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    burstRef.current?.(e.clientX - r.left, e.clientY - r.top, true);
  };

  const canvasStyle: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" };

  return (
    <div ref={wrap} onPointerDown={onTap} className="relative w-full cursor-pointer select-none px-2 py-6 sm:py-8">
      <canvas ref={back} style={{ ...canvasStyle, zIndex: 0 }} aria-hidden />
      <div className="relative" style={{ zIndex: 1 }}>{children}</div>
      <canvas ref={front} style={{ ...canvasStyle, zIndex: 2 }} aria-hidden />
    </div>
  );
}
