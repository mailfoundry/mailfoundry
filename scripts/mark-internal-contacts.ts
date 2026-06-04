import { prisma } from "../src/lib/prisma";

const internalContacts = [
  {
    email: "ridgejason@me.com",
    firstName: "Jason",
    lastName: "Ridge",
  },
  {
    email: "abigail.ridge@gmail.com",
    firstName: "Abigail",
    lastName: "Ridge",
  },
];

async function main() {
  for (const contact of internalContacts) {
    const updatedContact = await prisma.contact.upsert({
      where: {
        email: contact.email,
      },
      update: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        source: "internal_test",
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
      create: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        source: "internal_test",
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        source: true,
        subscribedAt: true,
        unsubscribedAt: true,
      },
    });

    console.log("✅ Updated internal contact:", updatedContact);
  }
}

main()
  .catch((error) => {
    console.error("❌ Failed to update internal contacts");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
