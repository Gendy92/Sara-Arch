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
  linked_procurement_id UUID REFERENCES procurements(id),
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
  linked_transaction_id UUID REFERENCES transactions(id),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
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
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_employee_date
  ON attendance_records (employee_id, date)
  WHERE deleted_at IS NULL;

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
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
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
   OR expense_category NOT IN ('construction','design','merchandise');

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 4: Constraints                                     │
-- └─────────────────────────────────────────────────────────┘

-- Transactions type constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('project_deposit','project_expense','office_expense','owner_deposit','income','expense','deposit','withdrawal','supervision'));

-- Transactions expense_category constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_expense_category_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_expense_category_check CHECK (expense_category IN ('construction','design','merchandise'));

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
$$ LANGUAGE plpgsql SET search_path = public;

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

-- Ensure employee_salary_history can track creator for trigger below
ALTER TABLE employee_salary_history ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE employee_salary_history ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Trigger function to auto-set created_by on insert
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = COALESCE(NEW.created_by, auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS clients_cb ON clients; CREATE TRIGGER clients_cb BEFORE INSERT ON clients FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS projects_cb ON projects; CREATE TRIGGER projects_cb BEFORE INSERT ON projects FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS employees_cb ON employees; CREATE TRIGGER employees_cb BEFORE INSERT ON employees FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS vendors_cb ON vendors; CREATE TRIGGER vendors_cb BEFORE INSERT ON vendors FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS items_cb ON items; CREATE TRIGGER items_cb BEFORE INSERT ON items FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS sectors_cb ON sectors; CREATE TRIGGER sectors_cb BEFORE INSERT ON sectors FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS transactions_cb ON transactions; CREATE TRIGGER transactions_cb BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS procurements_cb ON procurements; CREATE TRIGGER procurements_cb BEFORE INSERT ON procurements FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS employee_transactions_cb ON employee_transactions; CREATE TRIGGER employee_transactions_cb BEFORE INSERT ON employee_transactions FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS employee_salary_history_cb ON employee_salary_history; CREATE TRIGGER employee_salary_history_cb BEFORE INSERT ON employee_salary_history FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS custody_records_cb ON custody_records; CREATE TRIGGER custody_records_cb BEFORE INSERT ON custody_records FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS custody_expenses_cb ON custody_expenses; CREATE TRIGGER custody_expenses_cb BEFORE INSERT ON custody_expenses FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS attendance_records_cb ON attendance_records; CREATE TRIGGER attendance_records_cb BEFORE INSERT ON attendance_records FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS payroll_records_cb ON payroll_records; CREATE TRIGGER payroll_records_cb BEFORE INSERT ON payroll_records FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS work_sections_cb ON work_sections; CREATE TRIGGER work_sections_cb BEFORE INSERT ON work_sections FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS work_items_cb ON work_items; CREATE TRIGGER work_items_cb BEFORE INSERT ON work_items FOR EACH ROW EXECUTE FUNCTION set_created_by();
DROP TRIGGER IF EXISTS project_tasks_cb ON project_tasks; CREATE TRIGGER project_tasks_cb BEFORE INSERT ON project_tasks FOR EACH ROW EXECUTE FUNCTION set_created_by();

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

-- Clean up legacy open policies from earlier schema versions (will be replaced by restricted policies below)
DROP POLICY IF EXISTS "Allow all for authenticated" ON clients;
DROP POLICY IF EXISTS "Allow all for authenticated" ON projects;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employees;
DROP POLICY IF EXISTS "Allow all for authenticated" ON vendors;
DROP POLICY IF EXISTS "Allow all for authenticated" ON items;
DROP POLICY IF EXISTS "Allow all for authenticated" ON sectors;
DROP POLICY IF EXISTS "Allow all for authenticated" ON transactions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON procurements;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employee_transactions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employee_salary_history;
DROP POLICY IF EXISTS "Allow all for authenticated" ON custody_records;
DROP POLICY IF EXISTS "Allow all for authenticated" ON custody_expenses;
DROP POLICY IF EXISTS "Allow all for authenticated" ON work_sections;
DROP POLICY IF EXISTS "Allow all for authenticated" ON work_items;
DROP POLICY IF EXISTS "Allow all for authenticated" ON profiles;
DROP POLICY IF EXISTS "Allow all for authenticated" ON audit_logs;
DROP POLICY IF EXISTS "Allow all for authenticated" ON user_permissions;

-- Drop legacy helper function no longer used by the application
DROP FUNCTION IF EXISTS public.soft_delete(text, uuid);

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

-- Deduplicate sectors by name (keep the oldest record) and enforce uniqueness
WITH keepers AS (
  SELECT DISTINCT ON (LOWER(name)) id
  FROM sectors
  ORDER BY LOWER(name), created_at ASC, id ASC
)
DELETE FROM sectors
WHERE id NOT IN (SELECT id FROM keepers);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sectors_name_unique' AND conrelid = 'public.sectors'::regclass
  ) THEN
    ALTER TABLE sectors ADD CONSTRAINT sectors_name_unique UNIQUE (name);
  END IF;
