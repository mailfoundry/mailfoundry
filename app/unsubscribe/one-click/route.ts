import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { verifyEmailSignature } from "@/src/lib/unsubscribe";

/**
 * RFC 8058 one-click unsubscribe endpoint, called by Gmail/Yahoo/Apple Mail when the
 * recipient taps the inbox "Unsubscribe" button. Must work without cookies or a page
 * visit and must always answer 200 quickly. Public (under /unsubscribe in proxy.ts).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const sig = (url.searchParams.get("sig") ?? "").trim();

  if (email && sig && verifyEmailSignature(email, sig)) {
    await prisma.contact.updateMany({
      where: { email, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
  }
  // Always 200 — never reveal whether an address exists or a signature was valid.
  return NextResponse.json({ ok: true });
}

/** A plain GET (e.g. a mail client opening the URL) goes to the normal confirmation page. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/unsubscribe", url.origin);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return NextResponse.redirect(target, 303);
}
