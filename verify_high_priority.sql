-- Combined high-priority verification script for Sara-Arch.
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
  v_ids UUID[];
  v_names TEXT[];
  v_cleanup_count INT;
  v_tenant_a_id UUID;
  v_tenant_b_id UUID;
BEGIN
  -- Clean up any leftover rows from ALL previous test runs
  DELETE FROM public.transactions
  WHERE project_id IN (SELECT id FROM public.projects WHERE name LIKE 'Test Project _');
  DELETE FROM public.projects WHERE name LIKE 'Test Project _';
  DELETE FROM public.clients WHERE name LIKE 'Test Client _';
  DELETE FROM public.user_tenants
  WHERE user_id IN (SELECT id FROM public.profiles WHERE username LIKE 'test_user_');
  DELETE FROM public.profiles WHERE username LIKE 'test_user_';
  DELETE FROM public.tenants WHERE slug LIKE 'test-tenant-%';

  INSERT INTO public.tenants (id, name, slug) VALUES
    (v_tenant_a, 'Test Tenant A', 'test-tenant-a'),
    (v_tenant_b, 'Test Tenant B', 'test-tenant-b');

  INSERT INTO public.profiles (id, username, role) VALUES
    (v_user_a, 'test_user_a', 'user'),
    (v_user_b, 'test_user_b', 'user');

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_default) VALUES
    (v_user_a, v_tenant_a, 'user', true),
    (v_user_b, v_tenant_b, 'user', true);

  -- Disable auto-tenant triggers so our explicit tenant_id values stick,
  -- and clear any session-level header that might leak from a previous query.
  ALTER TABLE public.clients DISABLE TRIGGER clients_tenant;
  ALTER TABLE public.projects DISABLE TRIGGER projects_tenant;
  RESET request.headers;
  RESET request.jwt.claim.sub;
  RESET request.jwt.claims;

  INSERT INTO public.clients (id, name, tenant_id) VALUES
    (v_client_a, 'Test Client A', v_tenant_a),
    (v_client_b, 'Test Client B', v_tenant_b);
  INSERT INTO public.projects (id, name, client_id, status, tenant_id) VALUES
    (v_project_a, 'Test Project A', v_client_a, 'active', v_tenant_a),
    (v_project_b, 'Test Project B', v_client_b, 'active', v_tenant_b);

  -- Re-enable triggers before the actual isolation tests
  ALTER TABLE public.clients ENABLE TRIGGER clients_tenant;
  ALTER TABLE public.projects ENABLE TRIGGER projects_tenant;

  -- Diagnostics: confirm cleanup + insert state as postgres
  SELECT COUNT(*) INTO v_cleanup_count FROM public.projects WHERE name LIKE 'Test Project _';
  SELECT tenant_id INTO v_tenant_a_id FROM public.projects WHERE id = v_project_a;
  SELECT tenant_id INTO v_tenant_b_id FROM public.projects WHERE id = v_project_b;

  -- Test 1: user_a + tenant_a
  RESET ROLE;
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_a::text);
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text);
  EXECUTE format('SET LOCAL request.headers = %L', json_build_object('x-app-tenant', v_tenant_a::text)::text);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*), array_agg(project_id), array_agg(project_name)
    INTO v_count, v_ids, v_names FROM public.project_balances;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant isolation FAIL: user_a/tenant_a expected 1, got %. auth.uid=% tenant=% ids=% names=% cleanup_count=% project_a_tenant=% project_b_tenant=%',
      v_count, auth.uid(), get_current_tenant_id(), v_ids, v_names, v_cleanup_count, v_tenant_a_id, v_tenant_b_id;
  END IF;
  RAISE NOTICE 'OK: user_a in tenant_a sees 1 project balance (id=% name=%)', v_ids, v_names;

  -- Test 2: user_a + tenant_b
  RESET ROLE;
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_a::text);
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text);
  EXECUTE format('SET LOCAL request.headers = %L', json_build_object('x-app-tenant', v_tenant_b::text)::text);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*), array_agg(project_id), array_agg(project_name)
    INTO v_count, v_ids, v_names FROM public.project_balances;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Tenant isolation FAIL: user_a/tenant_b expected 0, got %. auth.uid=% tenant=% ids=% names=% cleanup_count=% project_a_tenant=% project_b_tenant=%',
      v_count, auth.uid(), get_current_tenant_id(), v_ids, v_names, v_cleanup_count, v_tenant_a_id, v_tenant_b_id;
  END IF;
  RAISE NOTICE 'OK: user_a in tenant_b sees 0 project balances';

  -- Test 3: user_b + tenant_b
  RESET ROLE;
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_b::text);
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_user_b::text, 'role', 'authenticated')::text);
  EXECUTE format('SET LOCAL request.headers = %L', json_build_object('x-app-tenant', v_tenant_b::text)::text);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*), array_agg(project_id), array_agg(project_name)
    INTO v_count, v_ids, v_names FROM public.project_balances;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant isolation FAIL: user_b/tenant_b expected 1, got %. auth.uid=% tenant=% ids=% names=% cleanup_count=% project_a_tenant=% project_b_tenant=%',
      v_count, auth.uid(), get_current_tenant_id(), v_ids, v_names, v_cleanup_count, v_tenant_a_id, v_tenant_b_id;
  END IF;
  RAISE NOTICE 'OK: user_b in tenant_b sees 1 project balance (id=% name=%)', v_ids, v_names;
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
