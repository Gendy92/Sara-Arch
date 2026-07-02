-- v289: Admin "email new password" feature
-- Creates an RPC that generates a random password, saves it to auth.users,
-- and sends it to the provided email address via Resend.
--
-- PREREQUISITE: enable the "net" extension in Supabase (Database -> Extensions).
--
-- AFTER DEPLOYING, open the Supabase SQL Editor and run (replace with your values):
--   INSERT INTO public.app_settings (key, value)
--   VALUES ('resend_api_key', 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
--   INSERT INTO public.app_settings (key, value)
--   VALUES ('email_sender', 'Sara Arch <noreply@yourdomain.com>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- The Resend API key and sender domain must be verified in your Resend account.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS net;

CREATE OR REPLACE FUNCTION public.admin_reset_password_email(
  p_user_id UUID,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_pass TEXT;
  api_key TEXT;
  sender TEXT;
  payload JSONB;
BEGIN
  IF NOT is_app_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin only');
  END IF;

  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email address');
  END IF;

  -- Generate a 20-character hex password
  new_pass := encode(extensions.gen_random_bytes(10), 'hex');

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_pass, extensions.gen_salt('bf'))
  WHERE id = p_user_id;

  -- Read Resend credentials from app_settings (configured after deploy)
  SELECT value INTO api_key FROM public.app_settings WHERE key = 'resend_api_key';
  SELECT value INTO sender FROM public.app_settings WHERE key = 'email_sender';

  IF api_key IS NULL OR sender IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email settings not configured (resend_api_key / email_sender)');
  END IF;

  payload := jsonb_build_object(
    'from', sender,
    'to', p_email,
    'subject', 'Sara Arch - كلمة المرور الجديدة',
    'text', 'مرحباً،' || E'

' || 'تم إعادة تعيين كلمة المرور الخاصة بك. كلمة المرور الجديدة هي:' || E'

' || new_pass || E'

' || 'يرجى تغييرها فور تسجيل الدخول.' || E'

' || 'سارة أبو العلا'
  );

  PERFORM extensions.net.http_post(
    'https://api.resend.com/emails',
    jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    payload
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_password_email(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_password_email(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
