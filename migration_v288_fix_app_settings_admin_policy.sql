-- Migration v288 — Fix app_settings admin RLS policy
--
-- The original policy checked profiles.role = 'admin' directly, which
-- failed for admins whose role is stored in auth.users metadata or who
-- hit RLS recursion. This aligns app_settings with the rest of the
-- schema by using the is_app_admin() helper.

DROP POLICY IF EXISTS app_settings_write ON public.app_settings;

CREATE POLICY app_settings_write ON public.app_settings
  FOR ALL
  TO authenticated
  USING (is_app_admin(auth.uid()))
  WITH CHECK (is_app_admin(auth.uid()));
