/**
 * Ollie / Maddie as plush teddy bears (cut-out images in /public), sitting on the top edge of a card
 * with a gentle sway. The image's bottom `overlap` px rest on/over the card's top border.
 */
export default function TeddyBear({
  src,
  name,
  width = 88,
  delay = 0,
}: {
  src: string;
  name: string;
  width?: number;
  delay?: number;
}) {
  return (
    <>
      <style>{`
        @keyframes om-sway { 0%,100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
        /* a cheeky little hop every few seconds */
        @keyframes om-hop {
          0%, 78%, 100% { transform: translateY(0) scale(1, 1); }
          82% { transform: translateY(1px) scale(1.04, 0.95); }
          88% { transform: translateY(-9px) scale(0.97, 1.04); }
          94% { transform: translateY(0) scale(1.03, 0.97); }
        }
        @media (prefers-reduced-motion: reduce) { .om-bear, .om-hop { animation: none !important; } }
      `}</style>
      <span
        className="om-hop block"
        style={{ transformOrigin: "50% 100%", animation: `om-hop 4.6s ease-in-out ${delay * 1.9 + 1}s infinite` }}
      >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${name} as a little teddy bear`}
        width={width}
        className="om-bear block select-none"
        draggable={false}
        style={{
          width,
          height: "auto",
          transformOrigin: "50% 92%",
          animation: `om-sway 3.2s ease-in-out ${delay}s infinite`,
          filter: "drop-shadow(0 4px 5px rgba(31,53,102,0.28))",
        }}
      />
      </span>
    </>
  );
}
