-- Migration v243 — Real email support for users (password resets)
-- Idempotent. Run in Supabase SQL Editor as a single script.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Add email column to profiles                         │
-- └─────────────────────────────────────────────────────────┘

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
  END IF;
END $$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Recreate admin_create_auth_user to store email       │
-- └─────────────────────────────────────────────────────────┘

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.admin_create_auth_user(text, text, jsonb);

CREATE OR REPLACE FUNCTION public.admin_create_auth_user(
  user_email TEXT,
  user_password TEXT,
  user_meta JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID := gen_random_uuid();
  instance UUID;
  encrypted_pw TEXT;
  meta JSONB := COALESCE(user_meta, '{}');
  existing_id UUID;
BEGIN
  IF NOT is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT id INTO existing_id FROM auth.users WHERE email = user_email LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', existing_id, 'email', user_email, 'existing', true);
  END IF;

  SELECT instance_id INTO instance FROM auth.users LIMIT 1;
  IF instance IS NULL THEN
    instance := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  encrypted_pw := extensions.crypt(user_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    new_id, instance, 'authenticated', 'authenticated', user_email, encrypted_pw, NOW(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb, meta, NOW(), NOW()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_id,
    jsonb_build_object('sub', new_id::text, 'email', user_email),
    'email', new_id::text, NOW(), NOW(), NOW()
  );

  INSERT INTO public.profiles (id, name, username, email, role)
  VALUES (
    new_id,
    meta->>'name',
    meta->>'username',
    NULLIF(meta->>'email', ''),
    COALESCE(meta->>'role', 'user')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    role = EXCLUDED.role;

  RETURN jsonb_build_object('id', new_id, 'email', user_email, 'existing', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_auth_user(text, text, jsonb) FROM anon;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Add admin_update_auth_email for editing user email   │
-- └─────────────────────────────────────────────────────────┘

DROP FUNCTION IF EXISTS public.admin_update_auth_email(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_update_auth_email(
  p_user_id UUID,
  p_email TEXT
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

  IF p_email IS NOT NULL AND p_email <> '' THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email AND id <> p_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Email already in use');
    END IF;

    UPDATE auth.users SET email = p_email WHERE id = p_user_id;
    UPDATE auth.identities
    SET identity_data = jsonb_build_object('sub', user_id::text, 'email', p_email)
    WHERE user_id = p_user_id AND provider = 'email';
  END IF;

  UPDATE public.profiles SET email = NULLIF(p_email, '') WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_auth_email(uuid, text) FROM anon;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Refresh PostgREST cache                              │
-- └─────────────────────────────────────────────────────────┘

NOTIFY pgrst, 'reload schema';
