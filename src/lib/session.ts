/**
 * Signed session cookies (HMAC-SHA256 via Web Crypto — works in proxy.ts and server code).
 *
 * Cookie value = base64url(JSON payload) + "." + base64url(signature)
 * Payload = { k: kind, sub: subject, exp: unix seconds }
 *
 * Replaces the old static "1" / raw-ID cookies, which anyone could forge in their browser.
 * Requires SESSION_SECRET (≥ 32 chars) — generate with: openssl rand -hex 32
 * Rotating SESSION_SECRET logs everyone out.
 */

export type SessionKind = "main" | "ibsa" | "group" | "conv";

export const MAIN_COOKIE = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
export const IBSA_COOKIE = "ibsa_auth";
export const GROUP_COOKIE = "group_auth";
export const CONV_COOKIE = "convention_auth";

/** Session lifetimes (seconds) */
export const SESSION_TTL: Record<SessionKind, number> = {
  main: 60 * 60 * 8, // 8 hours
  ibsa: 60 * 60 * 12, // 12 hours
  group: 60 * 60 * 24 * 7, // 7 days (was 30)
  conv: 60 * 60 * 8, // 8 hours
};

export const COOKIE_NAME: Record<SessionKind, string> = {
  main: MAIN_COOKIE,
  ibsa: IBSA_COOKIE,
  group: GROUP_COOKIE,
  conv: CONV_COOKIE,
};

const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  }
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify",
    ]);
  }
  return keyPromise;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Create a signed token for the given kind + subject. */
export async function signSession(kind: SessionKind, sub: string, ttlSeconds = SESSION_TTL[kind]): Promise<string> {
  const payload = { k: kind, sub, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await getKey(), enc.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

/** Verify a token. Returns the subject if valid, unexpired and of the expected kind; otherwise null. Never throws. */
export async function verifySession(token: string | undefined | null, kind: SessionKind): Promise<string | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const ok = await crypto.subtle.verify("HMAC", await getKey(), b64urlDecode(sig), enc.encode(body)); // constant-time
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as { k?: string; sub?: string; exp?: number };
    if (payload.k !== kind || typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null; // malformed token, or SESSION_SECRET missing → fail closed
  }
}

/** Standard cookie options for a session of this kind. */
export function sessionCookieOptions(kind: SessionKind) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL[kind],
  };
}
