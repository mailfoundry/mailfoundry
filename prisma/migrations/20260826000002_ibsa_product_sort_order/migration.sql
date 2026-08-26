-- Add sortOrder column to IbsaProduct
ALTER TABLE "IbsaProduct" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Initialise existing products with their current alphabetical order (category then name),
-- spaced by 10 so there is room to insert between them later.
UPDATE "IbsaProduct" p
SET "sortOrder" = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY category, name)) * 10 AS rn
  FROM "IbsaProduct"
) sub
WHERE p.id = sub.id;
