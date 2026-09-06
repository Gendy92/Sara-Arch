-- Migration v302 — Security Advisor hardening
-- Applies the most actionable Security Advisor findings automatically.
--
-- What it does:
--   1. Fixes mutable search_path on apply_migration.
--   2. Drops leftover helper functions flagged by the linter.
--   3. Revokes anon EXECUTE on every public function except log_app_error.
--   4. Revokes authenticated EXECUTE on trigger functions (triggers still work).
--   5. Re-applies the safe grants we actually need.
--
-- Warnings that remain after this migration (accepted/expected):
--   - authenticated users can execute SECURITY DEFINER RPCs such as dashboard_*
--     and admin_* — each function performs its own authorization check.
--   - pg_net is installed in the public schema — required by the Resend integration.
--   - schema_migrations and app_error_throttle have RLS enabled but no policies —
--     intentional internal-only tables.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Fix mutable search_path on apply_migration           │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.apply_migration(p_version TEXT, p_sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = p_version) THEN
    RETURN;
  END IF;

  EXECUTE p_sql;

  INSERT INTO public.schema_migrations (version)
  VALUES (p_version);
END;
$$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Drop leftover helper functions                       │
-- └─────────────────────────────────────────────────────────┘

DROP FUNCTION IF EXISTS public.__auth_users_cols();
DROP FUNCTION IF EXISTS public.__apply_migration_acl();
DROP FUNCTION IF EXISTS public.__apply_migration_acl2();

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Revoke anon EXECUTE on all functions except          │
-- │    log_app_error                                        │
-- └─────────────────────────────────────────────────────────┘

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname != 'log_app_error'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.fn);
  END LOOP;
END $$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Revoke authenticated EXECUTE on trigger functions    │
-- │    (triggers themselves still run as table owner)       │
-- └─────────────────────────────────────────────────────────┘

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT p.oid::regprocedure AS fn
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.fn);
  END LOOP;
END $$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. Re-apply safe grants                                 │
-- └─────────────────────────────────────────────────────────┘

-- Anonymous users can report JS errors.
GRANT EXECUTE ON FUNCTION public.log_app_error(JSONB) TO anon, authenticated;

-- Only service_role may run migrations.
GRANT EXECUTE ON FUNCTION public.apply_migration(TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.apply_migration(TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_migration(TEXT, TEXT) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
