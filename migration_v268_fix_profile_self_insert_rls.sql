-- v268: Prevent users from creating their own profile with admin role during self-signup.
-- Applied automatically by CI after migration runner v264 is active.

DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
CREATE POLICY "profiles_self_insert"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'user');

NOTIFY pgrst, 'reload schema';
