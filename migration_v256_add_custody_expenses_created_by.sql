-- v256: Add missing audit columns to custody_expenses
-- The app sends created_by/updated_by on insert/update and a trigger expects it.

ALTER TABLE custody_expenses ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE custody_expenses ADD COLUMN IF NOT EXISTS updated_by UUID;
