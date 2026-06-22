-- Migration v240 — Employee RLS hardening + multi-tenancy foundation
-- Idempotent. Run in Supabase SQL Editor as a single script.
-- After running, existing data is assigned to the default tenant so nothing breaks.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Tenant tables                                        │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  is_default BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_default_unique ON tenants (is_default) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS user_tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, tenant_id)
);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Helper: read current tenant from app header or user  │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
  v_header TEXT;
  v_default UUID;
BEGIN
  -- PostgREST exposes request headers as a JSON object
  BEGIN
    v_header := current_setting('request.headers', true)::json->>'x-app-tenant';
  EXCEPTION WHEN OTHERS THEN
    v_header := NULL;
  END;

  IF v_header IS NOT NULL AND v_header <> '' THEN
    RETURN v_header::UUID;
  END IF;

  -- Fallback to the user's default tenant
  SELECT tenant_id INTO v_default
  FROM user_tenants
  WHERE user_id = auth.uid() AND is_default = true
  LIMIT 1;

  RETURN COALESCE(v_default, '00000000-0000-0000-0000-000000000001'::UUID);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Add tenant_id columns to all business tables         │
-- └─────────────────────────────────────────────────────────┘

ALTER TABLE clients       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE employees     ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE vendors       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE items         ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE sectors       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE procurements  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE employee_transactions       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE employee_salary_history     ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE custody_records  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE custody_expenses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE work_sections ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE work_items    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE audit_logs    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3b. Backfill existing data into the default tenant      │
-- └─────────────────────────────────────────────────────────┘

DO $$
DECLARE
  v_default_tenant UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Create default tenant if it does not exist
  INSERT INTO tenants (id, name, is_default)
  VALUES (v_default_tenant, 'Default Tenant', true)
  ON CONFLICT (id) DO NOTHING;

  -- Link every existing profile to the default tenant
  INSERT INTO user_tenants (user_id, tenant_id, role, is_default)
  SELECT p.id, v_default_tenant, 'admin', true
  FROM profiles p
  LEFT JOIN user_tenants ut ON ut.user_id = p.id
  WHERE ut.id IS NULL
  ON CONFLICT DO NOTHING;

  -- Backfill tenant_id on all business tables
  UPDATE clients       SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE projects      SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE employees     SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE vendors       SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE items         SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE sectors       SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE transactions  SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE procurements  SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE employee_transactions       SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE employee_salary_history     SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE custody_records SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE custody_expenses SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE attendance_records SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE payroll_records SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE work_sections SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE work_items    SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE project_tasks SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  UPDATE audit_logs    SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
END $$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Auto-set tenant_id on insert/update                  │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := get_current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS clients_tenant ON clients; CREATE TRIGGER clients_tenant BEFORE INSERT OR UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS projects_tenant ON projects; CREATE TRIGGER projects_tenant BEFORE INSERT OR UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS employees_tenant ON employees; CREATE TRIGGER employees_tenant BEFORE INSERT OR UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS vendors_tenant ON vendors; CREATE TRIGGER vendors_tenant BEFORE INSERT OR UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS items_tenant ON items; CREATE TRIGGER items_tenant BEFORE INSERT OR UPDATE ON items FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS sectors_tenant ON sectors; CREATE TRIGGER sectors_tenant BEFORE INSERT OR UPDATE ON sectors FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS transactions_tenant ON transactions; CREATE TRIGGER transactions_tenant BEFORE INSERT OR UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS procurements_tenant ON procurements; CREATE TRIGGER procurements_tenant BEFORE INSERT OR UPDATE ON procurements FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS employee_transactions_tenant ON employee_transactions; CREATE TRIGGER employee_transactions_tenant BEFORE INSERT OR UPDATE ON employee_transactions FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS employee_salary_history_tenant ON employee_salary_history; CREATE TRIGGER employee_salary_history_tenant BEFORE INSERT OR UPDATE ON employee_salary_history FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS custody_records_tenant ON custody_records; CREATE TRIGGER custody_records_tenant BEFORE INSERT OR UPDATE ON custody_records FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS custody_expenses_tenant ON custody_expenses; CREATE TRIGGER custody_expenses_tenant BEFORE INSERT OR UPDATE ON custody_expenses FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS attendance_records_tenant ON attendance_records; CREATE TRIGGER attendance_records_tenant BEFORE INSERT OR UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS payroll_records_tenant ON payroll_records; CREATE TRIGGER payroll_records_tenant BEFORE INSERT OR UPDATE ON payroll_records FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS work_sections_tenant ON work_sections; CREATE TRIGGER work_sections_tenant BEFORE INSERT OR UPDATE ON work_sections FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS work_items_tenant ON work_items; CREATE TRIGGER work_items_tenant BEFORE INSERT OR UPDATE ON work_items FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS project_tasks_tenant ON project_tasks; CREATE TRIGGER project_tasks_tenant BEFORE INSERT OR UPDATE ON project_tasks FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
DROP TRIGGER IF EXISTS audit_logs_tenant ON audit_logs; CREATE TRIGGER audit_logs_tenant BEFORE INSERT OR UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. Replace open RLS policies with tenant-scoped ones    │
-- └─────────────────────────────────────────────────────────┘

