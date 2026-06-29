-- Combined high-priority verification script for Sara-Arch v273.
-- Run this in the Supabase SQL Editor as a single transaction.
-- Expected: all NOTICEs say "OK" and the tenant-isolation tests pass.

BEGIN;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 1. Security Advisor checks                                  │
-- └─────────────────────────────────────────────────────────────┘
DO $$
DECLARE
  v_view TEXT;
  v_is_invoker BOOLEAN;
  v_views TEXT[] := ARRAY[
    'project_balances',
    'client_balances',
    'vendor_balances',
    'office_balance',
    'office_transactions_view',
    'project_transactions_view'
  ];
BEGIN
  FOREACH v_view IN ARRAY v_views
  LOOP
    SELECT reloptions @> Array['security_invoker=true']
      INTO v_is_invoker
    FROM pg_class
    WHERE relname = v_view AND relkind = 'v';

    IF v_is_invoker THEN
      RAISE NOTICE 'OK: % is security_invoker', v_view;
    ELSE
      RAISE WARNING 'FAIL: % is NOT security_invoker', v_view;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_rls BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO v_rls
  FROM pg_class
  WHERE relname = 'schema_migrations' AND relkind = 'r';

  IF v_rls THEN
    RAISE NOTICE 'OK: schema_migrations has RLS enabled';
  ELSE
    RAISE WARNING 'FAIL: schema_migrations RLS is disabled';
  END IF;
END $$;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 2. Tenant-isolation regression test                         │
-- └─────────────────────────────────────────────────────────────┘
DO $$
DECLARE
  v_tenant_a UUID := gen_random_uuid();
  v_tenant_b UUID := gen_random_uuid();
  v_user_a   UUID := gen_random_uuid();
  v_user_b   UUID := gen_random_uuid();
  v_client_a UUID := gen_random_uuid();
  v_client_b UUID := gen_random_uuid();
  v_project_a UUID := gen_random_uuid();
  v_project_b UUID := gen_random_uuid();
  v_count INT;
BEGIN
  -- Clean up any leftover rows from previous aborted test runs
  DELETE FROM public.transactions WHERE project_id IN (v_project_a, v_project_b);
  DELETE FROM public.projects WHERE id IN (v_project_a, v_project_b);
  DELETE FROM public.clients WHERE id IN (v_client_a, v_client_b);
  DELETE FROM public.user_tenants WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.profiles WHERE id IN (v_user_a, v_user_b);
  DELETE FROM public.tenants WHERE id IN (v_tenant_a, v_tenant_b);

  INSERT INTO public.tenants (id, name, slug) VALUES
    (v_tenant_a, 'Test Tenant A', 'test-tenant-a'),
    (v_tenant_b, 'Test Tenant B', 'test-tenant-b');

  INSERT INTO public.profiles (id, username, role) VALUES
    (v_user_a, 'test_user_a', 'user'),
    (v_user_b, 'test_user_b', 'user');

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_default) VALUES
    (v_user_a, v_tenant_a, 'user', true),
    (v_user_b, v_tenant_b, 'user', true);

  INSERT INTO public.clients (id, name, tenant_id) VALUES
    (v_client_a, 'Test Client A', v_tenant_a),
    (v_client_b, 'Test Client B', v_tenant_b);

  INSERT INTO public.projects (id, name, client_id, status, tenant_id) VALUES
    (v_project_a, 'Test Project A', v_client_a, 'active', v_tenant_a),
    (v_project_b, 'Test Project B', v_client_b, 'active', v_tenant_b);

  SET LOCAL ROLE authenticated;

  -- Test 1: user_a + tenant_a
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_a::text);
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text);
  EXECUTE format('SET LOCAL request.headers = %L', json_build_object('x-app-tenant', v_tenant_a::text)::text);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  RAISE NOTICE 'DEBUG user_a/tenant_a: auth.uid=%  tenant=%  count=%', auth.uid(), get_current_tenant_id(), v_count;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant isolation FAIL: user_a/tenant_a expected 1 project balance, got %', v_count;
  END IF;
  RAISE NOTICE 'OK: user_a in tenant_a sees 1 project balance';

  -- Test 2: user_a + tenant_b
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_a::text);
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text);
  EXECUTE format('SET LOCAL request.headers = %L', json_build_object('x-app-tenant', v_tenant_b::text)::text);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  RAISE NOTICE 'DEBUG user_a/tenant_b: auth.uid=%  tenant=%  count=%', auth.uid(), get_current_tenant_id(), v_count;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Tenant isolation FAIL: user_a/tenant_b expected 0 project balances, got %', v_count;
  END IF;
  RAISE NOTICE 'OK: user_a in tenant_b sees 0 project balances';

  -- Test 3: user_b + tenant_b
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_b::text);
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_user_b::text, 'role', 'authenticated')::text);
  EXECUTE format('SET LOCAL request.headers = %L', json_build_object('x-app-tenant', v_tenant_b::text)::text);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  RAISE NOTICE 'DEBUG user_b/tenant_b: auth.uid=%  tenant=%  count=%', auth.uid(), get_current_tenant_id(), v_count;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant isolation FAIL: user_b/tenant_b expected 1 project balance, got %', v_count;
  END IF;
  RAISE NOTICE 'OK: user_b in tenant_b sees 1 project balance';
END $$;

ROLLBACK;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 3. Sanity-check that views still return production data     │
-- └─────────────────────────────────────────────────────────────┘
SELECT
  (SELECT COUNT(*) FROM project_balances) AS project_balance_rows,
  (SELECT COUNT(*) FROM client_balances) AS client_balance_rows,
  (SELECT COUNT(*) FROM vendor_balances) AS vendor_balance_rows,
  (SELECT COUNT(*) FROM office_balance) AS office_balance_rows,
  (SELECT COUNT(*) FROM office_transactions_view) AS office_tx_rows,
  (SELECT COUNT(*) FROM project_transactions_view) AS project_tx_rows;
