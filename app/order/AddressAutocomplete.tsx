"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── type shims for the new Places API ────────────────────────────────────────
interface PlacePrediction {
  text: { toString(): string };
  toPlace(): {
    fetchFields(o: { fields: string[] }): Promise<{ place: { formattedAddress?: string } }>;
  };
}
interface Suggestion { placePrediction: PlacePrediction; }

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteSuggestion?: {
            fetchAutocompleteSuggestions(req: {
              input: string;
              includedRegionCodes?: string[];
            }): Promise<{ suggestions: Suggestion[] }>;
          };
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
  type SuggestionItem = { label: string; prediction: PlacePrediction };

  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [open,        setOpen]        = useState(false);
  const [resolving,   setResolving]   = useState(false);

  const debounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenRef  = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ready      = useRef(false);

  // Load Maps script ───────────────────────────────────────────────────────────
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    const poll = setInterval(() => {
      if (window.google?.maps?.places?.AutocompleteSuggestion) {
        clearInterval(poll);
        ready.current = true;
      }
    }, 100);

    if (!document.querySelector('script[data-places="1"]')) {
      const s = document.createElement("script");
      s.setAttribute("data-places", "1");
      // v=weekly required for AutocompleteSuggestion
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly&loading=async`;
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }

    return () => clearInterval(poll);
  }, []);

  // Close on outside click ─────────────────────────────────────────────────────
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Fetch suggestions ──────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (input: string) => {
    if (!ready.current || input.length < 3) { setSuggestions([]); return; }
    try {
      const api = window.google!.maps!.places!.AutocompleteSuggestion!;
      const { suggestions: raw } = await api.fetchAutocompleteSuggestions({
        input,
        includedRegionCodes: ["gb"],
      });
      setSuggestions(raw.map((s) => ({
          label: s.placePrediction.text.toString(),
          prediction: s.placePrediction,
        })));
    } catch {
      setSuggestions([]);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (hiddenRef.current) hiddenRef.current.value = val;
    setOpen(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchSuggestions(val), 300);
  }

  async function handleSelect(item: SuggestionItem) {
    setQuery(item.label);
    setSuggestions([]);
    setOpen(false);
    setResolving(true);
    try {
      const place = item.prediction.toPlace();
      const { place: detail } = await place.fetchFields({ fields: ["formattedAddress"] });
      const full = detail.formattedAddress ?? item.label;
      setQuery(full);
      if (hiddenRef.current) hiddenRef.current.value = full;
    } catch {
      if (hiddenRef.current) hiddenRef.current.value = item.label;
    } finally {
      setResolving(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        autoComplete="off"
        placeholder={resolving ? "Looking up full address…" : placeholder}
        disabled={resolving}
        className={className}
      />
      <input ref={hiddenRef} type="hidden" name={name} />

      {open && suggestions.length > 0 && (
        <ul style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          zIndex: 9999, margin: 0, padding: 0, listStyle: "none",
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "0.5rem", boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
          maxHeight: "14rem", overflowY: "auto",
        }}>
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: "0.5rem 0.75rem", fontSize: "0.875rem",
                color: "#111827", cursor: "pointer",
                borderTop: i > 0 ? "1px solid #f3f4f6" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
