import { prisma } from "../src/lib/prisma";

async function main() {
  const email = "ridgejason@me.com";

  const contact = await prisma.contact.update({
    where: {
      email,
    },
    data: {
      unsubscribedAt: null,
      subscribedAt: new Date(),
      source: "internal_test",
    },
    select: {
      email: true,
      subscribedAt: true,
      unsubscribedAt: true,
      source: true,
    },
  });

  console.log("✅ Contact resubscribed");
  console.log(contact);
}

main()
  .catch((error) => {
    console.error("❌ Failed to resubscribe contact");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
