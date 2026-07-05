import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sendId = searchParams.get("s");
  const url = searchParams.get("u");

  const destination = url ? decodeURIComponent(url) : null;

  if (sendId && destination) {
    try {
      await prisma.campaignClick.create({
        data: {
          sendId,
          url: destination,
        },
      });
    } catch {
      // Don't block the redirect if tracking fails
    }
  }

  if (destination) {
    return NextResponse.redirect(destination, { status: 302 });
  }

  return new NextResponse("Not found", { status: 404 });
}
