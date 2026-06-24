-- v265: Log automatic local backups with device and user details.
-- Applied automatically by CI after migration runner v264 is active.

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

-- Admins can see all backup logs.
DROP POLICY IF EXISTS backup_logs_select_admin ON public.backup_logs;
CREATE POLICY backup_logs_select_admin
  ON public.backup_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

NOTIFY pgrst, 'reload schema';
