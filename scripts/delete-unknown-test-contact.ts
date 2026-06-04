import { prisma } from "../src/lib/prisma";

const email = "unknown-test@example.com";

async function main() {
  const contact = await prisma.contact.findUnique({
    where: {
      email,
    },
    include: {
      lists: true,
      campaignSends: true,
    },
  });

  if (!contact) {
    console.log("No unknown test contact found. Nothing to clean up.");
    return;
  }

  await prisma.contactList.deleteMany({
    where: {
      contactId: contact.id,
    },
  });

  await prisma.campaignSend.updateMany({
    where: {
      contactId: contact.id,
    },
    data: {
      contactId: null,
    },
  });

  await prisma.contact.delete({
    where: {
      id: contact.id,
    },
  });

  console.log("Deleted unknown test contact:");
  console.log({
    email: contact.email,
    source: contact.source,
    removedListMemberships: contact.lists.length,
    detachedSendLogs: contact.campaignSends.length,
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
