import { createHmac, timingSafeEqual } from "crypto";

/** HMAC signature for an email address (lower-cased) — used in all unsubscribe links. */
export function signEmail(email: string): string {
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET ?? "change-me-in-production";
  return createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}

export function verifyEmailSignature(email: string, sig: string): boolean {
  const expected = Buffer.from(signEmail(email));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function appBaseUrl() {
  return process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";
}

/**
 * RFC 2369 + RFC 8058 headers so Gmail/Yahoo/Apple show their native "Unsubscribe"
 * button and can unsubscribe in one click (required for bulk senders since Feb 2024).
 */
export function listUnsubscribeHeaders(email: string): Record<string, string> {
  const e = email.toLowerCase();
  const url = `${appBaseUrl()}/unsubscribe/one-click?email=${encodeURIComponent(e)}&sig=${signEmail(e)}`;
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
