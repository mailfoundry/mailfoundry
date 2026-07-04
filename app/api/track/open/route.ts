import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sendId = searchParams.get("s");

  if (sendId) {
    try {
      // Only record the first open
      await prisma.campaignSend.updateMany({
        where: { id: sendId, openedAt: null },
        data: { openedAt: new Date() },
      });
    } catch {
      // Silently ignore — never break email rendering over a tracking error
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
