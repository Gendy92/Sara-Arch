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

-- Make nullable (for backward compatibility)
ALTER TABLE transactions ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN project_id DROP NOT NULL;

-- Custody
ALTER TABLE custody_records ADD COLUMN IF NOT EXISTS returned_amount NUMERIC DEFAULT 0;

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
