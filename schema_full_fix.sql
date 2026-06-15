-- ═══════════════════════════════════════════════════════════
-- Sara Arch — Complete Schema Fix & Migration Script
-- Run this ENTIRE file in Supabase SQL Editor
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 0: Fix existing data violations FIRST              │
-- └─────────────────────────────────────────────────────────┘

-- Drop constraints temporarily so we can fix bad data
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_expense_category_check;

-- Fix known invalid types
UPDATE transactions SET type = 'withdrawal' WHERE type = 'owner_withdrawal';
UPDATE transactions SET type = 'expense'     WHERE type = 'design';
UPDATE transactions SET type = 'expense'     WHERE type = 'bonus';
UPDATE transactions SET type = 'expense'     WHERE type = 'penalty';
UPDATE transactions SET type = 'expense'     WHERE type = 'advance';

-- Fix any other unknown/NULL types
UPDATE transactions 
SET type = 'expense' 
WHERE type NOT IN ('project_deposit','project_expense','office_expense','owner_deposit','income','expense','deposit','withdrawal','supervision')
   OR type IS NULL;

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 1: Extension                                       │
-- └─────────────────────────────────────────────────────────┘
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 2: Core Tables                                     │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  client_name TEXT,
  address TEXT,
  value NUMERIC DEFAULT 0,
  supervision_percentage NUMERIC DEFAULT 0,
  design_percentage NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','on_hold')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  job_title TEXT,
  salary NUMERIC DEFAULT 0,
  phone TEXT,
  email TEXT,
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  sector TEXT,
  vendor_type TEXT DEFAULT 'service',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  specification TEXT,
  brand TEXT,
  unit TEXT DEFAULT 'قطعة',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  client_id UUID REFERENCES clients(id),
  party_id UUID,
  party_name TEXT,
  party_type TEXT,
  project_id UUID REFERENCES projects(id),
  project_name TEXT,
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  sector_id UUID REFERENCES sectors(id),
  sector_name TEXT,
  vendor_id UUID REFERENCES vendors(id),
  vendor_name TEXT,
  payment_method TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS procurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  project_name TEXT,
  vendor_id UUID REFERENCES vendors(id),
  vendor_name TEXT,
  item_id UUID REFERENCES items(id),
  item_name TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  expense_type TEXT DEFAULT 'أخرى',
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS employee_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('advance','penalty','bonus','other')),
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS employee_salary_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  old_salary NUMERIC,
  new_salary NUMERIC,
  effective_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custody_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  client_id UUID REFERENCES clients(id),
  client_name TEXT,
  project_id UUID REFERENCES projects(id),
  project_name TEXT,
  amount NUMERIC DEFAULT 0,
  returned_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','settled','partial')),
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS custody_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  custody_id UUID REFERENCES custody_records(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  date DATE NOT NULL,
  status TEXT DEFAULT 'present' CHECK (status IN ('present','absent','late','half_day','leave')),
  check_in TIME,
  check_out TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  base_salary NUMERIC DEFAULT 0,
  days_present INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  days_late INTEGER DEFAULT 0,
  days_half INTEGER DEFAULT 0,
  days_leave INTEGER DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  bonuses NUMERIC DEFAULT 0,
  penalties NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(employee_id, month, year)
);

CREATE TABLE IF NOT EXISTS work_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES work_sections(id),
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'م²',
  price NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  screen TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_add BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_print BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, screen)
);

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 3: Columns Migration (ALTER TABLE)                 │
-- └─────────────────────────────────────────────────────────┘

-- Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS supervision_percentage NUMERIC DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_percentage NUMERIC DEFAULT 0;
DO $$ BEGIN ALTER TABLE projects ALTER COLUMN client_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- Vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_type TEXT DEFAULT 'service';

-- Transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS party_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS party_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS party_type TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sector_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_category TEXT DEFAULT 'construction';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES work_sections(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS section_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES work_items(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_term TEXT DEFAULT 'immediate';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- Procurements payment tracking
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS payment_term TEXT DEFAULT 'immediate';
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- Make nullable (for backward compatibility)
ALTER TABLE transactions ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN project_id DROP NOT NULL;

-- Custody
ALTER TABLE custody_records ADD COLUMN IF NOT EXISTS returned_amount NUMERIC DEFAULT 0;
ALTER TABLE custody_records ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id);
ALTER TABLE custody_records ADD COLUMN IF NOT EXISTS sector_name TEXT;
ALTER TABLE custody_records ADD COLUMN IF NOT EXISTS custody_type TEXT DEFAULT 'office' CHECK (custody_type IN ('office','project'));

-- Fix expense_category for existing rows (after column is created)
UPDATE transactions 
SET expense_category = 'construction' 
WHERE expense_category IS NULL 
   OR expense_category NOT IN ('construction','design');

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 4: Constraints                                     │
-- └─────────────────────────────────────────────────────────┘

-- Transactions type constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('project_deposit','project_expense','office_expense','owner_deposit','income','expense','deposit','withdrawal','supervision'));

-- Transactions expense_category constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_expense_category_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_expense_category_check CHECK (expense_category IN ('construction','design'));

-- Employee transactions type constraint
ALTER TABLE employee_transactions DROP CONSTRAINT IF EXISTS employee_transactions_type_check;
ALTER TABLE employee_transactions ADD CONSTRAINT employee_transactions_type_check CHECK (type IN ('advance','penalty','bonus','other'));

-- Custody status constraint
ALTER TABLE custody_records DROP CONSTRAINT IF EXISTS custody_records_status_check;
ALTER TABLE custody_records ADD CONSTRAINT custody_records_status_check CHECK (status IN ('active','settled','partial'));

-- Vendors vendor_type constraint
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_vendor_type_check;
ALTER TABLE vendors ADD CONSTRAINT vendors_vendor_type_check CHECK (vendor_type IN ('service','merchandise'));

-- Attendance status constraint
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_status_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_status_check CHECK (status IN ('present','absent','late','half_day','leave'));

-- Projects status constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('active','completed','cancelled','on_hold'));

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 5: Triggers (updated_at)                           │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_u ON clients; CREATE TRIGGER clients_u BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS projects_u ON projects; CREATE TRIGGER projects_u BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS employees_u ON employees; CREATE TRIGGER employees_u BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS vendors_u ON vendors; CREATE TRIGGER vendors_u BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS items_u ON items; CREATE TRIGGER items_u BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS sectors_u ON sectors; CREATE TRIGGER sectors_u BEFORE UPDATE ON sectors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS transactions_u ON transactions; CREATE TRIGGER transactions_u BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS procurements_u ON procurements; CREATE TRIGGER procurements_u BEFORE UPDATE ON procurements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS employee_transactions_u ON employee_transactions; CREATE TRIGGER employee_transactions_u BEFORE UPDATE ON employee_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS custody_records_u ON custody_records; CREATE TRIGGER custody_records_u BEFORE UPDATE ON custody_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS custody_expenses_u ON custody_expenses; CREATE TRIGGER custody_expenses_u BEFORE UPDATE ON custody_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS attendance_records_u ON attendance_records; CREATE TRIGGER attendance_records_u BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS payroll_records_u ON payroll_records; CREATE TRIGGER payroll_records_u BEFORE UPDATE ON payroll_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS work_sections_u ON work_sections; CREATE TRIGGER work_sections_u BEFORE UPDATE ON work_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS work_items_u ON work_items; CREATE TRIGGER work_items_u BEFORE UPDATE ON work_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS profiles_u ON profiles; CREATE TRIGGER profiles_u BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS user_permissions_u ON user_permissions; CREATE TRIGGER user_permissions_u BEFORE UPDATE ON user_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 5b: Audit Columns (created_by / updated_by)        │
-- └─────────────────────────────────────────────────────────┘