-- Helper function: is current user admin?
CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Reusable tenant policy application
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'clients','projects','employees','vendors','items','sectors','transactions',
    'procurements','employee_transactions','employee_salary_history','custody_records',
    'custody_expenses','attendance_records','payroll_records','work_sections','work_items',
    'project_tasks','audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "tenant_scope" ON %I FOR ALL TO authenticated USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id())',
      tbl
    );
  END LOOP;
END $$;

-- user_permissions is cross-tenant; keep scoped to user row
DROP POLICY IF EXISTS "authenticated_all" ON user_permissions;
CREATE POLICY "user_permissions_own" ON user_permissions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_app_admin())
  WITH CHECK (user_id = auth.uid() OR is_app_admin());

-- profiles: users see/edit own; admin sees all
DROP POLICY IF EXISTS "authenticated_all" ON profiles;
CREATE POLICY "profiles_own" ON profiles FOR ALL TO authenticated
  USING (id = auth.uid() OR is_app_admin())
  WITH CHECK (id = auth.uid() OR is_app_admin());

-- tenants: admin only
DROP POLICY IF EXISTS "authenticated_all" ON tenants;
CREATE POLICY "tenants_admin" ON tenants FOR ALL TO authenticated
  USING (is_app_admin()) WITH CHECK (is_app_admin());

-- user_tenants: users see own memberships; admin manages all
DROP POLICY IF EXISTS "authenticated_all" ON user_tenants;
CREATE POLICY "user_tenants_own" ON user_tenants FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_app_admin())
  WITH CHECK (user_id = auth.uid() OR is_app_admin());

-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. Employee-module write protection                     │
-- └─────────────────────────────────────────────────────────┘

-- Non-admins can read employee data but cannot modify it.
DROP POLICY IF EXISTS "tenant_scope" ON employees;
CREATE POLICY "employees_read" ON employees FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY "employees_admin_write" ON employees FOR ALL TO authenticated
  USING (is_app_admin() AND tenant_id = get_current_tenant_id())
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "tenant_scope" ON attendance_records;
CREATE POLICY "attendance_read" ON attendance_records FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY "attendance_admin_write" ON attendance_records FOR ALL TO authenticated
  USING (is_app_admin() AND tenant_id = get_current_tenant_id())
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "tenant_scope" ON payroll_records;
CREATE POLICY "payroll_read" ON payroll_records FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY "payroll_admin_write" ON payroll_records FOR ALL TO authenticated
  USING (is_app_admin() AND tenant_id = get_current_tenant_id())
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "tenant_scope" ON employee_transactions;
CREATE POLICY "emp_tx_read" ON employee_transactions FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY "emp_tx_admin_write" ON employee_transactions FOR ALL TO authenticated
  USING (is_app_admin() AND tenant_id = get_current_tenant_id())
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "tenant_scope" ON employee_salary_history;
CREATE POLICY "salary_history_read" ON employee_salary_history FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY "salary_history_admin_write" ON employee_salary_history FOR ALL TO authenticated
  USING (is_app_admin() AND tenant_id = get_current_tenant_id())
  WITH CHECK (is_app_admin());
