-- Migration v286 — Lock down apply_migration RPC
--
-- apply_migration is SECURITY DEFINER and executes arbitrary SQL. It was
-- created with default public execute privileges, meaning anon and
-- authenticated roles could invoke it. This migration revokes those
-- privileges and leaves execute only on service_role (the CI runner).

REVOKE ALL ON FUNCTION public.apply_migration(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_migration(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_migration(TEXT, TEXT) TO service_role;
