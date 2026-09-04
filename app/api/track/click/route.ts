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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sendId = searchParams.get("s");
  const raw = searchParams.get("u");

  const destination = raw ? decodeURIComponent(raw) : null;

  if (!destination || !isSafeRedirect(destination)) {
    return new NextResponse("Invalid destination", { status: 400 });
  }

  if (sendId) {
    try {
      await prisma.campaignClick.create({
        data: { sendId, url: destination },
      });
    } catch {
      // Don't block the redirect if tracking fails
    }
  }

  return NextResponse.redirect(destination, { status: 302 });
}
