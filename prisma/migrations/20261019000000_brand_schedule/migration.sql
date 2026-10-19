-- Six-day calendar (19 Oct 2026): SCS Mon/Wed/Fri 09:30 (window 09:00–11:00), SWF Tue/Thu/Sat 08:15 (window 08:00–10:00).
-- Adds one-off schedule exceptions, test-before-approval tracking, SWF 1 campaign/week + engaged-list-only.
-- Does NOT schedule, approve or send anything. Brand status (Go/Hold/Stop) is not changed.

ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "preferredTimes" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "maxCampaignsPerWeek" INTEGER;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "requiredListId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "testSentAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "testFingerprint" TEXT;

CREATE TABLE IF NOT EXISTS "ScheduleException" (
  "id"         TEXT NOT NULL,
  "brandKey"   TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "date"       TEXT NOT NULL,
  "startTime"  TEXT NOT NULL,
  "endTime"    TEXT NOT NULL,
  "reason"     TEXT NOT NULL,
  "createdBy"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleException_brandKey_fkey" FOREIGN KEY ("brandKey") REFERENCES "Brand"("key") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ScheduleException_campaignId_idx" ON "ScheduleException"("campaignId");

-- Brand timetable
UPDATE "Brand" SET "sendDays" = '1,3,5', "sendWindowStart" = '09:00', "sendWindowEnd" = '11:00',
  "preferredTimes" = '1=09:30,3=09:30,5=09:30', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'scs';
UPDATE "Brand" SET "sendDays" = '2,4,6', "sendWindowStart" = '08:00', "sendWindowEnd" = '10:00',
  "preferredTimes" = '2=08:15,4=08:15,6=08:15', "maxCampaignsPerWeek" = 1,
  "requiredListId" = (SELECT "id" FROM "List" WHERE "brandKey" = 'swf' AND "name" = 'SWF Engaged' ORDER BY "createdAt" LIMIT 1),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'swf';

-- Existing drafts: move planned times (UK → UTC: BST until 25 Oct). Unsent drafts only; never sets "scheduled".
CREATE TEMP TABLE _moves AS
SELECT c."id", t."at", t."label" FROM "Campaign" c
JOIN (VALUES
  ('scs', 'A', 'ubik',           TIMESTAMP '2026-10-19 13:00:00', 'Ubik 2000 · Mon 19 Oct 14:00 (exception)'),
  ('scs', 'B', 'vanquish',       TIMESTAMP '2026-10-21 08:30:00', 'Vanquish · Wed 21 Oct 09:30'),
  ('scs', 'C', 'fresh quarters', TIMESTAMP '2026-10-23 08:30:00', 'Fresh Quarters · Fri 23 Oct 09:30')
) AS t("brand", "cohort", "kw", "at", "label")
  ON c."brandKey" = t."brand" AND c."cohort" = t."cohort"
 AND (lower(c."name") LIKE '%' || t."kw" || '%' OR lower(c."subject") LIKE '%' || t."kw" || '%' OR lower(coalesce(c."conceptNotes", '')) LIKE '%' || t."kw" || '%')
WHERE c."status" IN ('draft', 'blocked')
UNION ALL
SELECT c."id", TIMESTAMP '2026-10-20 07:15:00', 'SWF Firewood readiness · Tue 20 Oct 08:15' FROM "Campaign" c
WHERE c."brandKey" = 'swf' AND c."status" IN ('draft', 'blocked') AND c."plannedSendAt" >= TIMESTAMP '2026-10-19 00:00:00' AND c."plannedSendAt" < TIMESTAMP '2026-10-21 00:00:00';

UPDATE "Campaign" c SET "plannedSendAt" = m."at", "status" = 'draft', "scheduledAt" = NULL, "blockedReason" = NULL, "updatedAt" = CURRENT_TIMESTAMP
FROM _moves m WHERE c."id" = m."id";
-- The send time is part of final approval: revoke any final approvals on moved campaigns
UPDATE "CampaignApproval" SET "revokedAt" = CURRENT_TIMESTAMP, "revokedReason" = 'send time moved to new brand calendar'
WHERE "kind" = 'final' AND "revokedAt" IS NULL AND "campaignId" IN (SELECT "id" FROM _moves);
INSERT INTO "AuditLog" ("id", "actor", "action", "campaignId", "detail")
SELECT 'mig' || md5(m."id" || 'brand_schedule'), 'system:migration', 'planned_time_moved', m."id", jsonb_build_object('to', m."label")
FROM _moves m ON CONFLICT DO NOTHING;

-- One-off exception: SCS Ubik 2000 (group A) at 14:00 UK on Mon 19 Oct 2026 only
INSERT INTO "ScheduleException" ("id", "brandKey", "campaignId", "date", "startTime", "endTime", "reason", "createdBy")
SELECT 'exc' || md5(m."id" || '2026-10-19'), 'scs', m."id", '2026-10-19', '14:00', '14:00', 'Jason: one-off Monday afternoon send (morning window missed)', 'jason'
FROM _moves m WHERE m."label" LIKE 'Ubik%'
ON CONFLICT DO NOTHING;

-- Check: brands, and every moved campaign (expect 4 rows: 3 SCS + 1 SWF)
SELECT "key", "sendDays", "sendWindowStart", "sendWindowEnd", "preferredTimes", "maxCampaignsPerWeek", ("requiredListId" IS NOT NULL) AS "engagedOnly", "status" FROM "Brand" ORDER BY "key";
SELECT m."label", c."name", c."status", c."plannedSendAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London' AS "uk_time", c."cohort",
  (SELECT count(*) FROM "ScheduleException" e WHERE e."campaignId" = c."id") AS "exceptions"
FROM _moves m JOIN "Campaign" c ON c."id" = m."id" ORDER BY m."at";
