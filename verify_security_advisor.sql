-- Verification script for the Supabase Security Advisor findings fixed in v270.
-- Run this in the Supabase SQL Editor and confirm every check returns "OK".

-- 1. Check the 6 flagged views are now security_invoker
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
    SELECT reloptions @> ARRAY['security_invoker=true']
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

-- 2. Check schema_migrations has RLS enabled
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

-- 3. Sanity-check that views still return data for the default tenant
--    (replace the UUID below with your actual default tenant id if different)
SELECT
  (SELECT COUNT(*) FROM project_balances) AS project_balance_rows,
  (SELECT COUNT(*) FROM client_balances) AS client_balance_rows,
  (SELECT COUNT(*) FROM vendor_balances) AS vendor_balance_rows,
  (SELECT COUNT(*) FROM office_balance) AS office_balance_rows,
  (SELECT COUNT(*) FROM office_transactions_view) AS office_tx_rows,
  (SELECT COUNT(*) FROM project_transactions_view) AS project_tx_rows;
