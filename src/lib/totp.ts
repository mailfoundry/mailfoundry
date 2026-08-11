/**
 * Pure Node.js TOTP implementation (RFC 6238).
 * No external dependencies — uses Node's built-in crypto module.
 */
import { createHmac } from "crypto";

function base32Decode(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned  = base32.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits   = 0;
  let value  = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: bigint): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);
  const hmac   = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[19] & 0xf;
  const code   = ((hmac[offset] & 0x7f) << 24) |
                 (hmac[offset + 1] << 16) |
                 (hmac[offset + 2] << 8)  |
                  hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  const secret  = base32Decode(secretBase32);
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const cleaned = token.replace(/\s/g, "");
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, counter + BigInt(i)) === cleaned) return true;
  }
  return false;
}
