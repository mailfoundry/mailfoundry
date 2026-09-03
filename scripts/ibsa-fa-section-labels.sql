-- IBSA First Aid — apply sectionLabel to all FA products
-- Run this in Neon SQL editor. Safe to re-run (idempotent).

-- FIRST AID KITS & RECORDS
UPDATE "IbsaProduct" SET "sectionLabel" = 'FIRST AID KITS & RECORDS'
WHERE type = 'FA' AND (
  name ILIKE '%Accident Record Book%' OR
  name ILIKE '%First Aid Kit%'
);

-- WOUND CARE
UPDATE "IbsaProduct" SET "sectionLabel" = 'WOUND CARE'
WHERE type = 'FA' AND (
  name ILIKE '%Plaster%' OR
  name ILIKE '%Bandage%' OR
  name ILIKE '%EAB%'
);

-- HYGIENE & DISINFECTION
UPDATE "IbsaProduct" SET "sectionLabel" = 'HYGIENE & DISINFECTION'
WHERE type = 'FA' AND (
  name ILIKE '%Alcohol Wipe%' OR
  name ILIKE '%Medipal%' OR
  name ILIKE '%Disinfectant%'
);

-- EYE CARE
UPDATE "IbsaProduct" SET "sectionLabel" = 'EYE CARE'
WHERE type = 'FA' AND (
  name ILIKE '%Eye Wash%' OR
  name ILIKE '%Aura3%' OR
  name ILIKE '%Eye Wash Station%'
);

-- PPE
UPDATE "IbsaProduct" SET "sectionLabel" = 'PPE'
WHERE type = 'FA' AND (
  name ILIKE '%Glove%' OR
  name ILIKE '%Apron%' OR
  name ILIKE '%Face Mask%' OR
  name ILIKE '%High Visibility Vest%' OR
  name ILIKE '%Hi-Vis%' OR
  name ILIKE '%Hi Vis%'
);

-- SHARPS & CLINICAL WASTE
UPDATE "IbsaProduct" SET "sectionLabel" = 'SHARPS & CLINICAL WASTE'
WHERE type = 'FA' AND (
  name ILIKE '%Sharps%' OR
  name ILIKE '%Vomit Bag%' OR
  name ILIKE '%Emesis%'
);

-- SPILL MANAGEMENT
UPDATE "IbsaProduct" SET "sectionLabel" = 'SPILL MANAGEMENT'
WHERE type = 'FA' AND (
  name ILIKE '%Spill Kit%' OR
  name ILIKE '%Spill Pad%' OR
  name ILIKE '%Bio Hazard%' OR
  name ILIKE '%Biohazard%'
);

-- WELFARE & EQUIPMENT
UPDATE "IbsaProduct" SET "sectionLabel" = 'WELFARE & EQUIPMENT'
WHERE type = 'FA' AND (
  name ILIKE '%Portable Bed%' OR
  name ILIKE '%Wheelchair%' OR
  name ILIKE '%Screen Divider%' OR
  name ILIKE '%Roller Banner%' OR
  name ILIKE '%Couch Roll%' OR
  name ILIKE '%Pillow Case%' OR
  name ILIKE '%Koolpak%' OR
  name ILIKE '%Hot%Cold%' OR
  name ILIKE '%Scissors%' OR
  name ILIKE '%Feminine%' OR
  name ILIKE '%Bodyform%'
);

-- PAPER & CONSUMABLES
UPDATE "IbsaProduct" SET "sectionLabel" = 'PAPER & CONSUMABLES'
WHERE type = 'FA' AND (
  name ILIKE '%Centre Feed%' OR
  name ILIKE '%Tissue%' OR
  name ILIKE '%Tiboo%'
);

-- SAFETY SIGNAGE
UPDATE "IbsaProduct" SET "sectionLabel" = 'SAFETY SIGNAGE'
WHERE type = 'FA' AND (
  name ILIKE '%Wet Floor%' OR
  name ILIKE '%Caution Wet%'
);

-- Verify — check anything left unlabelled
SELECT name, variant, "sectionLabel"
FROM "IbsaProduct"
WHERE type = 'FA' AND "sectionLabel" IS NULL
ORDER BY name;