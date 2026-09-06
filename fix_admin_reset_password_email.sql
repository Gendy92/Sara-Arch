-- Hotfix: make admin_reset_password_email verify the pg_net worker is running
-- and return the Resend request_id so delivery can be confirmed.
--
-- Run this in the Supabase SQL Editor after configuring Resend credentials.
--
-- Common reasons email does not arrive:
--   1. pg_net background worker is not running (this patch detects that).
--   2. Resend sender domain is not verified.
--   3. On a free/test Resend account, you can usually only send to the email
--      address used to sign up at Resend. Use onboarding@resend.dev as sender
--      for initial testing.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;

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
  request_id BIGINT;
BEGIN
  IF NOT is_app_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin only');
  END IF;

  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email address');
  END IF;

  -- The pg_net extension must be enabled AND its background worker running.
  IF NOT net.check_worker_is_up() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email worker (pg_net) is not running. Enable the pg_net extension in Supabase Database → Extensions and retry.'
    );
  END IF;

  -- Generate a 20-character hex password
  new_pass := encode(extensions.gen_random_bytes(10), 'hex');

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_pass, extensions.gen_salt('bf'))
  WHERE id = p_user_id;

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

  request_id := net.http_post(
    'https://api.resend.com/emails',
    payload,
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    10000
  );

  RETURN jsonb_build_object('success', true, 'request_id', request_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_password_email(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_password_email(UUID, TEXT) TO authenticated;

-- Helper to inspect the Resend response after a few seconds.
-- Run: SELECT public.get_email_status(<request_id>);
CREATE OR REPLACE FUNCTION public.get_email_status(p_request_id BIGINT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status_code', status_code,
    'body', content,
    'error', error_msg,
    'created', created
  )
  FROM net._http_response
  WHERE id = p_request_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_email_status(BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_email_status(BIGINT) TO authenticated;

NOTIFY pgrst, 'reload schema';
