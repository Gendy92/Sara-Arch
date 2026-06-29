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
  v_tenant_a UUID := '11111111-1111-1111-1111-111111111111';
  v_tenant_b UUID := '22222222-2222-2222-2222-222222222222';
  v_user_a   UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_user_b   UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_client_a UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_client_b UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_project_a UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_project_b UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_count INT;
BEGIN
  INSERT INTO public.tenants (id, name, slug) VALUES
    (v_tenant_a, 'Test Tenant A', 'test-tenant-a'),
    (v_tenant_b, 'Test Tenant B', 'test-tenant-b')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, username, role) VALUES
    (v_user_a, 'test_user_a', 'user'),
    (v_user_b, 'test_user_b', 'user')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_default) VALUES
    (v_user_a, v_tenant_a, 'user', true),
    (v_user_b, v_tenant_b, 'user', true)
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  INSERT INTO public.clients (id, name, tenant_id) VALUES
    (v_client_a, 'Test Client A', v_tenant_a),
    (v_client_b, 'Test Client B', v_tenant_b)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (id, name, client_id, status, tenant_id) VALUES
    (v_project_a, 'Test Project A', v_client_a, 'active', v_tenant_a),
    (v_project_b, 'Test Project B', v_client_b, 'active', v_tenant_b)
  ON CONFLICT (id) DO NOTHING;

  SET LOCAL ROLE authenticated;

  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.headers', '{"x-app-tenant":"' || v_tenant_a::text || '"}', true);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant isolation FAIL: user_a/tenant_a expected 1 project balance, got %', v_count;
  END IF;
  RAISE NOTICE 'OK: user_a in tenant_a sees 1 project balance';

  PERFORM set_config('request.headers', '{"x-app-tenant":"' || v_tenant_b::text || '"}', true);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Tenant isolation FAIL: user_a/tenant_b expected 0 project balances, got %', v_count;
  END IF;
  RAISE NOTICE 'OK: user_a in tenant_b sees 0 project balances';

  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.headers', '{"x-app-tenant":"' || v_tenant_b::text || '"}', true);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
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