END $$;

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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_unique'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END $$;
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
DECLARE
  profile_role TEXT;
  meta_role TEXT;
BEGIN
  SELECT role INTO profile_role FROM profiles WHERE id = user_uuid;
  SELECT raw_user_meta_data ->> 'role' INTO meta_role FROM auth.users WHERE id = user_uuid;
  RETURN COALESCE(profile_role, '') = 'admin' OR COALESCE(meta_role, '') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
        'work_items','profiles','audit_logs','user_permissions','project_tasks',
        'attendance_records','payroll_records'
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

DROP POLICY IF EXISTS "auth_restricted_profiles" ON profiles;
CREATE POLICY "auth_restricted_profiles" ON profiles FOR SELECT TO authenticated USING (is_app_admin(auth.uid()) OR id = auth.uid());

DROP POLICY IF EXISTS "auth_admin_modify_profiles" ON profiles;
CREATE POLICY "auth_admin_modify_profiles" ON profiles FOR ALL TO authenticated USING (is_app_admin(auth.uid())) WITH CHECK (is_app_admin(auth.uid()));

-- Restrict user_permissions to admins only
DROP POLICY IF EXISTS "auth_restricted_user_permissions" ON user_permissions;
DROP POLICY IF EXISTS "auth_admin_modify_user_permissions" ON user_permissions;
CREATE POLICY "auth_admin_modify_user_permissions" ON user_permissions FOR ALL TO authenticated USING (is_app_admin(auth.uid())) WITH CHECK (is_app_admin(auth.uid()));

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 9b: Procurement → Transaction Linkage              │
-- └─────────────────────────────────────────────────────────┘

-- Linkage columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_procurement_id UUID REFERENCES procurements(id);
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES transactions(id);

-- Backfill: create project_expense transactions for existing procurements that have a project
INSERT INTO transactions (
  type, project_id, client_id, vendor_id, amount, paid_amount,
  expense_category, description, date, linked_procurement_id,
  created_at, updated_at
)
SELECT
  'project_expense', p.project_id, pr.client_id, p.vendor_id,
  p.total_price, COALESCE(p.paid_amount, 0), 'merchandise',
  p.item_name, p.date, p.id,
  p.created_at, p.updated_at
FROM procurements p
LEFT JOIN projects pr ON pr.id = p.project_id
WHERE p.deleted_at IS NULL
  AND p.project_id IS NOT NULL
  AND p.linked_transaction_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE procurements p
SET linked_transaction_id = t.id
FROM transactions t
WHERE t.linked_procurement_id = p.id
  AND p.linked_transaction_id IS NULL;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION dashboard_office_income_expense_sectors()
