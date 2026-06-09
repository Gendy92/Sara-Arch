-- Migration v109: project_tasks + tax columns + indexes
-- Run this in Supabase SQL Editor

-- ─── TAX COLUMNS ───
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 14;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 14;
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

-- Backfill existing rows with default tax
UPDATE transactions SET tax_rate = 14, tax_amount = 0 WHERE tax_rate IS NULL;
UPDATE procurements SET tax_rate = 14, tax_amount = 0 WHERE tax_rate IS NULL;

-- ─── PROJECT TASKS TABLE ───
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  assignee TEXT,
  start_date DATE,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Constraints
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_status_check CHECK (status IN ('pending','in_progress','done'));
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_priority_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_priority_check CHECK (priority IN ('low','medium','high'));

-- RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON project_tasks;
CREATE POLICY "authenticated_all" ON project_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project_type ON transactions(project_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_procurements_vendor ON procurements(vendor_id);
