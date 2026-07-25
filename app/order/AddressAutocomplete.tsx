"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: {
              componentRestrictions?: { country: string };
              fields?: string[];
            }
          ) => {
            addListener: (event: string, cb: () => void) => void;
            getPlace: () => { formatted_address?: string };
          };
        };
      };
    };
  }
}

type Props = {
  name?: string;
  placeholder?: string;
  className?: string;
};

export default function AddressAutocomplete({ name = "deliveryAddress", placeholder, className }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || initialised.current) return;

    function attach() {
      if (!inputRef.current || !window.google?.maps?.places || initialised.current) return;
      initialised.current = true;

      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "gb" },
        fields: ["formatted_address"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place?.formatted_address) {
          if (inputRef.current)  inputRef.current.value  = place.formatted_address;
          if (hiddenRef.current) hiddenRef.current.value = place.formatted_address;
        }
      });
    }

    const poll = setInterval(() => {
      if (window.google?.maps?.places) {
        clearInterval(poll);
        attach();
      }
    }, 100);

    if (!document.querySelector('script[data-places="1"]')) {
      const script = document.createElement("script");
      script.setAttribute("data-places", "1");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => clearInterval(poll);
  }, []);

  return (
    <>
      <style>{`.pac-container { z-index: 9999 !important; }`}</style>

      {/* Visible input — neutral name so Safari doesn't trigger its address autofill */}
      <input
        ref={inputRef}
        type="text"
        name="address-search"
        autoComplete="new-password"
        placeholder={placeholder ?? "Start typing an address or postcode…"}
        className={className}
        onChange={(e) => {
          if (hiddenRef.current) hiddenRef.current.value = e.target.value;
        }}
      />

      {/* Hidden input carries the value in FormData */}
      <input ref={hiddenRef} type="hidden" name={name} />
    </>
  );
}
