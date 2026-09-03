-- Fix FA sort order — preserves your existing drag-and-drop order within each section.
-- Run this in Neon. Safe to re-run.

-- Label any remaining stragglers first
UPDATE "IbsaProduct" SET "sectionLabel" = 'WOUND CARE'
WHERE type = 'FA' AND name ILIKE '%Alginate%';

UPDATE "IbsaProduct" SET "sectionLabel" = 'WELFARE & EQUIPMENT'
WHERE type = 'FA' AND name ILIKE '%Travel Bed%';

UPDATE "IbsaProduct" SET "sectionLabel" = 'WELFARE & EQUIPMENT'
WHERE type = 'FA' AND name ILIKE '%Roller Divide%';

-- Reassign sortOrder: sections in logical sequence, but ORDER BY existing sortOrder
-- within each section so your admin drag-and-drop order is preserved.
WITH ranked AS (
  SELECT
    id,
    CASE "sectionLabel"
      WHEN 'FIRST AID KITS & RECORDS' THEN 100
      WHEN 'HYGIENE & DISINFECTION'   THEN 200
      WHEN 'WOUND CARE'               THEN 300
      WHEN 'EYE CARE'                 THEN 400
      WHEN 'PPE'                      THEN 500
      WHEN 'SHARPS & CLINICAL WASTE'  THEN 600
      WHEN 'SPILL MANAGEMENT'         THEN 700
      WHEN 'WELFARE & EQUIPMENT'      THEN 800
      WHEN 'PAPER & CONSUMABLES'      THEN 900
      WHEN 'SAFETY SIGNAGE'           THEN 1000
      ELSE 1100
    END + ROW_NUMBER() OVER (
      PARTITION BY "sectionLabel"
      ORDER BY "sortOrder"   -- preserves your existing order within each section
    ) AS new_sort
  FROM "IbsaProduct"
  WHERE type = 'FA'
)
UPDATE "IbsaProduct" p
SET "sortOrder" = r.new_sort
FROM ranked r
WHERE p.id = r.id;

-- Verify: no unlabelled products
SELECT name, variant FROM "IbsaProduct"
WHERE type = 'FA' AND "sectionLabel" IS NULL
ORDER BY name;
