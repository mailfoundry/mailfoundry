/** Ollie & Maddy wedding countdown — edit details here. Times are UK local (BST = +01:00 until 25 Oct 2026). */
export const COUPLE = { a: "Ollie", b: "Maddie" };

export type WeddingEvent = {
  id: string;
  title: string;
  subtitle: string;
  /** ISO with UK offset. If timeKnown is false, the countdown runs to the start of the day and shows "Time to be confirmed". */
  startsAt: string;
  timeKnown: boolean;
  durationMins: number;
  location: string;
  /** Optional extra line, e.g. reception details */
  extra?: string;
};

export const EVENTS: WeddingEvent[] = [
  {
    id: "legal",
    title: "The Legal Ceremony",
    subtitle: "Making it official",
    startsAt: "2026-10-20T11:30:00+01:00",
    timeKnown: true,
    durationMins: 45,
    location: "",
    extra: "A private registration ceremony",
  },
  {
    id: "wedding",
    title: "The Wedding",
    subtitle: "Celebrating with family and friends",
    startsAt: "2026-10-24T12:45:00+01:00",
    timeKnown: true,
    durationMins: 90,
    location: "Leek Kingdom Hall",
    extra: "Followed by a reception at 3:45pm · Bagnall Village Hall",
  },
];
