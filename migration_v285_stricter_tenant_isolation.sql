-- Migration v285 — Stricter tenant isolation for clients, vendors, and transactions
--
-- Replaces the simple tenant_scope policy with one that also verifies
-- the current user is actually a member of the requested tenant.
-- Admins bypass the check.

DROP POLICY IF EXISTS tenant_scope ON public.clients;
DROP POLICY IF EXISTS tenant_scope ON public.vendors;
DROP POLICY IF EXISTS tenant_scope ON public.transactions;
DROP POLICY IF EXISTS auth_restricted_clients ON public.clients;
DROP POLICY IF EXISTS auth_restricted_vendors ON public.vendors;
DROP POLICY IF EXISTS auth_restricted_transactions ON public.transactions;
DROP POLICY IF EXISTS authenticated_all ON public.clients;
DROP POLICY IF EXISTS authenticated_all ON public.vendors;
DROP POLICY IF EXISTS authenticated_all ON public.transactions;

CREATE POLICY clients_tenant_isolation ON public.clients
  FOR ALL
  USING (
    is_app_admin(auth.uid())
    OR (
      tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = get_current_tenant_id()
      )
    )
  )
  WITH CHECK (
    is_app_admin(auth.uid())
    OR (
      tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = get_current_tenant_id()
      )
    )
  );

CREATE POLICY vendors_tenant_isolation ON public.vendors
  FOR ALL
  USING (
    is_app_admin(auth.uid())
    OR (
      tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = get_current_tenant_id()
      )
    )
  )
  WITH CHECK (
    is_app_admin(auth.uid())
    OR (
      tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = get_current_tenant_id()
      )
    )
  );

CREATE POLICY transactions_tenant_isolation ON public.transactions
  FOR ALL
  USING (
    is_app_admin(auth.uid())
    OR (
      tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = get_current_tenant_id()
      )
    )
  )
  WITH CHECK (
    is_app_admin(auth.uid())
    OR (
      tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = get_current_tenant_id()
      )
    )
  );
