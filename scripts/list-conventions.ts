import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as never) as any;
async function main() {
  const convs = await prisma.ibsaConvention.findMany({ select: { name: true, venue: true }, orderBy: { name: "asc" } });
  for (const c of convs) console.log(`"${c.name}" | ${c.venue ?? "(no venue)"}`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
