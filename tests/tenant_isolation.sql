-- Regression test: tenant isolation on balance/transaction views.
-- Run this in the Supabase SQL Editor as a single transaction.
-- Expected: only the rows belonging to the impersonated tenant are visible.

BEGIN;

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
  -- Setup (runs as postgres, bypasses RLS)
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

  -- Impersonate an authenticated user for the rest of the tests
  SET LOCAL ROLE authenticated;

  -- Test 1: user_a + tenant_a should see 1 project balance
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.headers', '{"x-app-tenant":"' || v_tenant_a::text || '"}', true);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Test 1 FAILED: expected 1 project balance for tenant_a, got %', v_count;
  END IF;
  RAISE NOTICE 'Test 1 OK: user_a in tenant_a sees 1 project balance';

  -- Test 2: user_a + tenant_b should see 0 project balances
  PERFORM set_config('request.headers', '{"x-app-tenant":"' || v_tenant_b::text || '"}', true);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Test 2 FAILED: expected 0 project balances for user_a in tenant_b, got %', v_count;
  END IF;
  RAISE NOTICE 'Test 2 OK: user_a in tenant_b sees 0 project balances';

  -- Test 3: user_b + tenant_b should see 1 project balance
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.headers', '{"x-app-tenant":"' || v_tenant_b::text || '"}', true);
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Test 3 FAILED: expected 1 project balance for tenant_b, got %', v_count;
  END IF;
  RAISE NOTICE 'Test 3 OK: user_b in tenant_b sees 1 project balance';
END $$;

ROLLBACK;
