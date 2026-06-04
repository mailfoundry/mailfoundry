import { prisma } from "../src/lib/prisma";

async function main() {
  const sends = await prisma.campaignSend.findMany({
    orderBy: {
      sentAt: "desc",
    },
    take: 5,
  });

  console.log(sends);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
