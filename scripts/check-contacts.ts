import { prisma } from "../src/lib/prisma";

async function main() {
  const contacts = await prisma.contact.findMany({
    take: 5,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      source: true,
      subscribedAt: true,
      unsubscribedAt: true,
      archivedAt: true,
      bouncedAt: true,
      complainedAt: true,
    },
  });

  console.log(contacts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
