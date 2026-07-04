import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

type ImportRow = {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
};

type ImportResult = {
  email: string;
  status: "created" | "updated" | "skipped";
  reason?: string;
};

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Normalise header names to lowercase with no spaces
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));

  const emailIdx = headers.indexOf("email");
  if (emailIdx === -1) throw new Error('CSV must contain an "email" column.');

  const firstNameIdx = headers.indexOf("firstname");
  const lastNameIdx = headers.indexOf("lastname");
  const sourceIdx = headers.indexOf("source");

  return lines.slice(1).map((line) => {
    // Handle quoted fields that may contain commas
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    return {
      email: fields[emailIdx]?.toLowerCase().trim() ?? "",
      firstName: firstNameIdx >= 0 ? fields[firstNameIdx]?.trim() : undefined,
      lastName: lastNameIdx >= 0 ? fields[lastNameIdx]?.trim() : undefined,
      source: sourceIdx >= 0 ? fields[sourceIdx]?.trim() : undefined,
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { csv, listId, markSubscribed } = body as {
      csv: string;
      listId?: string;
      markSubscribed?: boolean;
    };

    if (!csv) {
      return NextResponse.json({ error: "No CSV data provided." }, { status: 400 });
    }

    let rows: ImportRow[];
    try {
      rows = parseCSV(csv);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to parse CSV." },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows found in CSV." }, { status: 400 });
    }

    // Validate list exists if provided
    if (listId) {
      const list = await prisma.list.findUnique({ where: { id: listId } });
      if (!list) {
        return NextResponse.json({ error: "List not found." }, { status: 404 });
      }
    }

    const results: ImportResult[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const row of rows) {
      if (!row.email || !emailRegex.test(row.email)) {
        results.push({ email: row.email || "(empty)", status: "skipped", reason: "Invalid email" });
        continue;
      }

      const existing = await prisma.contact.findUnique({ where: { email: row.email } });

      let contactId: string;

      if (existing) {
        // Update name/source only if the CSV provides them and they're currently blank
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            firstName: row.firstName || existing.firstName,
            lastName: row.lastName || existing.lastName,
            source: row.source || existing.source,
            ...(markSubscribed && !existing.subscribedAt
              ? { subscribedAt: new Date() }
              : {}),
          },
        });
        contactId = existing.id;
        results.push({ email: row.email, status: "updated" });
      } else {
        const contact = await prisma.contact.create({
          data: {
            email: row.email,
            firstName: row.firstName || null,
            lastName: row.lastName || null,
            source: row.source || "csv_import",
            subscribedAt: markSubscribed ? new Date() : null,
          },
        });
        contactId = contact.id;
        results.push({ email: row.email, status: "created" });
      }

      // Add to list if provided (skip if already a member)
      if (listId) {
        await prisma.contactList.upsert({
          where: { contactId_listId: { contactId, listId } },
          create: { contactId, listId },
          update: {},
        });
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const updated = results.filter((r) => r.status === "updated").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return NextResponse.json({ created, updated, skipped, total: rows.length, results });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}