ALTER TABLE clients       ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE clients       ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE employees     ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE employees     ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE vendors       ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE vendors       ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE procurements  ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE procurements  ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE payroll_records     ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE payroll_records     ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE attendance_records  ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE attendance_records  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 6: Row Level Security (RLS)                        │
-- └─────────────────────────────────────────────────────────┘

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Open policies (adjust if you need stricter rules)
DROP POLICY IF EXISTS "authenticated_all" ON clients; CREATE POLICY "authenticated_all" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON projects; CREATE POLICY "authenticated_all" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON employees; CREATE POLICY "authenticated_all" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON vendors; CREATE POLICY "authenticated_all" ON vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON items; CREATE POLICY "authenticated_all" ON items FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON sectors; CREATE POLICY "authenticated_all" ON sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON transactions; CREATE POLICY "authenticated_all" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON procurements; CREATE POLICY "authenticated_all" ON procurements FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON employee_transactions; CREATE POLICY "authenticated_all" ON employee_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON employee_salary_history; CREATE POLICY "authenticated_all" ON employee_salary_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON custody_records; CREATE POLICY "authenticated_all" ON custody_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON custody_expenses; CREATE POLICY "authenticated_all" ON custody_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON attendance_records; CREATE POLICY "authenticated_all" ON attendance_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON payroll_records; CREATE POLICY "authenticated_all" ON payroll_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON work_sections; CREATE POLICY "authenticated_all" ON work_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON work_items; CREATE POLICY "authenticated_all" ON work_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON profiles; CREATE POLICY "authenticated_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON audit_logs; CREATE POLICY "authenticated_all" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_all" ON user_permissions; CREATE POLICY "authenticated_all" ON user_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Attendance & salary modules are disabled for now; drop any restrictive policies from previous runs
DROP POLICY IF EXISTS "auth_restricted_attendance_records" ON attendance_records;
DROP POLICY IF EXISTS "auth_admin_modify_attendance_records" ON attendance_records;
DROP POLICY IF EXISTS "auth_restricted_payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "auth_admin_modify_payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "auth_restricted_employee_salary_history" ON employee_salary_history;
DROP POLICY IF EXISTS "auth_admin_modify_employee_salary_history" ON employee_salary_history;

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 7: Seed Data                                       │
-- └─────────────────────────────────────────────────────────┘

INSERT INTO sectors (name, description) VALUES
  ('رواتب', 'مصروفات الرواتب الشهرية'),
  ('إيجارات', 'إيجارات المكاتب والمستودعات'),
  ('مرافق', 'كهرباء، مياه، إنترنت، تليفون'),
  ('صيانة', 'صيانة المعدات والأجهزة'),
  ('تسويق', 'إعلانات وتسويق'),
  ('نثرية', 'مصروفات نثرية ومتنوعة')
ON CONFLICT DO NOTHING;

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 8: Refresh PostgREST Schema Cache                  │
-- └─────────────────────────────────────────────────────────┘

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════
-- DONE! All tables, columns, constraints, and policies applied.
-- ═══════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 9: v106+ Migrations (Project Tasks)                │
-- └─────────────────────────────────────────────────────────┐

-- Project Tasks table
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  assignee TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Ensure project_tasks uses due_date (not end_date) to match application code
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS due_date DATE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'end_date'
  ) THEN
    UPDATE project_tasks SET due_date = end_date WHERE due_date IS NULL AND end_date IS NOT NULL;
    ALTER TABLE project_tasks DROP COLUMN IF EXISTS end_date;
  END IF;
END $$;

-- Constraints for project_tasks
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_status_check CHECK (status IN ('pending','in_progress','done'));

ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_priority_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_priority_check CHECK (priority IN ('low','medium','high'));

