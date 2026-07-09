/**
 * Create or update an IBSA portal user.
 * Usage:
 *   npx tsx scripts/create-ibsa-user.ts <email> <name> <password>
 *
 * Example:
 *   npx tsx scripts/create-ibsa-user.ts carol@xylouk.co.uk "Carol Ridge" "YourPassword"
 */

import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function main() {
  const [, , email, name, password] = process.argv;

  if (!email || !name || !password) {
    console.error("Usage: npx tsx scripts/create-ibsa-user.ts <email> <name> <password>");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set. Run: export $(grep DATABASE_URL .env | tr -d '\"')");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter } as never);

  const hashedPassword = await hashPassword(password);

  const user = await (prisma as unknown as { ibsaUser: { upsert: (args: unknown) => Promise<unknown> } }).ibsaUser.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), name, hashedPassword },
    update: { name, hashedPassword },
  });

  console.log(`✓ IBSA user created/updated:`, (user as { email: string; name: string }).email, '—', (user as { email: string; name: string }).name);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
