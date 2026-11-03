/**
 * Brand email layouts for SWF and SCS.
 *
 * The ChatGPT agent supplies campaign CONTENT only (headline, intro, products, call to action);
 * MailFoundry builds the HTML from the brand's fixed layout, so logos, colours, product cards
 * (image + description + SHOP button, both clickable) and the footer can't go missing.
 * The content is embedded in the HTML as a comment so it can be read back and edited.
 */

export type BrandKey = "swf" | "scs";

export type EmailProduct = {
  name: string;
  description: string;
  url: string;
  imageUrl: string;
  buttonText?: string;
};

export type BrandEmailContent = {
  eyebrow?: string;
  headline: string;
  intro: string; // paragraphs separated by a blank line
  heroImage?: { url: string; alt: string; link?: string };
  highlight?: { eyebrow?: string; title: string; text?: string; buttonText?: string; url?: string };
  productsHeading?: string;
  products?: EmailProduct[];
  closingHeading?: string;
  closingText?: string;
  cta: { text: string; url: string };
  signOff?: string;
};

export class BrandContentError extends Error {
  name = "CampaignInputError"; // surfaces as a 422 invalid_input in the agent API
}

export const TEMPLATE_VERSION: Record<BrandKey, string> = { swf: "swf-v1", scs: "scs-v1" };

const BRAND = {
  swf: {
    name: "Staffordshire Wood Fuels",
    site: "https://www.staffordshirewoodfuels.co.uk",
    domains: ["staffordshirewoodfuels.co.uk", "www.staffordshirewoodfuels.co.uk"],
    signOff: "Stay warm,",
  },
  scs: {
    name: "Staffordshire Cleaning Supplies",
    site: "https://www.staffordshirecleaningsupplies.co.uk",
    domains: ["staffordshirecleaningsupplies.co.uk", "www.staffordshirecleaningsupplies.co.uk"],
    signOff: "Best wishes,",
  },
} as const;

// Hosts the shop serves product images from (same list as the shop's next.config), plus each brand's own site.
const IMAGE_HOSTS = ["pub-a6225dff5ddb40ee8198615ff539ab7e.r2.dev", "cdn.shopify.com", "rc0g6k4vtrxuaghx.public.blob.vercel-storage.com"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const paragraphs = (s: string) =>
  s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

// ── Validation ──────────────────────────────────────────────────────────────

function text(v: unknown, field: string, max: number, required = true): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s && required) throw new BrandContentError(`content.${field} is required`);
  if (s.length > max) throw new BrandContentError(`content.${field} is too long (max ${max} characters)`);
  if (/<[a-z/!]/i.test(s)) throw new BrandContentError(`content.${field} must be plain text, not HTML`);
  return s;
}

function link(v: unknown, field: string, brand: BrandKey): string {
  const s = typeof v === "string" ? v.trim() : "";
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new BrandContentError(`content.${field} must be a full https:// link on ${BRAND[brand].domains[0]}`);
  }
  if (u.protocol !== "https:" || !(BRAND[brand].domains as readonly string[]).includes(u.hostname)) {
    throw new BrandContentError(`content.${field} must link to ${BRAND[brand].domains[0]} (got ${u.hostname || s})`);
  }
  return u.toString();
}

function image(v: unknown, field: string, brand: BrandKey): string {
  const s = typeof v === "string" ? v.trim() : "";
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new BrandContentError(`content.${field} must be a hosted image URL — use GET /products to find real product images`);
  }
  const ok = u.protocol === "https:" && (IMAGE_HOSTS.includes(u.hostname) || (BRAND[brand].domains as readonly string[]).includes(u.hostname));
  if (!ok) {
    throw new BrandContentError(`content.${field} must be a real product image from the ${BRAND[brand].name} shop (use GET /products) — ${u.hostname} isn't allowed`);
  }
  return u.toString();
}

