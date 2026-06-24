-- Migration v270 — Address Supabase Security Advisor findings
--   1. Switch the 6 balance/transaction views to security_invoker so they
--      respect the tenant-scoped RLS policies on their underlying tables.
--   2. Enable RLS on schema_migrations (only the migration runner / postgres
--      owner needs access; app users have no policies).
--
-- Idempotent and safe to re-run.

DO $$
BEGIN
  -- security_invoker on views requires Postgres 15+
  IF current_setting('server_version_num')::int >= 150000 THEN
    ALTER VIEW IF EXISTS public.project_balances SET (security_invoker = true);
    ALTER VIEW IF EXISTS public.client_balances SET (security_invoker = true);
    ALTER VIEW IF EXISTS public.vendor_balances SET (security_invoker = true);
    ALTER VIEW IF EXISTS public.office_balance SET (security_invoker = true);
    ALTER VIEW IF EXISTS public.office_transactions_view SET (security_invoker = true);
    ALTER VIEW IF EXISTS public.project_transactions_view SET (security_invoker = true);
  END IF;
END $$;

ALTER TABLE IF EXISTS public.schema_migrations ENABLE ROW LEVEL SECURITY;
