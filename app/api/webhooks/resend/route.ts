import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/src/lib/prisma";

/**
 * Resend webhook — marks contacts on hard bounces and spam complaints so MailFoundry
 * stops sending to them (the send routes skip bouncedAt / complainedAt contacts).
 *
 * Setup: Resend dashboard → Webhooks → Add endpoint
 *   URL:    https://ibsa.xylouk.co.uk/api/webhooks/resend
 *   Events: email.bounced, email.complained
 * Copy the signing secret (whsec_…) into the Railway env var RESEND_WEBHOOK_SECRET.
 *
 * Public route (/api/webhooks is allow-listed in proxy.ts); authenticity is proven by
 * the Svix signature that Resend attaches to every webhook.
 */

const TOLERANCE_SECONDS = 5 * 60;

function verifySvix(body: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) {
    console.warn("[resend-webhook] missing svix headers");
    return false;
  }

  // Reject stale / future-dated messages (replay protection)
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) {
    console.warn(`[resend-webhook] timestamp outside tolerance: ${timestamp}`);
    return false;
  }

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  // Header holds one or more space-separated "v1,<base64>" signatures
  const ok = signatureHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) console.warn(`[resend-webhook] signature mismatch (secret starts ${secret.slice(0, 10)}…)`);
  return ok;
}

type ResendEvent = {
  type: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string; subType?: string; message?: string };
    tags?: Record<string, string> | { name: string; value: string }[];
  };
};

function tagValue(tags: ResendEvent["data"]["tags"], name: string): string | undefined {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags.find((t) => t.name === name)?.value;
  return tags[name];
}

export async function POST(request: Request) {
  // Trim: a stray space or newline pasted into Railway breaks the signature check
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim().replace(/^["']|["']$/g, "");
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await request.text();
  if (!verifySvix(body, request.headers, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const recipients = (Array.isArray(event.data?.to) ? event.data.to : [event.data?.to])
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .map((e) => e.trim().toLowerCase());
  const sendId = tagValue(event.data?.tags, "send_id");
  const now = new Date();

  if (event.type === "email.bounced") {
    // Only hard (permanent) bounces suppress the contact; soft/transient ones (full
    // mailbox, temporary server issue) are left alone. Missing type = treat as hard.
    const bounceType = (event.data.bounce?.type ?? "Permanent").toLowerCase();
    const isHard = bounceType !== "transient" && bounceType !== "undetermined";
    if (isHard && recipients.length) {
      await prisma.contact.updateMany({
        where: { email: { in: recipients }, bouncedAt: null },
        data: { bouncedAt: now },
      });
    }
    if (sendId) {
      await prisma.campaignSend.updateMany({
        where: { id: sendId },
        data: { status: isHard ? "bounced" : "soft_bounced" },
      });
    }
    console.log(`[resend-webhook] ${isHard ? "hard" : "soft"} bounce: ${recipients.join(", ")}`);
  } else if (event.type === "email.complained") {
    // Spam complaint — never email again. Also mark unsubscribed so it shows clearly in lists.
    if (recipients.length) {
      await prisma.contact.updateMany({
        where: { email: { in: recipients } },
        data: { complainedAt: now },
      });
      await prisma.contact.updateMany({
        where: { email: { in: recipients }, unsubscribedAt: null },
        data: { unsubscribedAt: now },
      });
    }
    if (sendId) {
      await prisma.campaignSend.updateMany({ where: { id: sendId }, data: { status: "complained" } });
    }
    console.log(`[resend-webhook] complaint: ${recipients.join(", ")}`);
  }
  // Other event types are acknowledged and ignored.

  return NextResponse.json({ ok: true });
}
