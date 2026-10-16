/**
 * Ollie / Maddie in teddy-bear onesies, sitting on the top edge of a card with their legs hanging
 * over the front. Built from 3 layers (body + each leg) so the legs can swing from the knee like kids do:
 * a few swings, then a rest, out of step with each other. Includes the occasional little bounce.
 *
 * The seat (where the child sits on the card edge) is at `seatPct` % of the image height —
 * position the wrapper with top = -(seatPct/100 * height).
 */

export type Kid = {
  name: string;
  key: "ollie" | "maddie";
  aspect: number;   // height / width of the layer images
  seatPct: number;  // seat line as % of image height
  legLPct: number;  // left leg centre as % of width (swing pivot)
  legRPct: number;  // right leg centre as % of width
};

export const KIDS: Record<"ollie" | "maddie", Kid> = {
  ollie: { name: "Ollie", key: "ollie", aspect: 659 / 360, seatPct: 65.13, legLPct: 37.09, legRPct: 72.16 },
  maddie: { name: "Maddie", key: "maddie", aspect: 692 / 360, seatPct: 64.61, legLPct: 33.67, legRPct: 64.04 },
};

export const kidHeight = (k: Kid, width: number) => Math.round(width * k.aspect);
export const kidSeat = (k: Kid, width: number) => Math.round((width * k.aspect * k.seatPct) / 100);

export default function TeddyBear({ kid, width = 84, delay = 0 }: { kid: Kid; width?: number; delay?: number }) {
  const h = kidHeight(kid, width);
  const src = (part: string) => `/ollie-maddy-kid-${kid.key}-${part}.webp`;
  const layer: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  const swingDur = kid.key === "ollie" ? 5.2 : 6.1; // different rhythms so they never sync up

  return (
    <>
      <style>{`
        /* legs: a few swings back and forth, then a rest (rotateX from the knee = feet kick towards/away from you) */
        @keyframes om-legA {
          0%   { transform: rotateX(0deg); }
          8%   { transform: rotateX(-34deg); }
          18%  { transform: rotateX(22deg); }
          28%  { transform: rotateX(-30deg); }
          38%  { transform: rotateX(18deg); }
          48%  { transform: rotateX(-12deg); }
          56%  { transform: rotateX(4deg); }
          62%, 100% { transform: rotateX(0deg); }
        }
        @keyframes om-legB {
          0%   { transform: rotateX(0deg); }
          8%   { transform: rotateX(24deg); }
          18%  { transform: rotateX(-32deg); }
          28%  { transform: rotateX(20deg); }
          38%  { transform: rotateX(-26deg); }
          48%  { transform: rotateX(10deg); }
          56%  { transform: rotateX(-3deg); }
          62%, 100% { transform: rotateX(0deg); }
        }
        /* a gentle wiggle + the odd little bounce */
        @keyframes om-body {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          20% { transform: translateY(0) rotate(-1.2deg); }
          40% { transform: translateY(0) rotate(1.2deg); }
          70% { transform: translateY(0) rotate(0deg); }
          76% { transform: translateY(-5px) rotate(0deg); }
          82% { transform: translateY(0) rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .om-leg, .om-body { animation: none !important; }
        }
      `}</style>
      <div
        role="img"
        aria-label={`${kid.name} in a teddy-bear onesie, swinging their legs`}
        className="om-body relative select-none"
        style={{
          width,
          height: h,
          transformOrigin: `50% ${kid.seatPct}%`,
          animation: `om-body ${swingDur * 1.3}s ease-in-out ${delay + 1.5}s infinite`,
          filter: "drop-shadow(0 4px 5px rgba(31,53,102,0.25))",
        }}
      >
        {/* legs behind the body, swinging in 3D from the knee */}
        <div style={{ ...layer, perspective: 260 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src("legL")}
            alt=""
            className="om-leg"
            draggable={false}
            style={{
              ...layer,
              transformOrigin: `${kid.legLPct}% ${kid.seatPct}%`,
              animation: `om-legA ${swingDur}s ease-in-out ${delay}s infinite`,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src("legR")}
            alt=""
            className="om-leg"
            draggable={false}
            style={{
              ...layer,
              transformOrigin: `${kid.legRPct}% ${kid.seatPct}%`,
              animation: `om-legB ${swingDur}s ease-in-out ${delay + 0.12}s infinite`,
            }}
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src("body")} alt="" draggable={false} style={layer} />
      </div>
    </>
  );
}
