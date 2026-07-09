/**
 * Populate/update IBSA conventions from the Regional Convention Order Form.
 * Run:  export $(grep DATABASE_URL .env | tr -d '"') && npx tsx scripts/update-ibsa-conventions.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never) as unknown as {
  ibsaConvention: {
    findFirst: (args: unknown) => Promise<{ id: string; name: string } | null>;
    update: (args: unknown) => Promise<{ id: string; name: string }>;
    create: (args: unknown) => Promise<{ id: string; name: string }>;
  };
  $disconnect: () => Promise<void>;
};

const conventions = [
  {
    searchTerms: ["scotland", "aviemore"],
    name: "Scotland 01 - Aviemore",
    venue: "Aviemore Highland Resort",
    conventionDate: new Date("2026-04-18"),
    deliveryDate: new Date("2026-04-16"),
    contactName: "Samuel Flynn",
    contactEmail: "sf009@outlook.com",
    contactMobile: "07735 058263",
    deliveryAddress: "8 Enrick Crescent, Inverness, IV63 6TP",
  },
  {
    searchTerms: ["newcastle"],
    name: "Newcastle-upon-Tyne",
    venue: "Utilita Arena Newcastle",
    conventionDate: new Date("2026-06-26"),
    deliveryDate: new Date("2026-06-24"),
    contactName: "Ben Railton",
    contactEmail: "1BenRailton@jwpub.org",
    contactMobile: "07980 919279",
    deliveryAddress: null,
  },
  {
    searchTerms: ["exeter"],
    name: "Exeter A - Westpoint Arena",
    venue: "Westpoint Centre, Clyst St Mary, Exeter, EX5 1DJ",
    conventionDate: new Date("2026-07-03"),
    deliveryDate: new Date("2026-07-01"),
    contactName: "Dan Butler",
    contactEmail: "dblandscapes@live.co.uk",
    contactMobile: "07974 782856",
    deliveryAddress: "Westpoint Centre (Devon) Ltd, Clyst St Mary, Exeter, Devon, EX5 1DJ",
  },
  {
    searchTerms: ["leeds"],
    name: "Leeds - First Direct Arena",
    venue: "First Direct Arena Leeds",
    conventionDate: new Date("2026-07-03"),
    deliveryDate: new Date("2026-07-02"),
    contactName: "Simon Cowen",
    contactEmail: "simonrcowen@gmail.com",
    contactMobile: "07792 588546",
    deliveryAddress: null,
  },
  {
    searchTerms: ["dublin"],
    name: "Dublin",
    venue: "RDS Arena, Merrion Road, Dublin 4",
    conventionDate: new Date("2026-07-10"),
    deliveryDate: new Date("2026-07-08"),
    contactName: "Nigel Smith",
    contactEmail: "Talk2nigel@gmail.com",
    contactMobile: "(+353) 83 036 8599",
    deliveryAddress: "RDS Arena, Merrion Road, Dublin 4",
  },
  {
    searchTerms: ["milton keynes", "mk"],
    name: "Milton Keynes A",
    venue: "Stadium MK, Stadium Way West, Bletchley, MK1 1ST",
    conventionDate: new Date("2026-07-10"),
    deliveryDate: new Date("2026-07-07"),
    contactName: "Simon Truss",
    contactEmail: "sitruss1970@googlemail.com",
    contactMobile: "07702 861670",
    deliveryAddress: "Stadium MK, Stadium Way West, Bletchley, Milton Keynes, MK1 1ST",
  },
  {
    searchTerms: ["belfast"],
    name: "Belfast - Eikon",
    venue: "Eikon Exhibition Centre, Belfast",
    conventionDate: new Date("2026-07-31"),
    deliveryDate: new Date("2026-07-20"),
    contactName: "Dominic Hawkins",
    contactEmail: "dahawkins0@gmail.com",
    contactMobile: "07981 684058",
    deliveryAddress: null,
  },
  {
    searchTerms: ["manchester"],
    name: "Manchester",
    venue: null,
    conventionDate: new Date("2026-07-24"),
    deliveryDate: new Date("2026-07-22"),
    contactName: "Matthew Morales",
    contactEmail: "DMorales19@jwpub.org",
    contactMobile: "07531 175206",
    deliveryAddress: null,
  },
  {
    searchTerms: ["north london", "wembley", "twickenham"],
    // NOTE: North London only has FA tab; using FA coordinator contact
    name: "North London - Wembley",
    venue: "Wembley Arena, London",
    conventionDate: new Date("2026-07-17"),
    deliveryDate: new Date("2026-07-01"),
    contactName: "Carl Fisher",
    contactEmail: null,
    contactMobile: "07757 014757",
    deliveryAddress: null,
  },
  {
    searchTerms: ["liverpool"],
    name: "Liverpool",
    venue: null,
    conventionDate: new Date("2026-08-14"),
    deliveryDate: new Date("2026-08-13"),
    contactName: "Michael Moore",
    contactEmail: "mikeandveemoore@yahoo.co.uk",
    contactMobile: "07813 125230",
    deliveryAddress: null,
  },
  {
    searchTerms: ["norfolk", "norwich"],
    name: "Norfolk A - Norwich Showground",
    venue: "Norfolk Showground, Norwich",
    conventionDate: new Date("2026-08-07"),
    deliveryDate: new Date("2026-08-05"),
    contactName: "Jamie Whiteman",
    contactEmail: "jwhiteman66@aol.com",
    contactMobile: "07776 462895",
    deliveryAddress: null,
  },
  {
    searchTerms: ["twickenham", "london twickenham"],
    name: "Twickenham",
    venue: "Twickenham Stadium, London",
    conventionDate: new Date("2026-08-14"),
    deliveryDate: new Date("2026-08-12"),
    contactName: "Ray Haynes",
    contactEmail: "rayh.jrb@gmail.com",
    contactMobile: "07956 124666",
    deliveryAddress: null,
  },
  {
    searchTerms: ["bournemouth"],
    name: "Bournemouth",
    venue: null,
    conventionDate: new Date("2026-08-07"),
    deliveryDate: new Date("2026-08-05"),
    contactName: "David Ghent",
    contactEmail: "davidghent@me.com",
    contactMobile: "07943 867183",
    deliveryAddress: null,
  },
];

async function main() {
  console.log(`Processing ${conventions.length} conventions...\n`);

  // Fetch all existing conventions for matching
  const existing = await (prisma as unknown as {
    ibsaConvention: {
      findMany: () => Promise<{ id: string; name: string }[]>;
    };
  }).ibsaConvention.findMany();

  console.log(`Found ${existing.length} existing conventions in DB:\n  ${existing.map((c) => c.name).join("\n  ")}\n`);

  for (const conv of conventions) {
    // Find a match by checking if any existing name contains any of our search terms
    const match = existing.find((e) =>
      conv.searchTerms.some((term) =>
        e.name.toLowerCase().includes(term.toLowerCase())
      )
    );

    const payload = {
      name: conv.name,
      venue: conv.venue,
      conventionDate: conv.conventionDate,
      deliveryDate: conv.deliveryDate,
      contactName: conv.contactName,
      contactEmail: conv.contactEmail,
      contactMobile: conv.contactMobile,
      ...(conv.deliveryAddress ? { deliveryAddress: conv.deliveryAddress } : {}),
    };

    if (match) {
      await prisma.ibsaConvention.update({
        where: { id: match.id },
        data: payload,
      });
      console.log(`✓ Updated: ${match.name} → ${conv.name}`);
    } else {
      const created = await prisma.ibsaConvention.create({ data: { ...payload, status: "pending" } });
      console.log(`+ Created: ${created.name}`);
    }
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
