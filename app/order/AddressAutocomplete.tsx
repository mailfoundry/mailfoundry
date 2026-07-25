"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    _placesReady?: boolean;
    _placesCallbacks?: (() => void)[];
    initPlacesAutocomplete?: () => void;
  }
}

type Props = {
  name?: string;
  placeholder?: string;
  className?: string;
};

export default function AddressAutocomplete({ name = "deliveryAddress", placeholder, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    function init() {
      if (!inputRef.current || !window.google?.maps?.places) return;
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "gb" },
        fields: ["formatted_address"],
        types: ["address"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place?.formatted_address && inputRef.current) {
          inputRef.current.value = place.formatted_address;
        }
      });
    }

    if (window._placesReady) {
      init();
    } else if (!document.querySelector('script[data-places="1"]')) {
      // First mount — load the script
      window._placesCallbacks = [init];
      window.initPlacesAutocomplete = () => {
        window._placesReady = true;
        window._placesCallbacks?.forEach((fn) => fn());
        window._placesCallbacks = [];
      };
      const script = document.createElement("script");
      script.setAttribute("data-places", "1");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=initPlacesAutocomplete`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      // Script already loading — queue callback
      (window._placesCallbacks ??= []).push(init);
    }
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      name={name}
      placeholder={placeholder ?? "Start typing an address or postcode…"}
      className={className}
      autoComplete="off"
    />
  );
}
