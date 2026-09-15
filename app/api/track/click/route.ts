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

/** SWF domains — we inject swf_cid only into these so the ID never leaks to third parties. */
const SWF_HOSTS = new Set([
  "staffordshirewoodfuels.co.uk",
  "www.staffordshirewoodfuels.co.uk",
]);

function isSWFDestination(destination: string): boolean {
  try {
    const host = new URL(destination).hostname;
    return SWF_HOSTS.has(host);
  } catch {
    return false;
  }
}

/** Append ?swf_cid=<contactId> to a URL, safely merging with any existing params. */
function injectContactId(destination: string, contactId: string): string {
  try {
    const url = new URL(destination);
    url.searchParams.set("swf_cid", contactId);
    return url.toString();
  } catch {
    return destination;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sendId = searchParams.get("s");
  const raw = searchParams.get("u");

  const destination = raw ? decodeURIComponent(raw) : null;

  if (!destination || !isSafeRedirect(destination)) {
    return new NextResponse("Invalid destination", { status: 400 });
  }

  let finalDestination = destination;

  if (sendId) {
    const country = getCountry(request);

    try {
      // Record the click
      await prisma.campaignClick.create({
        data: { sendId, url: destination },
      });

      // Look up the contact for country-tagging and swf_cid injection
      const send = await prisma.campaignSend.findUnique({
        where: { id: sendId },
        select: { contactId: true },
      });

      if (send?.contactId) {
        // Tag country on first real click (never overwrites once set)
        if (country) {
          await prisma.contact.updateMany({
            where: { id: send.contactId, country: null },
            data: { country },
          });
        }

        // Inject swf_cid into SWF destination URLs so the site can attribute page views
        if (isSWFDestination(destination)) {
          finalDestination = injectContactId(destination, send.contactId);
        }
      }
    } catch {
      // Never block the redirect if tracking fails
    }
  }

  return NextResponse.redirect(finalDestination, { status: 302 });
}