RETURNS TABLE(label TEXT, amount NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT 'إيرادات المكتب'::TEXT AS label,
         COALESCE(SUM(t.amount), 0) AS amount
  FROM transactions t
  WHERE t.deleted_at IS NULL AND t.type = 'owner_deposit'
  UNION ALL
  SELECT COALESCE(t.sector_name, 'مصروفات أخرى')::TEXT AS label,
         SUM(t.amount) AS amount
  FROM transactions t
  WHERE t.deleted_at IS NULL AND t.type = 'office_expense'
  GROUP BY COALESCE(t.sector_name, 'مصروفات أخرى')
  ORDER BY 2 DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
    SELECT vn.vendor_id, SUM(vn.bal) AS balance
    FROM vendor_net vn
    GROUP BY vn.vendor_id
  )
  SELECT g.vendor_id, v.name AS vendor_name, g.balance
  FROM grouped g
  JOIN vendors v ON v.id = g.vendor_id
  WHERE g.balance > 0
  ORDER BY g.balance DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.dashboard_active_client_balances(integer);

CREATE OR REPLACE FUNCTION dashboard_active_client_balances(limit_count INT DEFAULT 10)
RETURNS TABLE(client_id UUID, client_name TEXT, deposits NUMERIC, expenses NUMERIC, supervision NUMERIC, balance NUMERIC) AS $$
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
  ),
  project_supervision AS (
    SELECT p.client_id,
           SUM(GREATEST(0, COALESCE(total_exp.amt, 0) - COALESCE(design_exp.amt, 0)) * (p.supervision_percentage / 100.0)) AS amt
    FROM projects p
    LEFT JOIN (
      SELECT project_id, SUM(amount) AS amt
      FROM transactions
      WHERE deleted_at IS NULL AND type = 'project_expense'
      GROUP BY project_id
    ) total_exp ON total_exp.project_id = p.id
    LEFT JOIN (
      SELECT project_id, SUM(amount) AS amt
      FROM transactions
      WHERE deleted_at IS NULL AND type = 'project_expense' AND expense_category = 'design'
      GROUP BY project_id
    ) design_exp ON design_exp.project_id = p.id
    WHERE p.deleted_at IS NULL
    GROUP BY p.client_id
  )
  SELECT ac.id AS client_id,
         ac.name AS client_name,
         COALESCE(d.amt, 0) AS deposits,
         COALESCE(e.amt, 0) AS expenses,
         COALESCE(ps.amt, 0) AS supervision,
         COALESCE(d.amt, 0) - COALESCE(e.amt, 0) - COALESCE(ps.amt, 0) AS balance
  FROM active_clients ac
  LEFT JOIN client_deposits d ON d.client_id = ac.id
  LEFT JOIN client_expenses e ON e.client_id = ac.id
  LEFT JOIN project_supervision ps ON ps.client_id = ac.id
  WHERE COALESCE(d.amt, 0) - COALESCE(e.amt, 0) - COALESCE(ps.amt, 0) <> 0
  ORDER BY (COALESCE(d.amt, 0) - COALESCE(e.amt, 0) - COALESCE(ps.amt, 0)) DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke anon execute on SECURITY DEFINER functions to reduce exposed API surface.
