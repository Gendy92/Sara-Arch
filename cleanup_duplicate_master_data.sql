-- ============================================
-- Cleanup Duplicate Master Data
-- Keeps ONE record per duplicate group (oldest created_at, or smallest UUID as tiebreaker)
-- ============================================

-- 1) SECTORS (التصنيفات)
UPDATE sectors
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT DISTINCT ON (LOWER(TRIM(name))) id
      FROM sectors
      WHERE deleted_at IS NULL
      ORDER BY LOWER(TRIM(name)), created_at ASC NULLS FIRST, id::text ASC
    ) sub
  );

-- 2) WORK_SECTIONS (أقسام المشاريع)
UPDATE work_sections
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT DISTINCT ON (LOWER(TRIM(name))) id
      FROM work_sections
      WHERE deleted_at IS NULL
      ORDER BY LOWER(TRIM(name)), created_at ASC NULLS FIRST, id::text ASC
    ) sub
  );

-- 3) WORK_ITEMS (بنود الأعمال) — by name + section_id
UPDATE work_items
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT DISTINCT ON (LOWER(TRIM(name)), section_id) id
      FROM work_items
      WHERE deleted_at IS NULL
      ORDER BY LOWER(TRIM(name)), section_id, created_at ASC NULLS FIRST, id::text ASC
    ) sub
  );

-- 4) ITEMS (الأصناف)
UPDATE items
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT DISTINCT ON (LOWER(TRIM(name))) id
      FROM items
      WHERE deleted_at IS NULL
      ORDER BY LOWER(TRIM(name)), created_at ASC NULLS FIRST, id::text ASC
    ) sub
  );
