-- ============================================
-- Cleanup Duplicate Master Data (Simple Version)
-- Run each UPDATE block separately in Supabase SQL Editor
-- Keeps the OLDEST record, soft-deletes duplicates
-- ============================================

-- 1) SECTORS (التصنيفات) — deduplicate by name
UPDATE sectors
SET deleted_at = NOW()
WHERE id IN (
  SELECT s.id
  FROM sectors s
  INNER JOIN (
    SELECT name, MIN(id) AS keep_id
    FROM sectors
    WHERE deleted_at IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  ) k ON LOWER(TRIM(s.name)) = LOWER(TRIM(k.name))
  WHERE s.id != k.keep_id AND s.deleted_at IS NULL
);

-- 2) WORK_SECTIONS (أقسام المشاريع) — deduplicate by name
UPDATE work_sections
SET deleted_at = NOW()
WHERE id IN (
  SELECT s.id
  FROM work_sections s
  INNER JOIN (
    SELECT name, MIN(id) AS keep_id
    FROM work_sections
    WHERE deleted_at IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  ) k ON LOWER(TRIM(s.name)) = LOWER(TRIM(k.name))
  WHERE s.id != k.keep_id AND s.deleted_at IS NULL
);

-- 3) WORK_ITEMS (بنود الأعمال) — deduplicate by name + section_id
UPDATE work_items
SET deleted_at = NOW()
WHERE id IN (
  SELECT i.id
  FROM work_items i
  INNER JOIN (
    SELECT name, section_id, MIN(id) AS keep_id
    FROM work_items
    WHERE deleted_at IS NULL
    GROUP BY name, section_id
    HAVING COUNT(*) > 1
  ) k ON LOWER(TRIM(i.name)) = LOWER(TRIM(k.name)) AND i.section_id = k.section_id
  WHERE i.id != k.keep_id AND i.deleted_at IS NULL
);

-- 4) ITEMS (الأصناف) — deduplicate by name
UPDATE items
SET deleted_at = NOW()
WHERE id IN (
  SELECT i.id
  FROM items i
  INNER JOIN (
    SELECT name, MIN(id) AS keep_id
    FROM items
    WHERE deleted_at IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  ) k ON LOWER(TRIM(i.name)) = LOWER(TRIM(k.name))
  WHERE i.id != k.keep_id AND i.deleted_at IS NULL
);
