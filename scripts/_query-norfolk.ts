import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as never) as any;
async function main() {
  const convs = await prisma.ibsaConvention.findMany({ where: { name: { contains: "norfolk", mode: "insensitive" } }, select: { id: true, name: true, venue: true } });
  console.log("Conventions:", JSON.stringify(convs, null, 2));
  const codes = ["MOP_STAND_PY(12)_7OZ_BLUE", "BRUSH_SOFT_45CM + ALLOY_HANDLE_RED", "LOBBY_BRUSH_LONGHNDL_COMPLETE_SET_BLACK", "CLOVER_ULTRAFRESH_5L"];
  const prods = await prisma.ibsaProduct.findMany({ where: { code: { in: codes } }, select: { code: true, unitCost: true } });
  console.log("Products found:", JSON.stringify(prods, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
