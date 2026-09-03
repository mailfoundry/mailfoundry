-- Fix FA product section labels and sort order
-- Run in Neon SQL editor. Safe to re-run.

-- Step 1: Label the two unlabelled strays
UPDATE "IbsaProduct"
SET "sectionLabel" = 'HYGIENE & DISINFECTION'
WHERE type = 'FA' AND name ILIKE '%Chlorhexidine%';

UPDATE "IbsaProduct"
SET "sectionLabel" = 'WOUND CARE'
WHERE type = 'FA' AND name ILIKE '%Foil Blanket%';

-- Step 2: Reassign sortOrder so all same-section products are consecutive.
-- Sections are ordered logically; products within each section sort by name/variant.
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

-- Verify: each section should appear as one contiguous block
SELECT "sectionLabel", COUNT(*) AS products, MIN("sortOrder") AS first, MAX("sortOrder") AS last
FROM "IbsaProduct"
WHERE type = 'FA'
GROUP BY "sectionLabel"
ORDER BY first;
