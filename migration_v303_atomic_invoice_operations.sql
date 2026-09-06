-- Migration v303 — Atomic invoice operations
-- Replaces the multi-step JS save/delete dance for invoices with transactional RPCs.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Upsert invoice + replace items in one transaction    │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.upsert_invoice_with_items(
  p_invoice_id UUID DEFAULT NULL,
  p_invoice JSONB DEFAULT '{}'::JSONB,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := get_current_tenant_id();
  v_user_id UUID := auth.uid();
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_client_id UUID;
  v_client_name TEXT;
  v_project_id UUID;
  v_project_name TEXT;
  v_issue_date DATE;
  v_due_date DATE;
  v_status TEXT;
  v_amount NUMERIC;
  v_notes TEXT;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context is missing';
  END IF;

  v_invoice_number := p_invoice->>'invoice_number';
  v_client_id := NULLIF(p_invoice->>'client_id', '')::UUID;
  v_client_name := p_invoice->>'client_name';
  v_project_id := NULLIF(p_invoice->>'project_id', '')::UUID;
  v_project_name := p_invoice->>'project_name';
  v_issue_date := NULLIF(p_invoice->>'issue_date', '')::DATE;
  v_due_date := NULLIF(p_invoice->>'due_date', '')::DATE;
  v_status := COALESCE(p_invoice->>'status', 'draft');
  v_amount := COALESCE((p_invoice->>'amount')::NUMERIC, 0);
  v_notes := p_invoice->>'notes';

  IF p_invoice_id IS NULL THEN
    INSERT INTO public.invoices (
      invoice_number, client_id, client_name, project_id, project_name,
      issue_date, due_date, status, amount, notes, tenant_id, created_by
    ) VALUES (
      v_invoice_number, v_client_id, v_client_name, v_project_id, v_project_name,
      v_issue_date, v_due_date, v_status, v_amount, v_notes, v_tenant_id, v_user_id
    )
    RETURNING id INTO v_invoice_id;
  ELSE
    v_invoice_id := p_invoice_id;
    UPDATE public.invoices
    SET
      invoice_number = v_invoice_number,
      client_id = v_client_id,
      client_name = v_client_name,
      project_id = v_project_id,
      project_name = v_project_name,
      issue_date = v_issue_date,
      due_date = v_due_date,
      status = v_status,
      amount = v_amount,
      notes = v_notes,
      updated_by = v_user_id,
      updated_at = NOW()
    WHERE id = v_invoice_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice not found or tenant mismatch';
    END IF;

    -- Soft-delete existing items so we can replace them atomically.
    UPDATE public.invoice_items
    SET deleted_at = NOW(), updated_by = v_user_id, updated_at = NOW()
    WHERE invoice_id = v_invoice_id AND tenant_id = v_tenant_id AND deleted_at IS NULL;
  END IF;

  -- Insert new items.
  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price, sort_order, tenant_id, created_by
  )
  SELECT
    v_invoice_id,
    x->>'description',
    COALESCE((x->>'quantity')::NUMERIC, 1),
    COALESCE((x->>'unit_price')::NUMERIC, 0),
    COALESCE((x->>'sort_order')::INT, 0),
    v_tenant_id,
    v_user_id
  FROM jsonb_array_elements(p_items) AS x;

  RETURN jsonb_build_object('id', v_invoice_id);
END;
$$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Record invoice payment atomically                    │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'cash',
  p_date DATE DEFAULT CURRENT_DATE,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := get_current_tenant_id();
  v_user_id UUID := auth.uid();
  v_inv public.invoices;
  v_remaining NUMERIC;
  v_new_paid NUMERIC;
  v_tx_id UUID;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context is missing';
  END IF;

  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = p_invoice_id AND tenant_id = v_tenant_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  v_remaining := COALESCE(v_inv.amount, 0) - COALESCE(v_inv.paid_amount, 0);

  IF p_amount <= 0 OR p_amount > v_remaining THEN
    RAISE EXCEPTION 'Invalid payment amount';
  END IF;

  INSERT INTO public.transactions (
    type, amount, paid_amount, payment_method,
    client_id, client_name, project_id, project_name,
    date, description, tenant_id, created_by
  ) VALUES (
    'project_deposit', p_amount, p_amount, COALESCE(p_payment_method, 'cash'),
    v_inv.client_id, v_inv.client_name, v_inv.project_id, v_inv.project_name,
    COALESCE(p_date, CURRENT_DATE), p_description, v_tenant_id, v_user_id
  )
  RETURNING id INTO v_tx_id;

  v_new_paid := COALESCE(v_inv.paid_amount, 0) + p_amount;

  UPDATE public.invoices
  SET
    paid_amount = v_new_paid,
    status = CASE WHEN v_new_paid >= COALESCE(v_inv.amount, 0) THEN 'paid' ELSE status END,
    payment_transaction_id = v_tx_id,
    updated_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_invoice_id AND tenant_id = v_tenant_id;

  RETURN jsonb_build_object('invoice_id', p_invoice_id, 'transaction_id', v_tx_id);
END;
$$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Soft-delete invoice + items atomically               │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.delete_invoice(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := get_current_tenant_id();
  v_user_id UUID := auth.uid();
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context is missing';
  END IF;

  UPDATE public.invoice_items
  SET deleted_at = NOW(), updated_by = v_user_id, updated_at = NOW()
  WHERE invoice_id = p_invoice_id AND tenant_id = v_tenant_id AND deleted_at IS NULL;

  UPDATE public.invoices
  SET deleted_at = NOW(), updated_by = v_user_id, updated_at = NOW()
  WHERE id = p_invoice_id AND tenant_id = v_tenant_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  RETURN jsonb_build_object('id', p_invoice_id);
END;
$$;

NOTIFY pgrst, 'reload schema';
