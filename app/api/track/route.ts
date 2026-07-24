import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { pathname, hostname, ip, userAgent, referer, timestamp } =
      (await request.json()) as {
        pathname: string;
        hostname: string;
        ip: string;
        userAgent: string;
        referer: string;
        timestamp: string;
      };

    await prisma.pageView.create({
      data: {
        pathname: pathname ?? "",
        hostname: hostname ?? "",
        ip: ip ?? "",
        userAgent: userAgent ?? "",
        referer: referer ?? "",
        viewedAt: timestamp ? new Date(timestamp) : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
