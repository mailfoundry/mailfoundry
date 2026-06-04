import { prisma } from "../src/lib/prisma";

const email = "unknown-test@example.com";

async function main() {
  const list = await prisma.list.findFirst({
    where: {
      name: "Internal Test List",
    },
  });

  if (!list) {
    throw new Error("Internal Test List not found.");
  }

  const contact = await prisma.contact.upsert({
    where: {
      email,
    },
    update: {
      firstName: "Unknown",
      lastName: "Test",
      source: "unknown_test",
      subscribedAt: null,
      unsubscribedAt: null,
      archivedAt: null,
    },
    create: {
      email,
      firstName: "Unknown",
      lastName: "Test",
      source: "unknown_test",
      subscribedAt: null,
      unsubscribedAt: null,
      archivedAt: null,
    },
  });

  await prisma.contactList.upsert({
    where: {
      contactId_listId: {
        contactId: contact.id,
        listId: list.id,
      },
    },
    update: {},
    create: {
      contactId: contact.id,
      listId: list.id,
    },
  });

  console.log("Created/updated unknown test contact:");
  console.log({
    email: contact.email,
    subscribedAt: contact.subscribedAt,
    unsubscribedAt: contact.unsubscribedAt,
    archivedAt: contact.archivedAt,
    source: contact.source,
    list: list.name,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
