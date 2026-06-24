-- v264: Automated migration tracking and runner.
-- Run this manually once in Supabase SQL Editor, then all future migrations
-- can be applied automatically by the GitHub Actions workflow.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECURITY DEFINER: only the postgres role can execute arbitrary SQL.
-- Execute privilege is granted to service_role only, so the CI job (which
-- uses the service-role key) can call it, but regular users cannot.
CREATE OR REPLACE FUNCTION public.apply_migration(p_version TEXT, p_sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.apply_migration(TEXT, TEXT) TO service_role;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
