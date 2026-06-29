-- Regression test: tenant isolation on balance/transaction views.
-- Run this in the Supabase SQL Editor as a single transaction.
-- Expected: only the rows belonging to the impersonated tenant are visible.

BEGIN;

-- Fixed test UUIDs so the script is repeatable
\set tenant_a  '11111111-1111-1111-1111-111111111111'
\set tenant_b  '22222222-2222-2222-2222-222222222222'
\set user_a    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set user_b    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
\set client_a  'cccccccc-cccc-cccc-cccc-cccccccccccc'
\set client_b  'dddddddd-dddd-dddd-dddd-dddddddddddd'
\set project_a 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
\set project_b 'ffffffff-ffff-ffff-ffff-ffffffffffff'

-- Setup (runs as postgres, bypasses RLS)
INSERT INTO public.tenants (id, name, slug) VALUES
  (:'tenant_a', 'Test Tenant A', 'test-tenant-a'),
  (:'tenant_b', 'Test Tenant B', 'test-tenant-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, username, role) VALUES
  (:'user_a', 'test_user_a', 'user'),
  (:'user_b', 'test_user_b', 'user')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_tenants (user_id, tenant_id, role, is_default) VALUES
  (:'user_a', :'tenant_a', 'user', true),
  (:'user_b', :'tenant_b', 'user', true)
ON CONFLICT (user_id, tenant_id) DO NOTHING;

INSERT INTO public.clients (id, name, tenant_id) VALUES
  (:'client_a', 'Test Client A', :'tenant_a'),
  (:'client_b', 'Test Client B', :'tenant_b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projects (id, name, client_id, status, tenant_id) VALUES
  (:'project_a', 'Test Project A', :'client_a', 'active', :'tenant_a'),
  (:'project_b', 'Test Project B', :'client_b', 'active', :'tenant_b')
ON CONFLICT (id) DO NOTHING;

-- Impersonate an authenticated user
SET LOCAL ROLE authenticated;

-- Test 1: user_a + tenant_a should see 1 project balance
SET LOCAL request.jwt.claim.sub = :'user_a';
SET LOCAL request.headers = '{"x-app-tenant":"11111111-1111-1111-1111-111111111111"}';
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Test 1 FAILED: expected 1 project balance for tenant_a, got %', v_count;
  END IF;
  RAISE NOTICE 'Test 1 OK: user_a in tenant_a sees 1 project balance';
END $$;

-- Test 2: user_a + tenant_b should see 0 project balances
SET LOCAL request.headers = '{"x-app-tenant":"22222222-2222-2222-2222-222222222222"}';
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Test 2 FAILED: expected 0 project balances for user_a in tenant_b, got %', v_count;
  END IF;
  RAISE NOTICE 'Test 2 OK: user_a in tenant_b sees 0 project balances';
END $$;

-- Test 3: user_b + tenant_b should see 1 project balance
SET LOCAL request.jwt.claim.sub = :'user_b';
SET LOCAL request.headers = '{"x-app-tenant":"22222222-2222-2222-2222-222222222222"}';
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.project_balances;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Test 3 FAILED: expected 1 project balance for tenant_b, got %', v_count;
  END IF;
  RAISE NOTICE 'Test 3 OK: user_b in tenant_b sees 1 project balance';
END $$;

ROLLBACK;
