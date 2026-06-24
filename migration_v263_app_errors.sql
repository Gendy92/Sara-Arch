-- v263: Add front-end error tracking table and RPC.
-- Run this in the Supabase SQL Editor after deploying v263.

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

-- Row-level security: only the app (via the SECURITY DEFINER function below) inserts rows.
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- Allow admins to view errors. Adjust according to your role setup.
DROP POLICY IF EXISTS app_errors_select_admin ON public.app_errors;
CREATE POLICY app_errors_select_admin
  ON public.app_errors
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

-- RPC used by the browser to report errors without exposing the table directly.
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

-- Cleanup old errors after 90 days (optional but keeps the table small).
DROP EXTENSION IF EXISTS pg_cron;
-- If pg_cron is enabled, you can schedule a cleanup job:
-- SELECT cron.schedule('cleanup-app-errors', '0 3 * * *', $$ DELETE FROM public.app_errors WHERE created_at < NOW() - INTERVAL '90 days' $$);
