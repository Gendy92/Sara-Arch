-- v300: Invoicing module
-- Adds invoices, invoice_items, tenant RLS, and retention-sync-safe deposit linkage.

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT,
  project_id UUID REFERENCES public.projects(id),
  project_name TEXT,
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  payment_transaction_id UUID REFERENCES public.transactions(id),
  notes TEXT,
  tenant_id UUID,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INT DEFAULT 0,
  tenant_id UUID,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_tenant_isolation ON public.invoices;
CREATE POLICY invoices_tenant_isolation ON public.invoices
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS invoice_items_tenant_isolation ON public.invoice_items;
CREATE POLICY invoice_items_tenant_isolation ON public.invoice_items
  FOR ALL TO authenticated
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

-- Tenant_id trigger
DROP TRIGGER IF EXISTS invoices_tenant ON public.invoices;
CREATE TRIGGER invoices_tenant BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS invoice_items_tenant ON public.invoice_items;
CREATE TRIGGER invoice_items_tenant BEFORE INSERT OR UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- updated_at triggers (set_tenant_id does not touch updated_at; reuse existing helper if available)
DROP TRIGGER IF EXISTS invoices_u ON public.invoices;
CREATE TRIGGER invoices_u BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS invoice_items_u ON public.invoice_items;
CREATE TRIGGER invoice_items_u BEFORE UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- created_by triggers
DROP TRIGGER IF EXISTS invoices_cb ON public.invoices;
CREATE TRIGGER invoices_cb BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS invoice_items_cb ON public.invoice_items;
CREATE TRIGGER invoice_items_cb BEFORE INSERT ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
