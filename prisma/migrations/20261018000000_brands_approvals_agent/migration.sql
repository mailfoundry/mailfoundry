-- Brand rules, approvals, audit log and agent tokens (docs/CHATGPT_INTEGRATION.md 6A–6C).
-- Safe to run once; nothing changes for existing campaigns until a list is assigned to a brand.

CREATE TABLE IF NOT EXISTS "Brand" (
  "key"                    TEXT NOT NULL,
  "name"                   TEXT NOT NULL,
  "fromName"               TEXT NOT NULL,
  "fromEmail"              TEXT NOT NULL,
  "status"                 TEXT NOT NULL DEFAULT 'go',
  "statusReason"           TEXT,
  "statusSetBy"            TEXT,
  "statusSetAt"            TIMESTAMP(3),
  "postmasterSpamRate"     DOUBLE PRECISION,
  "postmasterUpdatedAt"    TIMESTAMP(3),
  "weeklyCapPerContact"    INTEGER NOT NULL DEFAULT 1,
  "maxAudiencePerSend"     INTEGER,
  "sendDays"               TEXT NOT NULL DEFAULT '2,3,4',
  "sendWindowStart"        TEXT NOT NULL DEFAULT '10:00',
  "sendWindowEnd"          TEXT NOT NULL DEFAULT '11:00',
  "agentSchedulingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("key")
);

-- Approved 18 Oct: SCS Tue/Wed/Thu 10:00, 1 email/contact/7 days, ramp cap 1,000 (week of 19 Oct).
-- SWF recovery: 1 email/contact/week to engaged list only, Tue/Thu window. Agent scheduling off for both until E2E passes.
INSERT INTO "Brand" ("key","name","fromName","fromEmail","status","weeklyCapPerContact","maxAudiencePerSend","sendDays","sendWindowStart","sendWindowEnd","agentSchedulingEnabled","updatedAt")
VALUES
  ('scs','Staffordshire Cleaning Supplies','Staffordshire Cleaning Supplies','info@staffordshirecleaningsupplies.co.uk','go',1,1000,'2,3,4','10:00','11:00',false,CURRENT_TIMESTAMP),
  ('swf','Staffordshire Wood Fuels','Staffordshire Wood Fuels','info@staffordshirewoodfuels.co.uk','go',1,NULL,'2,4','10:00','11:00',false,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
UPDATE "Brand" SET "statusReason" = 'Recovery: weekly to engaged contacts only (Postmaster ≥0.3% on 8 Oct)', "statusSetBy" = 'system', "statusSetAt" = CURRENT_TIMESTAMP
WHERE "key" = 'swf' AND "statusReason" IS NULL;

ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "brandKey" TEXT;
ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;
DO $$ BEGIN
  ALTER TABLE "List" ADD CONSTRAINT "List_brandKey_fkey" FOREIGN KEY ("brandKey") REFERENCES "Brand"("key") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "brandKey" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "cohort" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "conceptNotes" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "plannedSendAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "blockedReason" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
DO $$ BEGIN
  ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandKey_fkey" FOREIGN KEY ("brandKey") REFERENCES "Brand"("key") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CampaignApproval" (
  "id"            TEXT NOT NULL,
  "campaignId"    TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "fingerprint"   TEXT NOT NULL,
  "audienceSize"  INTEGER,
  "sendAt"        TIMESTAMP(3),
  "approvedBy"    TEXT NOT NULL,
  "approvedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"     TIMESTAMP(3),
  "revokedReason" TEXT,
  CONSTRAINT "CampaignApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignApproval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CampaignApproval_campaignId_idx" ON "CampaignApproval"("campaignId");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"         TEXT NOT NULL,
  "at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor"      TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "campaignId" TEXT,
  "brandKey"   TEXT,
  "detail"     JSONB,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_at_idx" ON "AuditLog"("at");
CREATE INDEX IF NOT EXISTS "AuditLog_campaignId_idx" ON "AuditLog"("campaignId");

CREATE TABLE IF NOT EXISTS "AgentToken" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL,
  "prefix"     TEXT NOT NULL,
  "createdBy"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt"  TIMESTAMP(3),
  CONSTRAINT "AgentToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentToken_tokenHash_key" ON "AgentToken"("tokenHash");

-- Check: should return 2 rows (scs, swf)
SELECT "key", "status", "fromEmail", "sendDays", "weeklyCapPerContact", "maxAudiencePerSend" FROM "Brand" ORDER BY "key";
