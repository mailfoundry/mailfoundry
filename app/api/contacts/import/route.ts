import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const maxDuration = 300;

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

    // ── Validate + de-duplicate within the file ───────────────────────────────
    const valid = new Map<string, ImportRow>();
    for (const row of rows) {
      if (!row.email || !emailRegex.test(row.email)) {
        results.push({ email: row.email || "(empty)", status: "skipped", reason: "Invalid email" });
        continue;
      }
      if (valid.has(row.email)) {
        results.push({ email: row.email, status: "skipped", reason: "Duplicate in file" });
        continue;
      }
      valid.set(row.email, row);
    }
    const emails = [...valid.keys()];

    // ── Batched writes (a handful of queries per 1,000 rows, not 3 per row) ─────
    const BATCH = 1000;
    for (let i = 0; i < emails.length; i += BATCH) {
      const chunk = emails.slice(i, i + BATCH);
      const existing = await prisma.contact.findMany({
        where: { email: { in: chunk } },
        select: { id: true, email: true, firstName: true, lastName: true, subscribedAt: true },
      });
      const existingByEmail = new Map(existing.map((c) => [c.email, c]));

      // New contacts
      const toCreate = chunk.filter((e) => !existingByEmail.has(e));
      if (toCreate.length) {
        const now = new Date();
        await prisma.contact.createMany({
          data: toCreate.map((e) => {
            const r = valid.get(e)!;
            return {
              email: e,
              firstName: r.firstName || null,
              lastName: r.lastName || null,
              source: r.source || "csv_import",
              subscribedAt: markSubscribed ? now : null,
            };
          }),
          skipDuplicates: true,
        });
      }

      // Existing contacts: mark subscribed only if never subscribed (never touches unsubscribed/bounced),
      // and fill blank names. Source is left unchanged to preserve where they originally came from.
      if (markSubscribed) {
        await prisma.contact.updateMany({
          where: { email: { in: chunk.filter((e) => existingByEmail.has(e)) }, subscribedAt: null },
          data: { subscribedAt: new Date() },
        });
      }
      for (const c of existing) {
        const r = valid.get(c.email)!;
        const firstName = !c.firstName && r.firstName ? r.firstName : undefined;
        const lastName = !c.lastName && r.lastName ? r.lastName : undefined;
        if (firstName || lastName) {
          await prisma.contact.update({ where: { id: c.id }, data: { firstName, lastName } });
        }
      }

      // List membership
      if (listId) {
        const ids = await prisma.contact.findMany({ where: { email: { in: chunk } }, select: { id: true } });
        await prisma.contactList.createMany({
          data: ids.map((c) => ({ contactId: c.id, listId })),
          skipDuplicates: true,
        });
      }

      for (const e of chunk) {
        results.push({ email: e, status: existingByEmail.has(e) ? "updated" : "created" });
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
