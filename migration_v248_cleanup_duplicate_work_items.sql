-- ============================================
-- v248: Cleanup Duplicate Work Items (بنود الأعمال)
-- Keeps ONE record per (tenant + section + normalized name).
-- Remaps transactions.item_id to the canonical item before soft-deleting duplicates.
-- Run this in the Supabase SQL Editor.
-- ============================================


-- 1) Build canonical map: oldest created_at wins, smallest UUID as tiebreaker.
WITH canonical AS (
  SELECT DISTINCT ON (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID), LOWER(TRIM(name)), section_id)
    id AS canonical_id,
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID) AS tenant_id,
    LOWER(TRIM(name)) AS item_name,
    section_id
  FROM work_items
  WHERE deleted_at IS NULL
  ORDER BY COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID), LOWER(TRIM(name)), section_id, created_at ASC NULLS FIRST, id::text ASC
),
duplicates AS (
  SELECT wi.id AS duplicate_id, c.canonical_id
  FROM work_items wi
  JOIN canonical c
    ON COALESCE(wi.tenant_id, '00000000-0000-0000-0000-000000000000'::UUID) = c.tenant_id
    AND LOWER(TRIM(wi.name)) = c.item_name
    AND wi.section_id = c.section_id
  WHERE wi.deleted_at IS NULL
    AND wi.id <> c.canonical_id
)
-- 2) Remap transactions that point to duplicate work_items.
UPDATE transactions t
SET item_id = d.canonical_id
FROM duplicates d
WHERE t.item_id = d.duplicate_id;

-- 3) Soft-delete duplicate work_items.
UPDATE work_items
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT DISTINCT ON (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID), LOWER(TRIM(name)), section_id) id
      FROM work_items
      WHERE deleted_at IS NULL
      ORDER BY COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID), LOWER(TRIM(name)), section_id, created_at ASC NULLS FIRST, id::text ASC
    ) sub
  );


-- 4) Prevent future active duplicates at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_unique_active
ON work_items (
  COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID),
  LOWER(TRIM(name)),
  section_id
)
WHERE deleted_at IS NULL;