/** Check and normalise agent-supplied content. Throws BrandContentError with a clear message. */
export function validateContent(brand: BrandKey, raw: unknown): BrandEmailContent {
  if (!raw || typeof raw !== "object") throw new BrandContentError("content must be an object");
  const c = raw as Record<string, unknown>;
  const out: BrandEmailContent = {
    eyebrow: text(c.eyebrow, "eyebrow", 40, false) || undefined,
    headline: text(c.headline, "headline", 90),
    intro: text(c.intro, "intro", 900),
    cta: (() => {
      const cta = (c.cta ?? {}) as Record<string, unknown>;
      return { text: text(cta.text, "cta.text", 30), url: link(cta.url, "cta.url", brand) };
    })(),
    productsHeading: text(c.productsHeading, "productsHeading", 60, false) || undefined,
    closingHeading: text(c.closingHeading, "closingHeading", 70, false) || undefined,
    closingText: text(c.closingText, "closingText", 400, false) || undefined,
    signOff: text(c.signOff, "signOff", 30, false) || undefined,
  };
  if (c.heroImage) {
    const h = c.heroImage as Record<string, unknown>;
    out.heroImage = {
      url: image(h.url, "heroImage.url", brand),
      alt: text(h.alt, "heroImage.alt", 150),
      link: h.link ? link(h.link, "heroImage.link", brand) : undefined,
    };
  }
  if (c.highlight) {
    const h = c.highlight as Record<string, unknown>;
    const hasButton = !!(h.buttonText || h.url);
    out.highlight = {
      eyebrow: text(h.eyebrow, "highlight.eyebrow", 40, false) || undefined,
      title: text(h.title, "highlight.title", 60),
      text: text(h.text, "highlight.text", 200, false) || undefined,
      buttonText: hasButton ? text(h.buttonText, "highlight.buttonText", 25) : undefined,
      url: hasButton ? link(h.url, "highlight.url", brand) : undefined,
    };
  }
  if (c.products !== undefined) {
    if (!Array.isArray(c.products)) throw new BrandContentError("content.products must be a list");
    if (c.products.length > 4) throw new BrandContentError("content.products: use at most 4 products");
    out.products = c.products.map((p, i) => {
      const r = (p ?? {}) as Record<string, unknown>;
      const name = text(r.name, `products[${i}].name`, 60);
      return {
        name,
        description: text(r.description, `products[${i}].description`, 200),
        url: link(r.url, `products[${i}].url`, brand),
        imageUrl: image(r.imageUrl, `products[${i}].imageUrl`, brand),
        buttonText: text(r.buttonText, `products[${i}].buttonText`, 25, false) || `SHOP ${name.toUpperCase()}`.slice(0, 25),
      };
    });
  }
  return out;
}

// ── Embedded content (read-back) ────────────────────────────────────────────

const MARK = /<!--mf-content:([A-Za-z0-9_-]+)-->/;

