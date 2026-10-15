/**
 * Merge tags for campaigns.
 *
 *   {{firstName}}            → "Jane"  (or "" if blank)
 *   {{firstName|there}}      → "Jane"  (or "there" if blank)   e.g. "Hi {{firstName|there}},"
 *   {{lastName|}} / {{email}} also supported. Tag names are case-insensitive, spaces allowed.
 *
 * Names are tidied at send time too (cleanFirstName), so "JOHN" → "John" and junk → fallback,
 * even before the stored data has been cleaned.
 */

type MergeContact = { firstName?: string | null; lastName?: string | null; email?: string | null };

const TAG = /\{\{\s*(firstname|lastname|email)\s*(?:\|([^}]*))?\}\}/gi;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function applyMergeTags(text: string, contact: MergeContact, opts: { html?: boolean } = {}): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(TAG, (_m, field: string, fallback?: string) => {
    const key = field.toLowerCase();
    let value = "";
    if (key === "firstname") value = cleanFirstName(contact.firstName, contact.lastName) ?? "";
    if (key === "lastname")  value = cleanName(contact.lastName) ?? "";
    if (key === "email")     value = contact.email ?? "";
    const out = value || (fallback ?? "").trim();
    return opts.html ? escapeHtml(out) : out;
  });
}

export function hasMergeTags(...parts: (string | null | undefined)[]) {
  return parts.some((p) => !!p && /\{\{\s*(firstname|lastname|email)/i.test(p));
}

// ── Name cleaning ────────────────────────────────────────────────────────────

const JUNK = new Set([
  "test", "testing", "na", "n/a", "none", "null", "undefined", "unknown", "customer", "user", "admin",
  "info", "sales", "office", "accounts", "enquiries", "mr", "mrs", "ms", "miss", "dr", "sir", "madam",
  "x", "xx", "xxx", "asdf", "qwerty", "abc", "no", "name", "first", "firstname", "-", ".",
]);
const TITLES = /^(mr|mrs|ms|miss|dr|prof|rev|sir)\.?\s+/i;

/** Proper-case a name part: "o'BRIEN-smith" → "O'Brien-Smith", "mcdonald" → "McDonald". */
function properCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s'\-])([a-zà-ÿ])/g, (_m, sep, ch) => sep + ch.toUpperCase())
    .replace(/\bMc([a-z])/g, (_m, ch) => "Mc" + ch.toUpperCase());
}

/** Returns a tidy name, or null if it looks like junk. */
export function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.normalize("NFC").replace(/\s+/g, " ").trim().replace(TITLES, "").trim();
  if (!s) return null;
  if (s.includes("@") || /https?:|www\./i.test(s)) return null;      // an email or URL
  if (/\d/.test(s)) return null;                                     // digits → not a real name
  if (!/^[\p{L}][\p{L}' .\-]*$/u.test(s)) return null;                // letters, apostrophes, hyphens, spaces only
  if (s.replace(/[^\p{L}]/gu, "").length < 2) return null;           // single letter / initial
  if (JUNK.has(s.toLowerCase())) return null;
  if (s.length > 40) return null;
  // Re-case each part that's ALL upper or ALL lower ("Mary-ANNE" → "Mary-Anne", "o'BRIEN" → "O'Brien");
  // leave deliberate mixed case (e.g. "DeShawn", "McKenzie") alone
  s = s
    .split(/([\s'\-]+)/)
    .map((part) => (/^[\s'\-]*$/.test(part) ? part : part === part.toUpperCase() || part === part.toLowerCase() ? properCase(part) : part))
    .join("");
  if (/^[a-z]$/.test(s[0] ?? "")) s = s[0].toUpperCase() + s.slice(1);
  return s;
}

/**
 * Clean first name. If the first-name field holds a full name ("john smith") and there's no
 * separate surname, take just the first word.
 */
export function cleanFirstName(first: string | null | undefined, last?: string | null): string | null {
  const c = cleanName(first);
  if (!c) return null;
  if (c.includes(" ")) {
    const word = cleanName(c.split(" ")[0]);
    if (word) return word;
  }
  return c;
}
