import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

/** Only redirect to https URLs on non-private hosts. */
function isSafeRedirect(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const h = url.hostname;
    // Block loopback, private ranges, link-local, and metadata IPs
    if (
      h === "localhost" ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^169\.254\./.test(h) ||
      /^::1$/.test(h)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a 2-letter country code from the request.
 * On Vercel, x-vercel-ip-country is injected automatically — free, zero latency.
 * On Railway (or any other host), falls back to null; country will be tagged
 * when they next click from a Vercel-hosted deployment, or we can add a
 * geolocation API call here later.
 */
function getCountry(request: Request): string | null {
  const country = request.headers.get("x-vercel-ip-country");
  return country && country.length === 2 ? country.toUpperCase() : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sendId = searchParams.get("s");
  const raw = searchParams.get("u");

  const destination = raw ? decodeURIComponent(raw) : null;

  if (!destination || !isSafeRedirect(destination)) {
    return new NextResponse("Invalid destination", { status: 400 });
  }

  if (sendId) {
    const country = getCountry(request);

    try {
      // Record the click
      await prisma.campaignClick.create({
        data: { sendId, url: destination },
      });

      // Tag the contact's country on first real click (never overwrites once set)
      if (country) {
        const send = await prisma.campaignSend.findUnique({
          where: { id: sendId },
          select: { contactId: true },
        });
        if (send?.contactId) {
          await prisma.contact.updateMany({
            where: { id: send.contactId, country: null },
            data: { country },
          });
        }
      }
    } catch {
      // Never block the redirect if tracking fails
    }
  }

  return NextResponse.redirect(destination, { status: 302 });
}
