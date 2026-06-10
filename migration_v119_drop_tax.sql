-- Migration v119: Drop tax columns (tax removed from app)
-- Run this in Supabase SQL Editor

ALTER TABLE transactions DROP COLUMN IF EXISTS tax_rate;
ALTER TABLE transactions DROP COLUMN IF EXISTS tax_amount;
ALTER TABLE procurements DROP COLUMN IF EXISTS tax_rate;
ALTER TABLE procurements DROP COLUMN IF EXISTS tax_amount;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
