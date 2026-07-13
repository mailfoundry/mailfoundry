import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as unknown as {
  ibsaConvention: { findMany: (a: unknown) => Promise<{name: string}[]> };
  $disconnect: () => Promise<void>;
};

const rows = await prisma.ibsaConvention.findMany({ select: { name: true } } as never);
rows.sort((a,b) => a.name.localeCompare(b.name));
rows.forEach(r => console.log(r.name));
await prisma.$disconnect();
