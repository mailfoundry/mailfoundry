import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { codes } = await req.json() as { codes: string[] };
    if (!Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({});
    }
    const products = await prisma.ibsaProduct.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true, name: true, variant: true, category: true, unitCost: true },
    });
    const result: Record<string, typeof products[0]> = {};
    for (const p of products) result[p.code] = p;
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
