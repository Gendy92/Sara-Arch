-- Migration v130: Add missing columns to transactions table
-- Run this in Supabase SQL Editor

-- Work sections/items columns (missing from original schema)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS section_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS section_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_name TEXT;

-- Also ensure these exist (from schema.sql but may be missing in some DBs)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_category TEXT DEFAULT 'construction';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_term TEXT DEFAULT 'immediate';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS party_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS party_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS party_type TEXT;

-- Add constraint check for expense_category
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_expense_category_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_expense_category_check CHECK (expense_category IN ('construction','design'));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
