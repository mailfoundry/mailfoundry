import type { Prisma } from "../generated/prisma/client";

// ── Segment filters (shared by the Segments page and "Save as list") ─────────

export type FilterParams = {
  status?:      string; // subscribed | unsubscribed | bounced | complained | archived | any
  country?:     string; // gb | non-gb | any
  list?:        string; // listId
  source?:      string; // substring match on Contact.source
  activity?:    string; // engagement across ALL campaigns — see ACTIVITY_OPTIONS
  campaign?:    string; // campaignId
  engagement?:  string; // sent | opened | clicked | failed | not_sent (for the selected campaign)
  urlContains?: string; // substring match on click URL
};

export const ACTIVITY_OPTIONS: { value: string; label: string }[] = [
  { value: "any",           label: "Any" },
  { value: "opened_30",     label: "Opened in last 30 days" },
  { value: "opened_90",     label: "Opened in last 90 days" },
  { value: "opened_180",    label: "Opened in last 180 days" },
  { value: "clicked_90",    label: "Clicked in last 90 days" },
  { value: "clicked_180",   label: "Clicked in last 180 days" },
  { value: "never_engaged", label: "Never engaged (sent, no opens/clicks)" },
  { value: "never_sent",    label: "Never emailed by MailFoundry" },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Contacts that may legally/safely receive marketing right now (matches the send routes). */
export const ELIGIBLE_WHERE: Prisma.ContactWhereInput = {
  subscribedAt: { not: null },
  unsubscribedAt: null,
  archivedAt: null,
  bouncedAt: null,
  complainedAt: null,
};

export function buildContactWhere(f: FilterParams): Prisma.ContactWhereInput {
  // AND-list so several relation filters (list, activity, campaign) can combine safely
  const and: Prisma.ContactWhereInput[] = [];

  // Status
  if (f.status === "subscribed")   and.push(ELIGIBLE_WHERE);
  if (f.status === "unsubscribed") and.push({ unsubscribedAt: { not: null } });
  if (f.status === "bounced")      and.push({ bouncedAt: { not: null } });
  if (f.status === "complained")   and.push({ complainedAt: { not: null } });
  if (f.status === "archived")     and.push({ archivedAt: { not: null } });

  // Country
  if (f.country === "gb")     and.push({ country: "GB" });
  if (f.country === "non-gb") and.push({ country: { not: "GB" } });

  // List membership
  if (f.list) and.push({ lists: { some: { listId: f.list } } });

  // Import source
  if (f.source) and.push({ source: { contains: f.source, mode: "insensitive" } });

  // Engagement across all campaigns
  const a = f.activity ?? "any";
  const opened = a.match(/^opened_(\d+)$/);
  const clicked = a.match(/^clicked_(\d+)$/);
  if (opened) {
    and.push({ campaignSends: { some: { openedAt: { gte: daysAgo(Number(opened[1])) } } } });
  } else if (clicked) {
    and.push({ campaignSends: { some: { clicks: { some: { clickedAt: { gte: daysAgo(Number(clicked[1])) } } } } } });
  } else if (a === "never_engaged") {
    and.push({ campaignSends: { some: { status: "sent" } } });
    and.push({ campaignSends: { none: { openedAt: { not: null } } } });
    and.push({ campaignSends: { none: { clicks: { some: {} } } } });
  } else if (a === "never_sent") {
    and.push({ campaignSends: { none: { status: "sent" } } });
  }

  // Per-campaign engagement
  if (f.campaign && f.engagement && f.engagement !== "any") {
    const campaignId = f.campaign;
    if (f.engagement === "not_sent") {
      and.push({ campaignSends: { none: { campaignId } } });
    } else if (f.engagement === "sent") {
      and.push({ campaignSends: { some: { campaignId, status: "sent" } } });
    } else if (f.engagement === "opened") {
      and.push({ campaignSends: { some: { campaignId, openedAt: { not: null } } } });
    } else if (f.engagement === "clicked") {
      and.push({
        campaignSends: {
          some: {
            campaignId,
            clicks: { some: f.urlContains ? { url: { contains: f.urlContains, mode: "insensitive" } } : {} },
          },
        },
      });
    } else if (f.engagement === "failed") {
      and.push({ campaignSends: { some: { campaignId, status: { startsWith: "skipped" } } } });
    }
  } else if (f.urlContains) {
    and.push({ campaignSends: { some: { clicks: { some: { url: { contains: f.urlContains, mode: "insensitive" } } } } } });
  }

  return and.length ? { AND: and } : {};
}

export function readFilterParams(src: Record<string, string | undefined>): FilterParams {
  return {
    status:      src.status      || "any",
    country:     src.country     || "any",
    list:        src.list        || "",
    source:      (src.source     || "").trim(),
    activity:    src.activity    || "any",
    campaign:    src.campaign    || "",
    engagement:  src.engagement  || "any",
    urlContains: (src.urlContains || "").trim(),
  };
}

export function hasAnyFilter(f: FilterParams): boolean {
  return (
    f.status !== "any" || f.country !== "any" || !!f.list || !!f.source ||
    f.activity !== "any" || !!f.campaign || !!f.urlContains
  );
}
