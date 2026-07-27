-- Reset all non-archived, non-complete conventions back to pending
-- None of the outstanding conventions have been ordered yet
UPDATE "IbsaConvention"
SET "status" = 'pending'
WHERE "status" = 'ordered'
  AND "archivedAt" IS NULL;