-- Authenticated users still need these (dashboard via RPC, is_app_admin via RLS policies).
REVOKE EXECUTE ON FUNCTION public.dashboard_kpis() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_monthly_revenue_expenses(int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_office_expense_sectors() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_office_income_expense_sectors() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_top_vendors(int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_active_client_balances(int) FROM anon;

-- ┌─────────────────────────────────────────────────────────┐
-- │ STEP 10b: Balance Views                                 │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW public.project_balances AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.client_id,
  COALESCE(p.value, 0) AS value,
  COALESCE(d.amt, 0) AS deposits,
  COALESCE(e.amt, 0) AS expenses,
  COALESCE(de.amt, 0) AS design_expenses,
  COALESCE(e.amt, 0) - COALESCE(de.amt, 0) AS construction_expenses,
  ROUND((COALESCE(e.amt, 0) - COALESCE(de.amt, 0)) * COALESCE(p.supervision_percentage, 0) / 100, 2) AS supervision,
  COALESCE(d.amt, 0) - COALESCE(e.amt, 0) - ROUND((COALESCE(e.amt, 0) - COALESCE(de.amt, 0)) * COALESCE(p.supervision_percentage, 0) / 100, 2) AS balance
FROM projects p
LEFT JOIN (
  SELECT project_id, SUM(amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type = 'project_deposit' GROUP BY project_id
) d ON d.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type = 'project_expense' GROUP BY project_id
) e ON e.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type = 'project_expense' AND expense_category = 'design' GROUP BY project_id
) de ON de.project_id = p.id
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.client_balances AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  COALESCE(SUM(pb.deposits), 0) AS total_deposits,
  COALESCE(SUM(pb.expenses), 0) AS total_expenses,
  COALESCE(SUM(pb.supervision), 0) AS total_supervision,
  COALESCE(SUM(pb.balance), 0) AS balance
FROM clients c
LEFT JOIN project_balances pb ON pb.client_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name;

CREATE OR REPLACE VIEW public.vendor_balances AS
SELECT
  v.id AS vendor_id,
  v.name AS vendor_name,
  COALESCE(SUM(amounts.total_owed), 0) AS total_owed,
  COALESCE(SUM(amounts.total_paid), 0) AS total_paid,
  COALESCE(SUM(amounts.total_owed), 0) - COALESCE(SUM(amounts.total_paid), 0) AS balance
FROM vendors v
LEFT JOIN (
  SELECT
    vendor_id,
    COALESCE(SUM(amount), 0) AS total_owed,
    COALESCE(SUM(CASE WHEN payment_term IS NOT NULL THEN paid_amount ELSE amount END), 0) AS total_paid
  FROM transactions
  WHERE deleted_at IS NULL AND type = 'project_expense' AND vendor_id IS NOT NULL
  GROUP BY vendor_id
  UNION ALL
  SELECT
    vendor_id,
    COALESCE(SUM(total_price), 0) AS total_owed,
    COALESCE(SUM(CASE WHEN payment_term IS NOT NULL THEN paid_amount ELSE total_price END), 0) AS total_paid
  FROM procurements
  WHERE deleted_at IS NULL AND vendor_id IS NOT NULL
  GROUP BY vendor_id
) amounts ON amounts.vendor_id = v.id
WHERE v.deleted_at IS NULL
GROUP BY v.id, v.name;

CREATE OR REPLACE VIEW public.office_balance AS
SELECT
  COALESCE((SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL AND type IN ('owner_deposit','supervision')), 0) AS income,
  COALESCE((SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL AND type IN ('office_expense','withdrawal')), 0) AS expense,
  COALESCE((SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL AND type IN ('owner_deposit','supervision')), 0)
    - COALESCE((SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL AND type IN ('office_expense','withdrawal')), 0) AS balance;

CREATE OR REPLACE VIEW public.office_transactions_view AS
SELECT
  t.id,
  t.created_at,
  t.type,
  t.amount,
  t.description,
  t.employee_name,
  t.sector_name
FROM transactions t
WHERE t.deleted_at IS NULL AND t.type IN ('owner_deposit','office_expense','withdrawal')
UNION ALL
SELECT
  NULL::UUID AS id,
  p.created_at,
  'supervision'::TEXT AS type,
  pb.supervision AS amount,
  ('إشراف ' || p.name || ' (' || COALESCE(p.supervision_percentage,0) || '%)')::TEXT AS description,
  '-'::TEXT AS employee_name,
  '-'::TEXT AS sector_name
FROM project_balances pb
JOIN projects p ON p.id = pb.project_id
WHERE pb.supervision > 0;

GRANT SELECT ON public.project_balances TO authenticated;
GRANT SELECT ON public.client_balances TO authenticated;
GRANT SELECT ON public.vendor_balances TO authenticated;
GRANT SELECT ON public.office_balance TO authenticated;
GRANT SELECT ON public.office_transactions_view TO authenticated;

CREATE OR REPLACE VIEW public.project_transactions_view AS
SELECT
  t.id,
  t.created_at,
  t.type,
  t.amount,
  t.description,
  t.party_name,
  t.project_name,
  t.vendor_name,
  t.employee_name,
  t.sector_name,
  t.item_name,
  t.section_name,
  t.expense_category,
  t.payment_method,
  t.payment_term,
  t.paid_amount
FROM transactions t
WHERE t.deleted_at IS NULL AND t.type IN ('project_deposit','project_expense')
UNION ALL
SELECT
  NULL::UUID AS id,
  p.created_at,
  'supervision'::TEXT AS type,
  pb.supervision AS amount,
  ('إشراف ' || p.name || ' (' || COALESCE(p.supervision_percentage,0) || '%)')::TEXT AS description,
  NULL::TEXT AS party_name,
  p.name AS project_name,
  NULL::TEXT AS vendor_name,
  NULL::TEXT AS employee_name,
  NULL::TEXT AS sector_name,
  NULL::TEXT AS item_name,
  NULL::TEXT AS section_name,
  NULL::TEXT AS expense_category,
  NULL::TEXT AS payment_method,
  NULL::TEXT AS payment_term,
  NULL::NUMERIC AS paid_amount
FROM project_balances pb
JOIN projects p ON p.id = pb.project_id
WHERE pb.supervision > 0;

GRANT SELECT ON public.project_transactions_view TO authenticated;

-- Admin-only RPC to create a confirmed auth user directly in the database.
-- This bypasses Supabase Auth email confirmation / rate limits because the
-- browser no longer stores or uses the service-role key.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.admin_create_auth_user(text, text, jsonb);

CREATE OR REPLACE FUNCTION public.admin_create_auth_user(
  user_email TEXT,
  user_password TEXT,
  user_meta JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID := gen_random_uuid();
  instance UUID;
  encrypted_pw TEXT;
  meta JSONB := COALESCE(user_meta, '{}');
  existing_id UUID;
BEGIN
  IF NOT is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Avoid duplicates
  SELECT id INTO existing_id FROM auth.users WHERE email = user_email LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', existing_id, 'email', user_email, 'existing', true);
  END IF;

  SELECT instance_id INTO instance FROM auth.users LIMIT 1;
  IF instance IS NULL THEN
    instance := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  encrypted_pw := extensions.crypt(user_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    new_id, instance, 'authenticated', 'authenticated', user_email, encrypted_pw, NOW(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb, meta, NOW(), NOW()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_id,
    jsonb_build_object('sub', new_id::text, 'email', user_email),
    'email', new_id::text, NOW(), NOW(), NOW()
  );

  -- Create or update the profile row atomically in the same transaction.
  INSERT INTO public.profiles (id, name, username, role)
  VALUES (
    new_id,
    meta->>'name',
    meta->>'username',
    COALESCE(meta->>'role', 'user')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    username = EXCLUDED.username,
    role = EXCLUDED.role;

  RETURN jsonb_build_object('id', new_id, 'email', user_email, 'existing', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_app_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_auth_user(text, text, jsonb) FROM anon;

-- Helper for admins to check whether an email is already registered.
CREATE OR REPLACE FUNCTION public.auth_user_exists(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = user_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auth_user_exists(text) FROM anon;

-- Auto-confirm new auth users.
-- Supabase has a long-standing bug where disabling "Confirm email" still blocks
-- sign-in for unconfirmed accounts. This trigger ensures every inserted user is
-- immediately confirmed, regardless of that setting.
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;
CREATE TRIGGER auto_confirm_user_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_user();

-- Confirm any existing unconfirmed accounts (one-time cleanup).
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- Normalize legacy procurement / transaction payment tracking.
-- Records created before the payment_term/paid_amount columns (or with NULL values)
-- are treated as immediate/cash purchases so vendor balances are not inflated.
UPDATE procurements
SET payment_term = 'immediate',
    paid_amount = COALESCE(total_price, 0)
WHERE deleted_at IS NULL
  AND (payment_term IS NULL OR paid_amount IS NULL);

UPDATE transactions
SET payment_term = 'immediate',
    paid_amount = COALESCE(amount, 0)
WHERE deleted_at IS NULL
  AND (payment_term IS NULL OR paid_amount IS NULL)
  AND type = 'project_expense';

-- Refresh cache
NOTIFY pgrst, 'reload schema';
