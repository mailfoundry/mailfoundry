-- Label the 3 remaining unlabelled FA products, then rerun sort order

UPDATE "IbsaProduct" SET "sectionLabel" = 'WOUND CARE'
WHERE type = 'FA' AND name ILIKE '%Alginate%';

UPDATE "IbsaProduct" SET "sectionLabel" = 'WELFARE & EQUIPMENT'
WHERE type = 'FA' AND name ILIKE '%Travel Bed%';

UPDATE "IbsaProduct" SET "sectionLabel" = 'WELFARE & EQUIPMENT'
WHERE type = 'FA' AND name ILIKE '%Roller Divide%';

-- Rerun sort order so new labels land in the right position
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
      ORDER BY name, variant NULLS LAST
    ) AS new_sort
  FROM "IbsaProduct"
  WHERE type = 'FA'
)
UPDATE "IbsaProduct" p
SET "sortOrder" = r.new_sort
FROM ranked r
WHERE p.id = r.id;

-- Confirm nothing left unlabelled
SELECT name, variant FROM "IbsaProduct"
WHERE type = 'FA' AND "sectionLabel" IS NULL
ORDER BY name;