export function extractContent(html: string | null | undefined): { template: string; content: BrandEmailContent } | null {
  const m = html?.match(MARK);
  if (!m) return null;
  try {
    return JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function marker(brand: BrandKey, content: BrandEmailContent) {
  const json = JSON.stringify({ template: TEMPLATE_VERSION[brand], content });
  return `<!--mf-content:${Buffer.from(json, "utf8").toString("base64url")}-->`;
}

// ── Plain-text version ──────────────────────────────────────────────────────

export function renderText(brand: BrandKey, c: BrandEmailContent): string {
  const b = BRAND[brand];
  const lines: string[] = ["Hi {{firstName|there}},", ""];
  if (c.eyebrow) lines.push(c.eyebrow.toUpperCase());
  lines.push(c.headline, "", ...paragraphs(c.intro).flatMap((p) => [p, ""]));
  if (c.highlight) {
    lines.push(c.highlight.title);
    if (c.highlight.text) lines.push(c.highlight.text);
    if (c.highlight.url) lines.push(`${c.highlight.buttonText}: ${c.highlight.url}`);
    lines.push("");
  }
  if (c.products?.length) {
    if (c.productsHeading) lines.push(c.productsHeading, "");
    for (const p of c.products) lines.push(p.name, p.description, `${p.buttonText}: ${p.url}`, "");
  }
  if (c.closingHeading) lines.push(c.closingHeading);
  if (c.closingText) lines.push(c.closingText);
  lines.push(`${c.cta.text}: ${c.cta.url}`, "", c.signOff ?? b.signOff, "Jason", b.name);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── HTML layouts ────────────────────────────────────────────────────────────

const shell = (bg: string, inner: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title></title><style>@media(max-width:620px){.shell{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}.headline{font-size:30px!important;line-height:36px!important}.product-image{width:180px!important;height:auto!important}}</style></head><body style="margin:0;padding:0;background:${bg};font-family:Arial,Helvetica,sans-serif;">${inner}</body></html>`;

function button(text: string, url: string, bg: string, color: string, size = 13) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${bg}" style="border-radius:3px;"><a href="${esc(url)}" style="display:inline-block;padding:14px 29px;font-size:${size}px;font-weight:bold;color:${color};text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${esc(text)}</a></td></tr></table>`;
}

function renderSwf(c: BrandEmailContent): string {
  const G = "#173f31", GOLD = "#b48a42", GOLD_L = "#d6b36a", INK = "#27372d";
  const intro = paragraphs(c.intro).map((p) => `<p style="font-size:15px;line-height:25px;margin:0 0 14px;color:${INK};">${esc(p)}</p>`).join("");
  const hero = c.heroImage
    ? `<tr><td align="center" style="padding:0;">${c.heroImage.link ? `<a href="${esc(c.heroImage.link)}">` : ""}<img src="${esc(c.heroImage.url)}" width="600" alt="${esc(c.heroImage.alt)}" style="display:block;width:600px;max-width:100%;height:auto;border:0;">${c.heroImage.link ? "</a>" : ""}</td></tr>`
    : "";
  const highlight = c.highlight
    ? `<tr><td class="pad" style="padding:12px 42px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${G}" style="padding:23px 18px;border-top:4px solid ${GOLD};">${c.highlight.eyebrow ? `<p style="font:11px Arial,sans-serif;letter-spacing:2px;color:${GOLD_L};margin:0 0 9px;">${esc(c.highlight.eyebrow.toUpperCase())}</p>` : ""}<p style="font:normal 28px/34px Georgia,serif;color:#ffffff;margin:0 0 9px;">${esc(c.highlight.title)}</p>${c.highlight.text ? `<p style="font-size:14px;line-height:22px;color:#e8eee9;margin:0 0 17px;">${esc(c.highlight.text)}</p>` : ""}${c.highlight.url ? button(c.highlight.buttonText!, c.highlight.url, GOLD_L, G) : ""}</td></tr></table></td></tr>`
    : "";
  const products = c.products?.length
    ? `${c.productsHeading ? `<tr><td class="pad" style="padding:22px 42px 12px;"><h2 style="font:normal 25px/31px Georgia,serif;color:${G};margin:0;">${esc(c.productsHeading)}</h2></td></tr>` : ""}<tr><td class="pad" style="padding:8px 42px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${c.products
        .map(
          (p, i) =>
            `${i ? '<tr><td height="16"></td></tr>' : ""}<tr><td align="center" style="padding:20px 18px 24px;background:#f7f6f2;border:1px solid #e8e5dc;"><a href="${esc(p.url)}"><img class="product-image" src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="200" style="display:block;width:200px;max-width:100%;height:auto;border:0;margin:0 auto;"></a><h3 style="font:normal 23px/29px Georgia,serif;color:${G};margin:8px 0 7px;"><a href="${esc(p.url)}" style="color:${G};text-decoration:none;">${esc(p.name)}</a></h3><p style="font-size:14px;line-height:22px;margin:0 0 17px;color:${INK};">${esc(p.description)}</p>${button(p.buttonText!, p.url, G, "#ffffff")}</td></tr>`
        )
        .join("")}</table></td></tr>`
    : "";
  const closing = `<tr><td class="pad" align="center" style="padding:32px 42px 34px;">${c.closingHeading ? `<h2 style="font:normal 26px/32px Georgia,serif;color:${G};margin:0 0 12px;">${esc(c.closingHeading)}</h2>` : ""}${c.closingText ? `<p style="font-size:15px;line-height:24px;margin:0 0 20px;color:${INK};">${esc(c.closingText)}</p>` : ""}${button(c.cta.text, c.cta.url, G, "#ffffff", 14)}</td></tr>`;

  return shell(
    "#f1f0ea",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:22px 10px;"><table role="presentation" class="shell" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;">
<tr><td align="center" bgcolor="${G}" style="padding:26px 20px 22px;"><a href="${BRAND.swf.site}" style="text-decoration:none;"><div style="font:26px Georgia,serif;color:#ffffff;">Staffordshire Wood Fuels</div><div style="font:11px Arial,sans-serif;letter-spacing:2px;color:${GOLD_L};padding-top:9px;">NATURAL HEAT. DELIVERED.</div></a></td></tr>
<tr><td height="4" bgcolor="${GOLD}" style="font-size:0;line-height:0;">&nbsp;</td></tr>
${hero}
<tr><td class="pad" style="padding:30px 42px 16px;"><p style="font-size:15px;line-height:24px;margin:0 0 20px;color:${INK};">Hi {{firstName|there}},</p>${c.eyebrow ? `<p style="font-size:11px;letter-spacing:2px;color:#a17b36;margin:0 0 9px;">${esc(c.eyebrow.toUpperCase())}</p>` : ""}<h1 class="headline" style="font:normal 36px/42px Georgia,serif;color:${G};margin:0 0 16px;">${esc(c.headline)}</h1>${intro}</td></tr>
${highlight}${products}${closing}
<tr><td class="pad" style="padding:23px 42px;background:#f3f1eb;"><p style="font:normal 23px Georgia,serif;color:${G};margin:0 0 7px;">Natural heat. Delivered.</p><p style="font-size:14px;line-height:22px;margin:0;color:${INK};">Kiln-dried logs, kindling and coal, delivered across Staffordshire.</p></td></tr>
<tr><td class="pad" style="padding:25px 42px;"><p style="font-size:15px;line-height:24px;margin:0;color:${INK};">${esc(c.signOff ?? BRAND.swf.signOff)}<br><strong>Jason</strong><br>Staffordshire Wood Fuels</p></td></tr>
<tr><td align="center" bgcolor="${G}" style="padding:26px 20px;"><p style="font:normal 21px Georgia,serif;color:#ffffff;margin:0 0 12px;"><a href="${BRAND.swf.site}" style="color:#ffffff;text-decoration:none;">Staffordshire Wood Fuels</a></p><p style="font-size:13px;line-height:20px;color:#e0e7e1;margin:0;">Don't want marketing emails? <a href="{{unsubscribe_url}}" style="color:#ffffff;text-decoration:underline;">Unsubscribe</a></p></td></tr>
</table></td></tr></table>`
  );
}

function renderScs(c: BrandEmailContent): string {
  const G = "#07572d", ACCENT = "#6aaa3b", LIGHT = "#eaf3eb", INK = "#26342a";
  const intro = paragraphs(c.intro).map((p) => `<p style="margin:0 0 15px;font-size:16px;line-height:26px;color:${INK};">${esc(p)}</p>`).join("");
  const hero = c.heroImage
    ? `<tr><td align="center" style="padding:0;">${c.heroImage.link ? `<a href="${esc(c.heroImage.link)}" style="display:block;">` : ""}<img src="${esc(c.heroImage.url)}" width="600" alt="${esc(c.heroImage.alt)}" style="display:block;width:600px;max-width:100%;height:auto;border:0;">${c.heroImage.link ? "</a>" : ""}</td></tr>`
    : "";
  const highlight = c.highlight
    ? `<tr><td class="pad" style="padding:22px 48px;background:${LIGHT};">${c.highlight.eyebrow ? `<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:${G};">${esc(c.highlight.eyebrow.toUpperCase())}</p>` : ""}<p style="margin:0 0 5px;color:${G};font-size:16px;font-weight:bold;">${esc(c.highlight.title)}</p>${c.highlight.text ? `<p style="margin:0 0 ${c.highlight.url ? 14 : 0}px;font-size:14px;line-height:23px;color:${INK};">${esc(c.highlight.text)}</p>` : ""}${c.highlight.url ? button(c.highlight.buttonText!, c.highlight.url, G, "#ffffff") : ""}</td></tr>`
    : "";
  const products = c.products?.length
    ? `${c.productsHeading ? `<tr><td class="pad" style="padding:26px 48px 10px;"><h2 style="margin:0;font-size:22px;line-height:28px;color:${G};">${esc(c.productsHeading)}</h2></td></tr>` : ""}<tr><td class="pad" style="padding:8px 48px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${c.products
        .map(
          (p, i) =>
            `${i ? '<tr><td height="16"></td></tr>' : ""}<tr><td align="center" style="padding:20px 18px 24px;background:#f7faf7;border:1px solid #dfe9e0;border-top:3px solid ${ACCENT};"><a href="${esc(p.url)}"><img class="product-image" src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="200" style="display:block;width:200px;max-width:100%;height:auto;border:0;margin:0 auto;"></a><h3 style="margin:10px 0 7px;font-size:19px;line-height:25px;color:${G};"><a href="${esc(p.url)}" style="color:${G};text-decoration:none;">${esc(p.name)}</a></h3><p style="margin:0 0 17px;font-size:14px;line-height:22px;color:${INK};">${esc(p.description)}</p>${button(p.buttonText!, p.url, G, "#ffffff")}</td></tr>`
        )
        .join("")}</table></td></tr>`
    : "";
  const closing = `<tr><td class="pad" align="center" style="padding:30px 48px 32px;">${c.closingHeading ? `<h2 style="margin:0 0 10px;font-size:22px;line-height:28px;color:${G};">${esc(c.closingHeading)}</h2>` : ""}${c.closingText ? `<p style="margin:0 0 20px;font-size:15px;line-height:24px;color:${INK};">${esc(c.closingText)}</p>` : ""}${button(c.cta.text, c.cta.url, G, "#ffffff", 14)}</td></tr>`;

  return shell(
    "#f2f5f2",
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2f5f2;"><tr><td align="center" style="padding:24px 12px 36px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="shell" style="width:600px;max-width:600px;background:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:20px 24px 16px;"><a href="${BRAND.scs.site}/" style="display:inline-block;text-decoration:none;"><img src="${BRAND.scs.site}/logo-scs.png" width="245" alt="Staffordshire Cleaning Supplies" style="display:block;width:245px;max-width:100%;height:auto;border:0;"></a></td></tr>
<tr><td style="height:5px;background:${ACCENT};font-size:0;line-height:0;">&nbsp;</td></tr>
${hero}
<tr><td class="pad" style="padding:28px 48px 16px;"><p style="margin:0 0 15px;font-size:16px;line-height:26px;color:${INK};">Hi {{firstName|there}},</p>${c.eyebrow ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:${ACCENT};font-weight:bold;">${esc(c.eyebrow.toUpperCase())}</p>` : ""}<h1 class="headline" style="margin:0 0 14px;font-size:30px;line-height:36px;color:${G};">${esc(c.headline)}</h1>${intro}</td></tr>
${highlight}${products}${closing}
<tr><td class="pad" style="padding:22px 48px;background:${LIGHT};"><p style="margin:0 0 5px;color:${G};font-size:16px;font-weight:bold;">Professional supplies. Less fuss.</p><p style="margin:0;font-size:14px;line-height:23px;color:${INK};">Trusted cleaning, washroom and janitorial supplies for Staffordshire businesses.</p></td></tr>
<tr><td class="pad" style="padding:24px 48px;"><p style="margin:0;font-size:15px;line-height:24px;color:${INK};">${esc(c.signOff ?? BRAND.scs.signOff)}<br><strong>Jason</strong><br>Staffordshire Cleaning Supplies</p></td></tr>
<tr><td align="center" style="padding:22px 24px;background:${G};"><p style="margin:0 0 8px;font-size:15px;font-weight:bold;"><a href="${BRAND.scs.site}/" style="color:#ffffff;text-decoration:none;">Staffordshire Cleaning Supplies</a></p><p style="margin:0;font-size:13px;line-height:20px;color:#dbe8dd;">Don't want marketing emails? <a href="{{unsubscribe_url}}" style="color:#ffffff;text-decoration:underline;">Unsubscribe</a></p></td></tr>
</table></td></tr></table>`
  );
}

/** Build the branded HTML + plain text from validated content. */
export function renderBrandEmail(brand: BrandKey, content: BrandEmailContent): { html: string; text: string } {
  const body = brand === "swf" ? renderSwf(content) : renderScs(content);
  const html = body.replace(/\n/g, "").replace(/(<body[^>]*>)/, `$1${marker(brand, content)}`);
  return { html, text: renderText(brand, content) };
}

export function isBrandKey(v: unknown): v is BrandKey {
  return v === "swf" || v === "scs";
}

export const BRAND_SITE: Record<BrandKey, string> = { swf: BRAND.swf.site, scs: BRAND.scs.site };
