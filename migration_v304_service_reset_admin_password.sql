-- v304: Emergency admin password reset, callable ONLY with the service_role key.
-- Used by the admin-password-reset workflow when dashboard access is unavailable.
-- The existing public.admin_reset_password(UUID, TEXT) is guarded by
-- is_app_admin(auth.uid()) and therefore cannot run with the service key
-- (auth.uid() IS NULL for service_role). This variant checks auth.role()
-- instead, so it is unreachable from the browser (anon/authenticated revoked).

CREATE OR REPLACE FUNCTION public.service_reset_admin_password(p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only';
  END IF;

  IF p_password IS NULL OR length(p_password) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 4 characters');
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf'))
  WHERE id = (SELECT id FROM public.profiles WHERE username = 'admin');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin profile not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.service_reset_admin_password(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.service_reset_admin_password(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.service_reset_admin_password(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
