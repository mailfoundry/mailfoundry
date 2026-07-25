"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1400&q=80&auto=format&fit=crop",
    alt: "Large convention arena filled with attendees",
    caption: "Regional Conventions",
    sub: "Serving Jehovah's people across the UK",
  },
  {
    src: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1400&q=80&auto=format&fit=crop",
    alt: "Conference hall with rows of seats",
    caption: "Circuit Assemblies",
    sub: "Clean, safe environments for every event",
  },
  {
    src: "https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=1400&q=80&auto=format&fit=crop",
    alt: "People gathered in a large event space",
    caption: "Professional Supplies",
    sub: "Cleaning supplies and first aid — always ready",
  },
  {
    src: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1400&q=80&auto=format&fit=crop",
    alt: "Event crowd from above",
    caption: "Logistics Made Simple",
    sub: "From order to delivery, every convention covered",
  },
  {
    src: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=1400&q=80&auto=format&fit=crop",
    alt: "Convention hall interior with stage lighting",
    caption: "Every Detail Matters",
    sub: "Supporting the organisation behind the scenes",
  },
];

export default function ConventionCarousel() {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((idx: number) => {
    setCurrent((idx + SLIDES.length) % SLIDES.length);
  }, []);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Auto-advance
  useEffect(() => {
    if (isHovered) return;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered]);

  // Preload adjacent slides
  useEffect(() => {
    const preload = [current, (current + 1) % SLIDES.length, (current - 1 + SLIDES.length) % SLIDES.length];
    preload.forEach((i) => {
      if (!loaded[i]) {
        const img = new Image();
        img.src = SLIDES[i].src;
        img.onload = () => setLoaded((prev) => ({ ...prev, [i]: true }));
      }
    });
  }, [current, loaded]);

  return (
    <section className="mb-10">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Gallery
      </h3>

      <div
        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm"
        style={{ aspectRatio: "21/8" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Slides */}
        {SLIDES.map((slide, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              idx === current ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            {/* Image */}
            <img
              src={slide.src}
              alt={slide.alt}
              className="h-full w-full object-cover"
              loading={idx === 0 ? "eager" : "lazy"}
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

            {/* Caption */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <p className="text-base font-bold text-white drop-shadow">{slide.caption}</p>
              <p className="mt-0.5 text-sm text-white/80 drop-shadow">{slide.sub}</p>
            </div>
          </div>
        ))}

        {/* Prev / Next buttons */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
          aria-label="Previous"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
          aria-label="Next"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Dot indicators */}
        <div className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === current
                  ? "w-5 bg-white"
                  : "w-1.5 bg-white/50 hover:bg-white/75"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
