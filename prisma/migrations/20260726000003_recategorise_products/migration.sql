-- Recategorise products: split Safety & PPE into Gloves, Hi Vis; split Janitorial into Brushes, Mops

-- Gloves (CS and FA)
UPDATE "IbsaProduct"
SET "category" = 'gloves'
WHERE "name" ILIKE '%glove%'
   OR "code" ILIKE '%glove%';

-- Hi Vis
UPDATE "IbsaProduct"
SET "category" = 'hivis'
WHERE "name" ILIKE '%hi vis%'
   OR "name" ILIKE '%high vis%'
   OR "name" ILIKE '%hi-vis%'
   OR "code" ILIKE '%hi_vis%'
   OR "code" ILIKE '%hivis%';

-- Brushes (from janitorial — includes brooms, dustpan sets, lobby brushes)
UPDATE "IbsaProduct"
SET "category" = 'brushes'
WHERE ("name" ILIKE '%brush%' OR "name" ILIKE '%broom%'
    OR "code" ILIKE '%brush%' OR "code" ILIKE '%broom%');

-- Mops (from janitorial)
UPDATE "IbsaProduct"
SET "category" = 'mops'
WHERE ("name" ILIKE '%mop%'
    OR "code" ILIKE '%mop%');
