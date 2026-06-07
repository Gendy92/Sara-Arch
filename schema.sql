-- ============================================================
-- Supabase Schema for Sara Abu Ela Financial System
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE clients (
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

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  client_name TEXT,
  value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','on_hold')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE employees (
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

-- ============================================================
-- VENDORS / SUPPLIERS
-- ============================================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- ITEMS / PRODUCTS
-- ============================================================
CREATE TABLE items (
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

-- ============================================================
-- SECTORS (for categorizing office expenses)
-- ============================================================
CREATE TABLE sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TRANSACTIONS (Income & Expenses)
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('income','expense','deposit','withdrawal','supervision','office_expense')),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  party_id UUID,
  party_name TEXT,
  party_type TEXT,
  project_id UUID REFERENCES projects(id),
  project_name TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- PROCUREMENTS (Project Expenses / Purchases)
-- ============================================================
CREATE TABLE procurements (
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

-- ============================================================
-- EMPLOYEE TRANSACTIONS (advances, penalties, bonuses)
-- ============================================================
CREATE TABLE employee_transactions (
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

-- ============================================================
-- EMPLOYEE SALARY HISTORY
-- ============================================================
CREATE TABLE employee_salary_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  old_salary NUMERIC,
  new_salary NUMERIC,
  effective_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTODY RECORDS
-- ============================================================
CREATE TABLE custody_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  client_id UUID REFERENCES clients(id),
  client_name TEXT,
  project_id UUID REFERENCES projects(id),
  project_name TEXT,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','settled','partial')),
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
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

-- Allow all operations for authenticated users (simplified policy)
-- You can refine these later based on roles
CREATE POLICY "Allow all for authenticated" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON procurements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON employee_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON employee_salary_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON custody_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon to sign up (auth handled by Supabase Auth)
-- No direct anon access to app tables

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Soft delete helper
CREATE OR REPLACE FUNCTION soft_delete(tbl TEXT, rec_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE id = %L', tbl, rec_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to all tables
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sectors_updated_at BEFORE UPDATE ON sectors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER procurements_updated_at BEFORE UPDATE ON procurements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER employee_transactions_updated_at BEFORE UPDATE ON employee_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER custody_records_updated_at BEFORE UPDATE ON custody_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA (Optional)
-- ============================================================

INSERT INTO sectors (name, description) VALUES
  ('رواتب', 'مصروفات الرواتب الشهرية'),
  ('إيجارات', 'إيجارات المكاتب والمستودعات'),
  ('مرافق', 'كهرباء، مياه، إنترنت، تليفون'),
  ('صيانة', 'صيانة المعدات والأجهزة'),
  ('تسويق', 'إعلانات وتسويق'),
  ('نثرية', 'مصروفات نثرية ومتنوعة');
