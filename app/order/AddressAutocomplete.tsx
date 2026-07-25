"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── minimal type shim ─────────────────────────────────────────────────────────
interface Prediction { description: string; place_id: string; }
interface ACSvc {
  getPlacePredictions(
    req: { input: string; componentRestrictions?: { country: string } },
    cb: (p: Prediction[] | null, status: string) => void
  ): void;
}

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => ACSvc;
          PlacesServiceStatus: { OK: string };
        };
      };
    };
  }
}

// ── component ─────────────────────────────────────────────────────────────────
type Props = { name?: string; placeholder?: string; className?: string };

export default function AddressAutocomplete({
  name = "deliveryAddress",
  placeholder = "Start typing an address or postcode…",
  className,
}: Props) {
  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open,        setOpen]        = useState(false);

  const svcRef     = useRef<ACSvc | null>(null);
  const debounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenRef  = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load Maps script & create service ─────────────────────────────────────────
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    function attach() {
      if (!window.google?.maps?.places) return;
      svcRef.current = new window.google.maps.places.AutocompleteService();
    }

    const poll = setInterval(() => {
      if (window.google?.maps?.places) { clearInterval(poll); attach(); }
    }, 100);

    if (!document.querySelector('script[data-places="1"]')) {
      const s = document.createElement("script");
      s.setAttribute("data-places", "1");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }

    return () => clearInterval(poll);
  }, []);

  // Close dropdown on outside click ───────────────────────────────────────────
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Fetch predictions with 300 ms debounce ────────────────────────────────────
  const fetch = useCallback((input: string) => {
    if (!svcRef.current || input.length < 3) { setSuggestions([]); return; }
    svcRef.current.getPlacePredictions(
      { input, componentRestrictions: { country: "gb" } },
      (preds, status) => {
        setSuggestions(status === "OK" && preds ? preds.map((p) => p.description) : []);
      }
    );
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (hiddenRef.current) hiddenRef.current.value = val;
    setOpen(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetch(val), 300);
  }

  function handleSelect(s: string) {
    setQuery(s);
    if (hiddenRef.current) hiddenRef.current.value = s;
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
      />

      {/* Hidden input carries value through FormData */}
      <input ref={hiddenRef} type="hidden" name={name} />

      {/* Custom dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          style={{
            position:        "absolute",
            top:             "calc(100% + 4px)",
            left:            0,
            right:           0,
            zIndex:          9999,
            margin:          0,
            padding:         0,
            listStyle:       "none",
            background:      "#fff",
            border:          "1px solid #e5e7eb",
            borderRadius:    "0.5rem",
            boxShadow:       "0 4px 16px rgba(0,0,0,0.10)",
            maxHeight:       "14rem",
            overflowY:       "auto",
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding:    "0.5rem 0.75rem",
                fontSize:   "0.875rem",
                color:      "#111827",
                cursor:     "pointer",
                borderTop:  i > 0 ? "1px solid #f3f4f6" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
