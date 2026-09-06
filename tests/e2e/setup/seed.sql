-- E2E staging seed for Sara-Arch.
-- Apply this file once to your dedicated staging Supabase project (SQL Editor -> New query -> Run).
-- It is idempotent: calling the functions repeatedly is safe.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Idempotent cleanup helper                            │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.e2e_cleanup_tenant(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard the default tenant so an accidental call cannot wipe shared data.
  IF p_tenant_id = '00000000-0000-0000-0000-000000000001'::UUID THEN
    RAISE EXCEPTION 'Refusing to clean the default tenant';
  END IF;

  -- 1. v301 notification data.
  DELETE FROM public.notifications WHERE tenant_id = p_tenant_id;
  DELETE FROM public.notification_rules WHERE tenant_id = p_tenant_id;

  -- 2. Child tables with FK dependencies.
  DELETE FROM public.custody_expenses
  WHERE custody_id IN (SELECT id FROM public.custody_records WHERE tenant_id = p_tenant_id);

  DELETE FROM public.invoice_items
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE tenant_id = p_tenant_id);

  DELETE FROM public.invoices WHERE tenant_id = p_tenant_id;

  DELETE FROM public.project_period_closes WHERE tenant_id = p_tenant_id;
  DELETE FROM public.project_section_supervision WHERE tenant_id = p_tenant_id;

  DELETE FROM public.work_items
  WHERE section_id IN (SELECT id FROM public.work_sections WHERE tenant_id = p_tenant_id);

  DELETE FROM public.project_tasks WHERE tenant_id = p_tenant_id;

  -- 3. Transactions: linked retention rows before their parent deposits.
  DELETE FROM public.transactions
  WHERE tenant_id = p_tenant_id AND type = 'retention_withheld';

  -- 4. Tables that reference transactions must be cleared before transactions.
  DELETE FROM public.custody_records WHERE tenant_id = p_tenant_id;

  DELETE FROM public.attendance_records WHERE tenant_id = p_tenant_id;
  DELETE FROM public.payroll_records WHERE tenant_id = p_tenant_id;
  DELETE FROM public.employee_transactions WHERE tenant_id = p_tenant_id;
  DELETE FROM public.employee_salary_history WHERE tenant_id = p_tenant_id;
  DELETE FROM public.procurements WHERE tenant_id = p_tenant_id;

  DELETE FROM public.transactions WHERE tenant_id = p_tenant_id;

  DELETE FROM public.work_sections WHERE tenant_id = p_tenant_id;

  DELETE FROM public.projects WHERE tenant_id = p_tenant_id;
  DELETE FROM public.clients WHERE tenant_id = p_tenant_id;
  DELETE FROM public.employees WHERE tenant_id = p_tenant_id;
  DELETE FROM public.vendors WHERE tenant_id = p_tenant_id AND is_office IS NOT TRUE;
  DELETE FROM public.items WHERE tenant_id = p_tenant_id;
  DELETE FROM public.sectors WHERE tenant_id = p_tenant_id;

  DELETE FROM public.audit_logs WHERE tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.e2e_cleanup_tenant(UUID) IS 'Idempotently removes all business data for a single E2E tenant. Used by Playwright global teardown.';

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Per-tenant seed helper                               │
-- │    Called by global-setup.js after creating the tenant. │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.e2e_seed_tenant(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Default expense sectors.
  INSERT INTO public.sectors (tenant_id, name)
  SELECT p_tenant_id, name
  FROM (VALUES
    ('رواتب'),
    ('إيجارات'),
    ('مرافق'),
    ('صيانة'),
    ('تسويق'),
    ('نثرية'),
    ('أخرى')
  ) AS v(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sectors
    WHERE tenant_id = p_tenant_id AND name = v.name
  );

  -- Internal office vendor used for office income.
  INSERT INTO public.vendors (tenant_id, name, vendor_type, is_office)
  SELECT p_tenant_id, 'مكتب سارة أبو العلا', 'service', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.vendors
    WHERE tenant_id = p_tenant_id AND is_office = true
  );

  -- Default notification rules for v301 alert generation.
  INSERT INTO public.notification_rules (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.e2e_seed_tenant(UUID) IS 'Seeds default sectors, office vendor, and notification rules for a single E2E tenant.';
