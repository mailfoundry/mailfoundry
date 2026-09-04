import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * L-1: Nightly cron — delete expired tokens to keep the DB tidy.
 * Runs at 03:00 UTC daily (see vercel.json).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const now = new Date();

  const [loginTokens, conventionTokens, groupTokens] = await Promise.all([
    // Magic-link login tokens (IBSA admin)
    prisma.loginToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    // Convention order access tokens
    prisma.conventionOrderToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    // Group account access tokens
    prisma.groupAccountToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    deleted: {
      loginTokens: loginTokens.count,
      conventionTokens: conventionTokens.count,
      groupTokens: groupTokens.count,
    },
  });
}
