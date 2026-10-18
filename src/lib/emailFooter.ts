import { signEmail } from "./unsubscribe";

function businessNameFromEmail(fromEmail?: string | null): string {
  if (fromEmail?.includes("staffordshirewoodfuels")) return "Staffordshire Wood Fuels";
  if (fromEmail?.includes("staffordshirecleaningsupplies")) return "Staffordshire Cleaning Supplies";
  return process.env.BUSINESS_NAME || "IBSA";
}

function appBaseUrl() {
  return process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";
}

export function addPreheader(html: string, preheader?: string | null): string {
  if (!preheader?.trim()) return html;
  // Invisible preheader text — suppresses email clients from pulling in body copy as the preview
  const tag = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader.trim()}&zwnj;&nbsp;`.repeat(1) + `</div>`;
  if (html.includes("<body")) {
    return html.replace(/<body([^>]*)>/, `<body$1>${tag}`);
  }
  return `${tag}${html}`;
}

/** Secure, recipient-specific unsubscribe page URL (HMAC-signed). */
export function unsubscribeUrlFor(recipientEmail?: string | null): string {
  const e = recipientEmail?.trim().toLowerCase();
  return e ? `${appBaseUrl()}/unsubscribe?email=${encodeURIComponent(e)}&sig=${signEmail(e)}` : `${appBaseUrl()}/unsubscribe`;
}

/** True for MailFoundry's own unsubscribe URLs — these are never click-tracked (an unsubscribe isn't engagement). */
export function isUnsubscribeUrl(url: string): boolean {
  return url.startsWith(`${appBaseUrl()}/unsubscribe`);
}

// ── Branded unsubscribe placeholder ─────────────────────────────────────────
// Custom HTML may carry its own unsubscribe link: <a href="{{unsubscribe_url}}">Unsubscribe</a>
// If it does (visibly), MailFoundry fills in the secure URL and doesn't add its own footer.

const PLACEHOLDER = /\{\{\s*unsubscribe_url\s*\}\}/gi;
const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
const HREF_IS_PLACEHOLDER = /\bhref\s*=\s*(["'])\s*\{\{\s*unsubscribe_url\s*\}\}\s*\1/i;
const HIDDEN_STYLE = /(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?![.\d]*[1-9])|opacity\s*:\s*0(?![.\d]*[1-9])|max-height\s*:\s*0(?![.\d]*[1-9]))/i;
// Anything brace-wrapped that looks like an unsubscribe tag but isn't exactly {{unsubscribe_url}}
const LOOKALIKE = /\{+\s*(?:unsub|opt[\s_-]*out)[^{}]*\}+/gi;

export type UnsubscribeCheck = {
  validLinks: number; // visible <a href="{{unsubscribe_url}}"> links with text
  placeholders: number; // any {{unsubscribe_url}} occurrences
  malformed: string[]; // look-alike tags that won't be filled in
  hiddenLinks: number; // placeholder links that are hidden or empty
};

export function checkUnsubscribe(html: string | null | undefined): UnsubscribeCheck {
  const src = html ?? "";
  let validLinks = 0;
  let hiddenLinks = 0;
  for (const m of src.matchAll(ANCHOR)) {
    const attrs = m[1];
    if (!HREF_IS_PLACEHOLDER.test(attrs)) continue;
    const text = m[2].replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;|&zwnj;|&#8203;/gi, "").trim();
    const style = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] ?? "";
    if (!text || HIDDEN_STYLE.test(style) || /\bhidden\b/i.test(attrs.replace(/\bstyle\s*=\s*(["'])[\s\S]*?\1/i, ""))) hiddenLinks++;
    else validLinks++;
  }
  const placeholders = src.match(PLACEHOLDER)?.length ?? 0;
  const malformed = (src.match(LOOKALIKE) ?? []).filter((t) => !/^\{\{\s*unsubscribe_url\s*\}\}$/i.test(t));
  return { validLinks, placeholders, malformed, hiddenLinks };
}

function standardFooter(unsubscribeUrl: string, businessName: string) {
  return `
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #6b7280;">
      <p style="margin: 0 0 8px;">
        You are receiving this email because you are on the ${businessName} mailing list.
      </p>
      <p style="margin: 0 0 8px;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">
          Unsubscribe
        </a>
      </p>
      <p style="margin: 0;">
        ${businessName}
      </p>
    </div>
  `;
}

/**
 * Fill in {{unsubscribe_url}} with the recipient's secure link. If the HTML has at least one
 * visible <a href="{{unsubscribe_url}}"> link, that IS the unsubscribe section — no second footer.
 * Otherwise (no link, hidden link, look-alike tag, or someone else's URL) the standard footer is appended.
 */
export function addEmailFooter(html: string, recipientEmail?: string, fromEmail?: string | null) {
  const url = unsubscribeUrlFor(recipientEmail);
  const check = checkUnsubscribe(html);
  const filled = html.replace(PLACEHOLDER, url.replace(/&/g, "&amp;"));
  if (check.validLinks > 0) return filled;

  const footer = standardFooter(url.replace(/&/g, "&amp;"), businessNameFromEmail(fromEmail));
  return filled.includes("</body>") ? filled.replace("</body>", `${footer}</body>`) : `${filled}${footer}`;
}

/** Plain-text version: fill {{unsubscribe_url}}, or append an unsubscribe line if there isn't one. */
export function addTextFooter(text: string, recipientEmail?: string, fromEmail?: string | null) {
  const url = unsubscribeUrlFor(recipientEmail);
  if (PLACEHOLDER.test(text)) {
    PLACEHOLDER.lastIndex = 0;
    return text.replace(PLACEHOLDER, url);
  }
  return `${text.replace(/\s+$/, "")}\n\n--\nYou're receiving this because you're on the ${businessNameFromEmail(fromEmail)} mailing list.\nUnsubscribe: ${url}\n`;
}
