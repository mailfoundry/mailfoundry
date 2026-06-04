import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Prisma keys:", Object.keys(prisma).sort());
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });