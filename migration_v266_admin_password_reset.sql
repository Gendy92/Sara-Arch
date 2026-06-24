-- v266: Allow admins to reset a user's password directly.
-- Applied automatically by CI after migration runner v264 is active.

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
  IF NOT is_app_admin(auth.uid()) THEN
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

NOTIFY pgrst, 'reload schema';
