import { prisma } from "../src/lib/prisma";

async function main() {
  const testEmail = "ridgejason@me.com";

  let list = await prisma.list.findFirst({
    where: {
      name: "Internal Test List",
    },
  });

  if (!list) {
    list = await prisma.list.create({
      data: {
        name: "Internal Test List",
      },
    });
  }

  const contact = await prisma.contact.upsert({
    where: {
      email: testEmail,
    },
    update: {
      firstName: "Jason",
      lastName: "Ridge",
    },
    create: {
      email: testEmail,
      firstName: "Jason",
      lastName: "Ridge",
    },
  });

  const existingContactList = await prisma.contactList.findFirst({
    where: {
      contactId: contact.id,
      listId: list.id,
    },
  });

  if (!existingContactList) {
    await prisma.contactList.create({
      data: {
        contactId: contact.id,
        listId: list.id,
      },
    });
  }

  console.log("✅ Internal Test List ready");
  console.log({
    list,
    contact,
  });
}

main()
  .catch((error) => {
    console.error("❌ Failed to create Internal Test List");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });