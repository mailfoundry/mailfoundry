/**
 * Detects mistyped email domains (e.g. "icloud.con", "otmail.com", "live.co.ik") and malformed addresses.
 * Conservative by design: only suggests a fix when the domain is NOT a known provider and is a near-miss
 * of one; anything else (including unknown business domains) is left alone.
 */

export const KNOWN_DOMAINS = [
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.co.uk",
  "live.com", "live.co.uk", "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com", "me.com",
  "mac.com", "aol.com", "aol.co.uk", "btinternet.com", "btopenworld.com", "sky.com", "talktalk.net",
  "virginmedia.com", "ntlworld.com", "blueyonder.co.uk", "tiscali.co.uk", "mail.com", "gmx.com",
  "gmx.co.uk", "protonmail.com", "proton.me", "orange.net", "plus.net", "fsmail.net", "uwclub.net",
];
const KNOWN = new Set(KNOWN_DOMAINS);

// Common TLD slips → correct ending (applied before matching)
const TLD_FIXES: [RegExp, string][] = [
  [/\.co\.(ik|uj|ul|yk|jk|um|u)$/, ".co.uk"],
  [/\.(couk|co\.uk\.?)$/, ".co.uk"],
  [/\.c\.uk$/, ".co.uk"],
  [/\.(con|comt|cmo|cpm|vom|xom|om|cm|co|comm|coom|ocm|cim|clm|kom|c0m)$/, ".com"],
  [/\.(nett|ner|nte)$/, ".net"],
];

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
    {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // Swapped neighbouring letters ("gmial") count as one slip, not two
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
    }
  return dp[a.length][b.length];
}

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export type EmailIssue =
  | { kind: "fix"; email: string; suggested: string; reason: string }
  | { kind: "invalid"; email: string; reason: string };

export function checkEmail(raw: string): EmailIssue | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1 || !EMAIL_RE.test(email)) {
    // Try simple repairs before declaring invalid (trailing dot, spaces, comma instead of dot)
    const repaired = email.replace(/\s+/g, "").replace(/,/g, ".").replace(/\.+$/, "").replace(/\.\./g, ".");
    if (repaired !== email && EMAIL_RE.test(repaired)) {
      const again = checkEmail(repaired);
      return again ?? { kind: "fix", email, suggested: repaired, reason: "formatting" };
    }
    return { kind: "invalid", email, reason: "not a valid email address" };
  }

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (KNOWN.has(domain)) return null;

  // 1) TLD typo on an otherwise-known domain: "icloud.con", "btinternet.comt", "live.co.ik"
  for (const [re, rep] of TLD_FIXES) {
    if (re.test(domain)) {
      const fixed = domain.replace(re, rep);
      if (KNOWN.has(fixed)) return { kind: "fix", email, suggested: `${local}@${fixed}`, reason: `ending .${domain.split(".").slice(1).join(".")}` };
      // Fix TLD then also check provider spelling below
      const near = nearestKnown(fixed);
      if (near) return { kind: "fix", email, suggested: `${local}@${near}`, reason: "misspelt provider + ending" };
    }
  }

  // 2) Misspelt provider name with a correct ending: "otmail.com", "liive.com", "gmial.com"
  const near = nearestKnown(domain);
  if (near) return { kind: "fix", email, suggested: `${local}@${near}`, reason: "misspelt provider" };

  return null; // unknown domain that isn't close to a provider — probably a real business domain
}

function nearestKnown(domain: string): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const k of KNOWN_DOMAINS) {
    // Only compare like-with-like endings to avoid "live.com" → "live.co.uk" style guesses
    const kEnd = k.endsWith(".co.uk") ? ".co.uk" : k.slice(k.lastIndexOf("."));
    if (!domain.endsWith(kEnd)) continue;
    const d = levenshtein(domain, k);
    if (d < bestD) { bestD = d; best = k; }
  }
  if (!best) return null;
  const name = best.split(".")[0];
  // Very short provider names (me, sky, aol, msn, mac, gmx) are never "corrected" — too risky
  const maxD = name.length <= 3 ? 0 : name.length <= 6 ? 1 : 2;
  return bestD > 0 && bestD <= maxD ? best : null;
}
