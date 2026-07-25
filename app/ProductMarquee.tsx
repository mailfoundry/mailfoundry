"use client";

const PRODUCTS = [
  { src: "/product-images/cs_HI_VIS_YELLOW_S.png",              label: "Hi-Vis Vest" },
  { src: "/product-images/fa_FIRSTAID_KIT_LARGE_188P.png",      label: "First Aid Kit" },
  { src: "/product-images/cs_GLOVES_NITRILE_BLUE_SML.png",      label: "Nitrile Gloves" },
  { src: "/product-images/cs_WET_FLOOR_AFRAME.png",             label: "Wet Floor Sign" },
  { src: "/product-images/fa_WHEEL_CHAIR_MKII.png",             label: "Wheelchair" },
  { src: "/product-images/cs_SPILL_KITS_MAINTENANCE_20L.jpg",   label: "Spill Kit" },
  { src: "/product-images/fa_100PACK_ASSORTED_WATERPROOF_PLASTERS.png", label: "Plasters" },
  { src: "/product-images/cs_CLOTH_MFIBRE_BLUE_10PK.jpg",       label: "Microfibre Cloths" },
  { src: "/product-images/fa_EYEWASH_INCCAP_500ML.jpg",         label: "Eyewash Station" },
  { src: "/product-images/cs_BIO_HAZARD_KITS.png",              label: "Bio Hazard Kit" },
  { src: "/product-images/fa_KOOLPAK_RESUSE_13CMx14CM.png",     label: "Cold Pack" },
  { src: "/product-images/cs_BARRIER_TAPE_NON_ADHESIVE_RED_WHITE.png", label: "Barrier Tape" },
];

// Duplicate for seamless loop
const ITEMS = [...PRODUCTS, ...PRODUCTS];

export default function ProductMarquee() {
  return (
    <section className="overflow-hidden py-10">
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          gap: 16px;
          width: max-content;
          animation: marquee 30s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="marquee-track">
        {ITEMS.map((p, i) => (
          <div
            key={i}
            className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="flex h-24 w-full items-center justify-center">
              <img
                src={p.src}
                alt={p.label}
                className="max-h-24 w-full object-contain"
                loading="lazy"
              />
            </div>
            <p className="text-center text-xs text-gray-500">{p.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