-- Trigger for project_tasks updated_at
DROP TRIGGER IF EXISTS project_tasks_u ON project_tasks;
CREATE TRIGGER project_tasks_u BEFORE UPDATE ON project_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for project_tasks
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON project_tasks;
CREATE POLICY "authenticated_all" ON project_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Missing columns required by application code
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE work_sections ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS section_name TEXT;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- Audit columns for tables that the app tries to write created_by/updated_by to
ALTER TABLE items ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE items ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE work_sections ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE work_sections ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE custody_records ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE custody_records ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project_type ON transactions(project_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_procurements_vendor ON procurements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

-- Admin check helper for RLS
CREATE OR REPLACE FUNCTION is_app_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_uuid AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply stricter RLS policies: admin full access; regular users can read all,
-- but can only modify rows they created. Tables without created_by keep open
-- SELECT and restrict modifications to admins.
DO $$
DECLARE
  tbl TEXT;
  has_created_by BOOLEAN;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'clients','projects','employees','vendors','items','sectors','transactions',
        'procurements','employee_transactions','custody_records',
        'custody_expenses','work_sections',
        'work_items','profiles','audit_logs','user_permissions','project_tasks'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_restricted_%1$s" ON %1$I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_admin_modify_%1$s" ON %1$I', tbl);

    -- Check if table has created_by column
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'created_by'
    ) INTO has_created_by;

    IF has_created_by THEN
      EXECUTE format(
        'CREATE POLICY "auth_restricted_%1$s" ON %1$I FOR ALL TO authenticated USING (is_app_admin(auth.uid()) OR created_by = auth.uid() OR created_by IS NULL) WITH CHECK (is_app_admin(auth.uid()) OR created_by = auth.uid())',
        tbl
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY "auth_restricted_%1$s" ON %1$I FOR SELECT TO authenticated USING (true)',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY "auth_admin_modify_%1$s" ON %1$I FOR ALL TO authenticated USING (is_app_admin(auth.uid())) WITH CHECK (is_app_admin(auth.uid()))',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- Special RLS for profiles: allow self-insert so registration works without a service key.
-- The auth.users trigger or application inserts a row with id = auth.uid().
DROP POLICY IF EXISTS "profiles_self_insert" ON profiles;
CREATE POLICY "profiles_self_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 10: Dashboard Aggregation RPCs                     │
-- └─────────────────────────────────────────────────────────┐

CREATE OR REPLACE FUNCTION dashboard_kpis()
RETURNS TABLE(
  client_count BIGINT,
  project_count BIGINT,
  active_project_count BIGINT,
  employee_count BIGINT,
  total_income NUMERIC,
  total_expense NUMERIC,
  total_movement NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) AS client_count,
    (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS project_count,
    (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND status = 'active') AS active_project_count,
    (SELECT COUNT(*) FROM employees WHERE deleted_at IS NULL AND is_active = true) AS employee_count,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type IN ('project_deposit','owner_deposit')), 0) AS total_income,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type IN ('project_expense','office_expense')), 0) AS total_expense,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type IN ('project_deposit','owner_deposit')), 0)
      + COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type IN ('project_expense','office_expense')), 0) AS total_movement;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dashboard_monthly_revenue_expenses(months_back INT DEFAULT 6)
RETURNS TABLE(month_key TEXT, revenue NUMERIC, expense NUMERIC) AS $$
DECLARE
  start_date DATE;
