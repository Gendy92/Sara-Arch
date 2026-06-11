-- ============================================
-- Cleanup Duplicate Master Data
-- Run this in Supabase SQL Editor
-- Keeps the OLDEST record, soft-deletes duplicates
-- ============================================

-- 1) SECTORS (التصنيفات) — deduplicate by name
WITH keepers AS (
  SELECT name, MIN(id) AS keep_id
  FROM sectors
  WHERE deleted_at IS NULL
  GROUP BY name
  HAVING COUNT(*) > 1
),
dupes AS (
  SELECT s.id, s.name, k.keep_id
  FROM sectors s
  JOIN keepers k ON LOWER(TRIM(s.name)) = LOWER(TRIM(k.name))
  WHERE s.id != k.keep_id AND s.deleted_at IS NULL
)
UPDATE sectors
SET deleted_at = NOW()
WHERE id IN (SELECT id FROM dupes);

-- Remap transactions that referenced deleted sectors to the kept one
-- (optional — uncomment if you want to auto-fix references)
-- UPDATE transactions t
-- SET sector_id = k.keep_id,
--     sector_name = (SELECT name FROM sectors WHERE id = k.keep_id)
-- FROM (
--   SELECT s.id AS dup_id, MIN(s2.id) OVER (PARTITION BY LOWER(TRIM(s.name))) AS keep_id
--   FROM sectors s
--   JOIN sectors s2 ON LOWER(TRIM(s.name)) = LOWER(TRIM(s2.name))
--   WHERE s.deleted_at IS NOT NULL
-- ) k
-- WHERE t.sector_id = k.dup_id;


-- 2) WORK_SECTIONS (أقسام المشاريع) — deduplicate by name
WITH keepers AS (
  SELECT name, MIN(id) AS keep_id
  FROM work_sections
  WHERE deleted_at IS NULL
  GROUP BY name
  HAVING COUNT(*) > 1
),
dupes AS (
  SELECT s.id, s.name, k.keep_id
  FROM work_sections s
  JOIN keepers k ON LOWER(TRIM(s.name)) = LOWER(TRIM(k.name))
  WHERE s.id != k.keep_id AND s.deleted_at IS NULL
)
UPDATE work_sections
SET deleted_at = NOW()
WHERE id IN (SELECT id FROM dupes);


-- 3) WORK_ITEMS (بنود الأعمال) — deduplicate by name + section_id
WITH keepers AS (
  SELECT name, section_id, MIN(id) AS keep_id
  FROM work_items
  WHERE deleted_at IS NULL
  GROUP BY name, section_id
  HAVING COUNT(*) > 1
),
dupes AS (
  SELECT i.id, i.name, i.section_id, k.keep_id
  FROM work_items i
  JOIN keepers k ON LOWER(TRIM(i.name)) = LOWER(TRIM(k.name)) AND i.section_id = k.section_id
  WHERE i.id != k.keep_id AND i.deleted_at IS NULL
)
UPDATE work_items
SET deleted_at = NOW()
WHERE id IN (SELECT id FROM dupes);


-- 4) ITEMS (الأصناف) — deduplicate by name
WITH keepers AS (
  SELECT name, MIN(id) AS keep_id
  FROM items
  WHERE deleted_at IS NULL
  GROUP BY name
  HAVING COUNT(*) > 1
),
dupes AS (
  SELECT i.id, i.name, k.keep_id
  FROM items i
  JOIN keepers k ON LOWER(TRIM(i.name)) = LOWER(TRIM(k.name))
  WHERE i.id != k.keep_id AND i.deleted_at IS NULL
)
UPDATE items
SET deleted_at = NOW()
WHERE id IN (SELECT id FROM dupes);


-- ============================================
-- Verification: run these SELECTs to see results
-- ============================================
-- SELECT name, COUNT(*) FROM sectors WHERE deleted_at IS NULL GROUP BY name HAVING COUNT(*) > 1;
-- SELECT name, COUNT(*) FROM work_sections WHERE deleted_at IS NULL GROUP BY name HAVING COUNT(*) > 1;
-- SELECT name, section_id, COUNT(*) FROM work_items WHERE deleted_at IS NULL GROUP BY name, section_id HAVING COUNT(*) > 1;
-- SELECT name, COUNT(*) FROM items WHERE deleted_at IS NULL GROUP BY name HAVING COUNT(*) > 1;
