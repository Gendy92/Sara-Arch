-- v267: Unified migration for all recent stability and feature changes.
-- Run this once in Supabase SQL Editor to apply everything from v263 to v266.
-- All statements are idempotent, so running it again is safe.

-- ─────────────────────────────────────────────────────────────
-- v263: Front-end error tracking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message TEXT,
  stack TEXT,
  url TEXT,
  user_id UUID,
  tenant_id UUID,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_errors_select_admin ON public.app_errors;
CREATE POLICY app_errors_select_admin
  ON public.app_errors
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

CREATE OR REPLACE FUNCTION public.log_app_error(payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.app_errors (message, stack, url, user_id, tenant_id, user_agent)
  VALUES (
    payload->>'message',
    payload->>'stack',
    payload->>'url',
    NULLIF(payload->>'user_id', '')::UUID,
    NULLIF(payload->>'tenant_id', '')::UUID,
    payload->>'user_agent'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_app_error(JSONB) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- v264: Automated migration tracking and runner
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

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
  INSERT INTO public.schema_migrations (version) VALUES (p_version);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_migration(TEXT, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- v265: Automatic local backup logs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_name TEXT,
  tenant_id UUID,
  device_info JSONB,
  status TEXT,
  counts JSONB,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backup_logs_insert_own ON public.backup_logs;
CREATE POLICY backup_logs_insert_own
  ON public.backup_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS backup_logs_select_own ON public.backup_logs;
CREATE POLICY backup_logs_select_own
  ON public.backup_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS backup_logs_select_admin ON public.backup_logs;
CREATE POLICY backup_logs_select_admin
  ON public.backup_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- v266: Admin direct password reset (no email required)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_app_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  profile_role TEXT;
  meta_role TEXT;
BEGIN
  SELECT role INTO profile_role FROM public.profiles WHERE id = user_uuid;
  SELECT raw_user_meta_data ->> 'role' INTO meta_role FROM auth.users WHERE id = user_uuid;
  RETURN COALESCE(profile_role, '') = 'admin' OR COALESCE(meta_role, '') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_user_id UUID,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf'))
  WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- v268: Harden profiles self-signup RLS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
CREATE POLICY "profiles_self_insert"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'user');

-- ─────────────────────────────────────────────────────────────
-- Mark these versions as applied so the CI runner skips them
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.schema_migrations (version)
VALUES ('263'), ('264'), ('265'), ('266'), ('268')
ON CONFLICT (version) DO NOTHING;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
