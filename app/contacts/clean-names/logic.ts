import { cleanName } from "../../../src/lib/merge";

export type NameRow = { id: string; email: string; firstName: string | null; lastName: string | null };
export type NameChange = NameRow & {
  newFirst: string | null;
  newLast: string | null;
  reasons: string[];
};

const norm = (s: string | null) => (s && s.trim() ? s : null);

/** Work out the tidied first/last name for one contact. Returns null if nothing would change. */
export function proposeNameChange(r: NameRow): NameChange | null {
  let newFirst = cleanName(r.firstName);
  let newLast = cleanName(r.lastName);
  const reasons: string[] = [];

  // Full name typed into the first-name box and no surname → split it
  if (newFirst && newFirst.includes(" ") && !newLast) {
    const [head, ...rest] = newFirst.split(" ");
    const f = cleanName(head);
    const l = cleanName(rest.join(" "));
    if (f) {
      newFirst = f;
      newLast = l;
      reasons.push("split full name");
    }
  }

  const oldFirst = norm(r.firstName);
  const oldLast = norm(r.lastName);
  if (newFirst === oldFirst && newLast === oldLast) return null;

  if (oldFirst && !newFirst) reasons.push("junk first name removed");
  if (oldLast && !newLast) reasons.push("junk last name removed");
  if (oldFirst && newFirst && oldFirst !== newFirst && !reasons.includes("split full name")) reasons.push("tidied first name");
  if (oldLast && newLast && oldLast !== newLast && !reasons.includes("split full name")) reasons.push("tidied last name");
  if (!reasons.length) reasons.push("whitespace");

  return { ...r, newFirst, newLast, reasons };
}
