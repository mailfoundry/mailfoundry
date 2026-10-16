"use client";

import { useEffect, useRef } from "react";

/**
 * Twinkling stardust orbiting the couple's names on a tilted ellipse.
 * Particles on the far side of the orbit draw behind the names (smaller, dimmer);
 * near-side particles draw in front — gives a gentle 3D feel. Honours reduced-motion.
 */

type Particle = {
  angle: number;   // position on the orbit (radians)
  speed: number;   // radians per second
  rx: number;      // orbit radius factor (x)
  ry: number;      // orbit radius factor (y)
  wobble: number;  // radial drift amount
  phase: number;   // twinkle phase
  size: number;    // base size in px
  star: boolean;   // 4-point sparkle vs soft dot
  hue: "blue" | "gold" | "white";
};

const COLOURS = {
  blue: [90, 124, 196],
  gold: [214, 178, 104],
  white: [255, 255, 255],
} as const;

function makeParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const r = Math.random();
    return {
      angle: (i / n) * Math.PI * 2 + Math.random() * 0.6,
      speed: 0.25 + Math.random() * 0.25,
      rx: 0.86 + Math.random() * 0.22,
      ry: 0.8 + Math.random() * 0.4,
      wobble: 2 + Math.random() * 6,
      phase: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 2.2,
      star: Math.random() < 0.35,
      hue: r < 0.5 ? "blue" : r < 0.8 ? "gold" : "white",
    };
  });
}

export default function StarDust({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const cb = back.current;
    const cf = front.current;
    if (!el || !cb || !cf) return;
    const bctx = cb.getContext("2d");
    const fctx = cf.getContext("2d");
    if (!bctx || !fctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const particles = makeParticles(window.innerWidth < 640 ? 34 : 48);
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = el.getBoundingClientRect();
      w = r.width;
      h = r.height;
      for (const c of [cb, cf]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawParticle = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, p: Particle) => {
      const [r, g, b] = COLOURS[p.hue];
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
      ctx.shadowBlur = size * 4;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      if (p.star) {
        // 4-point sparkle
        const s = size * 2.4;
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.quadraticCurveTo(x, y, x + s, y);
        ctx.quadraticCurveTo(x, y, x, y + s);
        ctx.quadraticCurveTo(x, y, x - s, y);
        ctx.quadraticCurveTo(x, y, x, y - s);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      bctx.clearRect(0, 0, w, h);
      fctx.clearRect(0, 0, w, h);

      const cx = w / 2, cy = h / 2;
      const RX = w * 0.5, RY = h * 0.42;
      const tilt = -0.12; // slight tilt of the orbit

      for (const p of particles) {
        if (!reduce) p.angle += p.speed * dt;
        const t = now / 1000;
        const wob = Math.sin(t * 1.3 + p.phase) * p.wobble;
        const ex = Math.cos(p.angle) * (RX * p.rx + wob);
        const ey = Math.sin(p.angle) * (RY * p.ry + wob * 0.5);
        const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);

        const depth = Math.sin(p.angle);            // -1 = far (top of orbit), +1 = near (bottom)
        const scale = 0.65 + 0.35 * (depth + 1) / 2;
        const twinkle = 0.55 + 0.45 * Math.sin(t * 3 + p.phase * 2);
        const alpha = (0.35 + 0.55 * (depth + 1) / 2) * twinkle;

        drawParticle(depth > 0 ? fctx : bctx, x, y, p.size * scale, alpha, p);
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const canvasStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  };

  return (
    <div ref={wrap} className="relative w-full px-2 py-6 sm:py-8">
      <canvas ref={back} style={{ ...canvasStyle, zIndex: 0 }} aria-hidden />
      <div className="relative" style={{ zIndex: 1 }}>{children}</div>
      <canvas ref={front} style={{ ...canvasStyle, zIndex: 2 }} aria-hidden />
    </div>
  );
}