BEGIN
  start_date := (date_trunc('month', CURRENT_DATE) - ((months_back - 1) || ' months')::INTERVAL)::DATE;
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(0, months_back - 1) AS i
  ),
  month_keys AS (
    SELECT to_char(date_trunc('month', CURRENT_DATE) - (i || ' months')::INTERVAL, 'YYYY-MM') AS mk
    FROM months
  ),
  supervision AS (
    SELECT to_char(p.created_at, 'YYYY-MM') AS mk,
           SUM((COALESCE(t.amount, 0) - COALESCE(t.paid_amount, 0)) * COALESCE(p.supervision_percentage, 0) / 100) AS amt
    FROM projects p
    JOIN transactions t ON t.project_id = p.id
    WHERE t.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND t.type = 'project_expense'
      AND t.expense_category != 'design'
    GROUP BY to_char(p.created_at, 'YYYY-MM')
  ),
  owner_dep AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk,
           SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND t.type = 'owner_deposit'
      AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  office_exp AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk,
           SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND t.type IN ('office_expense','withdrawal')
      AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  )
  SELECT m.mk::TEXT,
         COALESCE(s.amt, 0) + COALESCE(o.amt, 0) AS revenue,
         COALESCE(e.amt, 0) AS expense
  FROM month_keys m
  LEFT JOIN supervision s ON s.mk = m.mk
  LEFT JOIN owner_dep o ON o.mk = m.mk
  LEFT JOIN office_exp e ON e.mk = m.mk
  ORDER BY m.mk;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dashboard_office_expense_sectors()
RETURNS TABLE(sector TEXT, amount NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(t.sector_name, 'غير مصنف') AS sector,
         SUM(t.amount) AS amount
  FROM transactions t
  WHERE t.deleted_at IS NULL AND t.type = 'office_expense'
  GROUP BY COALESCE(t.sector_name, 'غير مصنف')
  ORDER BY SUM(t.amount) DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dashboard_top_vendors(limit_count INT DEFAULT 10)
RETURNS TABLE(vendor_id UUID, vendor_name TEXT, balance NUMERIC) AS $$
BEGIN
  RETURN QUERY
  WITH vendor_net AS (
    SELECT t.vendor_id, SUM(COALESCE(t.amount, 0) - COALESCE(t.paid_amount, 0)) AS bal
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND t.type = 'project_expense'
      AND t.payment_term IS NOT NULL
      AND t.vendor_id IS NOT NULL
    GROUP BY t.vendor_id
    UNION ALL
    SELECT p.vendor_id, SUM(COALESCE(p.total_price, 0) - COALESCE(p.paid_amount, 0)) AS bal
    FROM procurements p
    WHERE p.deleted_at IS NULL
      AND p.payment_term IS NOT NULL
      AND p.vendor_id IS NOT NULL
    GROUP BY p.vendor_id
  ),
  grouped AS (
    SELECT vendor_id, SUM(bal) AS balance
    FROM vendor_net
    GROUP BY vendor_id
  )
  SELECT g.vendor_id, v.name AS vendor_name, g.balance
  FROM grouped g
  JOIN vendors v ON v.id = g.vendor_id
  WHERE g.balance > 0
  ORDER BY g.balance DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dashboard_active_client_balances(limit_count INT DEFAULT 10)
RETURNS TABLE(client_id UUID, client_name TEXT, deposits NUMERIC, expenses NUMERIC, balance NUMERIC) AS $$
BEGIN
  RETURN QUERY
  WITH active_clients AS (
    SELECT DISTINCT c.id, c.name
    FROM clients c
    JOIN projects p ON p.client_id = c.id
    WHERE c.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND p.status = 'active'
  ),
  client_deposits AS (
    SELECT t.client_id, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND t.type = 'project_deposit'
      AND t.client_id IS NOT NULL
    GROUP BY t.client_id
  ),
  client_expenses AS (
    SELECT t.client_id, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND t.type = 'project_expense'
      AND t.client_id IS NOT NULL
    GROUP BY t.client_id
  )
  SELECT ac.id AS client_id,
         ac.name AS client_name,
         COALESCE(d.amt, 0) AS deposits,
         COALESCE(e.amt, 0) AS expenses,
         COALESCE(d.amt, 0) - COALESCE(e.amt, 0) AS balance
  FROM active_clients ac
  LEFT JOIN client_deposits d ON d.client_id = ac.id
  LEFT JOIN client_expenses e ON e.client_id = ac.id
  WHERE COALESCE(d.amt, 0) - COALESCE(e.amt, 0) <> 0
  ORDER BY (COALESCE(d.amt, 0) - COALESCE(e.amt, 0)) DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
