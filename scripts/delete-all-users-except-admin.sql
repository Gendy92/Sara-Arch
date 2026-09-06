-- One-time script: delete all users except the admin account.
-- Run this in the Supabase SQL Editor as a project owner / service_role.
--
-- What it does:
--   1. Finds the admin user by `profiles.username = 'admin'`.
--   2. Deletes all `user_permissions` rows for non-admin users.
--   3. Deletes all `profiles` rows for non-admin users.
--   4. Deletes all `auth.users` rows for non-admin users.
--
-- WARNING: This cannot be undone. Make sure you have a backup first.

DO $$
DECLARE
  v_admin_id UUID;
  v_count INT;
BEGIN
  -- 1. Identify the admin user.
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE LOWER(username) = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found. Check profiles.username.';
  END IF;

  RAISE NOTICE 'Keeping admin user %', v_admin_id;

  -- 2. Delete permissions for everyone else.
  DELETE FROM public.user_permissions
  WHERE user_id <> v_admin_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % permission rows', v_count;

  -- 3. Delete profiles for everyone else.
  DELETE FROM public.profiles
  WHERE id <> v_admin_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % profile rows', v_count;

  -- 4. Delete auth.users for everyone else.
  DELETE FROM auth.users
  WHERE id <> v_admin_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % auth.users rows', v_count;

  RAISE NOTICE 'Done. Only the admin user remains.';
END $$;
