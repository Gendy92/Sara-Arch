-- migration_v294_retention_and_supervision_audit.sql
-- Implements approved retention/holdback tracking and supervision period-close audit rows.

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 1. Schema changes                                           │
-- └─────────────────────────────────────────────────────────────┘

-- Retention percentage per project
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS retention_percentage NUMERIC DEFAULT 0
  CHECK (retention_percentage BETWEEN 0 AND 100);

UPDATE projects SET retention_percentage = 0 WHERE retention_percentage IS NULL;

-- System-generated flag for audit rows + generic link column for generated companion rows
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS system_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES transactions(id);

UPDATE transactions SET system_generated = false WHERE system_generated IS NULL;

-- Period-close tracking for supervision audit rows
CREATE TABLE IF NOT EXISTS project_period_closes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  supervision_transaction_id UUID REFERENCES transactions(id),
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  closed_by UUID,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID,
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Tenant + updated_at triggers for the new table
DROP TRIGGER IF EXISTS project_period_closes_tenant ON project_period_closes;
CREATE TRIGGER project_period_closes_tenant
  BEFORE INSERT OR UPDATE ON project_period_closes
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS project_period_closes_u ON project_period_closes;
CREATE TRIGGER project_period_closes_u
  BEFORE UPDATE ON project_period_closes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for project_period_closes
ALTER TABLE project_period_closes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_period_closes_read ON project_period_closes;
DROP POLICY IF EXISTS project_period_closes_admin ON project_period_closes;
CREATE POLICY project_period_closes_read ON project_period_closes
  FOR SELECT TO authenticated
  USING (tenant_id = get_current_tenant_id());
CREATE POLICY project_period_closes_admin ON project_period_closes
  FOR ALL TO authenticated
  USING (is_app_admin() AND tenant_id = get_current_tenant_id())
  WITH CHECK (is_app_admin());

-- Expand transaction type enum
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (
  type IN (
    'project_deposit','project_expense','office_expense','owner_deposit',
    'income','expense','deposit','withdrawal','supervision','client_return',
    'vendor_settlement','custody_return','transfer',
    'retention_withheld','retention_released'
  )
);

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 2. Balance views                                            │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW public.project_balances WITH (security_invoker = true) AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.client_id,
  COALESCE(p.value, 0) AS value,
  COALESCE(d.amt, 0) - COALESCE(cr.amt, 0) AS deposits,
  COALESCE(e.amt, 0) AS expenses,
  COALESCE(de.amt, 0) AS design_expenses,
  COALESCE(e.amt, 0) - COALESCE(de.amt, 0) AS construction_expenses,
  COALESCE(sv.amt, 0) AS supervision,
  COALESCE(rw.amt, 0) AS retention_withheld,
  COALESCE(rr.amt, 0) AS retention_released,
  COALESCE(d.amt, 0) - COALESCE(cr.amt, 0)
    - COALESCE(e.amt, 0)
    - COALESCE(sv.amt, 0)
    - COALESCE(rw.amt, 0)
    + COALESCE(rr.amt, 0) AS balance
FROM projects p
LEFT JOIN (
  SELECT project_id, SUM(amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type = 'project_deposit' GROUP BY project_id
) d ON d.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type = 'client_return' GROUP BY project_id
) cr ON cr.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(paid_amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type IN ('project_expense','vendor_settlement') GROUP BY project_id
) e ON e.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(paid_amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type IN ('project_expense','vendor_settlement') AND expense_category = 'design' GROUP BY project_id
) de ON de.project_id = p.id
LEFT JOIN (
  SELECT t.project_id,
         ROUND(SUM(COALESCE(t.paid_amount, 0) * COALESCE(pss.percentage, p.supervision_percentage) / 100.0), 2) AS amt
  FROM transactions t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN project_section_supervision pss ON pss.project_id = p.id AND pss.section_id = t.section_id
  WHERE t.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND t.type IN ('project_expense','vendor_settlement')
    AND t.expense_category != 'design'
  GROUP BY t.project_id
) sv ON sv.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type = 'retention_withheld' GROUP BY project_id
) rw ON rw.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(amount) AS amt FROM transactions WHERE deleted_at IS NULL AND type = 'retention_released' GROUP BY project_id
) rr ON rr.project_id = p.id
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.client_balances WITH (security_invoker = true) AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  COALESCE(SUM(pb.deposits), 0) AS total_deposits,
  COALESCE(SUM(pb.expenses), 0) AS total_expenses,
  COALESCE(SUM(pb.supervision), 0) AS total_supervision,
  COALESCE(SUM(pb.retention_withheld), 0) AS retention_withheld,
  COALESCE(SUM(pb.retention_released), 0) AS retention_released,
  COALESCE(SUM(pb.balance), 0) AS balance
FROM clients c
LEFT JOIN project_balances pb ON pb.client_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name;

-- Office views remain unchanged; supervision is still derived from project_balances.
GRANT SELECT ON public.project_balances TO authenticated;
GRANT SELECT ON public.client_balances TO authenticated;

-- project_transactions_view now includes actual supervision audit rows
CREATE OR REPLACE VIEW public.project_transactions_view WITH (security_invoker = true) AS
SELECT
  t.id,
  t.created_at,
  t.type,
  t.amount,
  t.description,
  t.party_name,
  t.project_name,
  t.vendor_name,
  t.employee_name,
  t.sector_name,
  t.item_name,
  t.section_name,
  t.expense_category,
  t.payment_method,
  t.payment_term,
  t.paid_amount,
  t.system_generated
FROM transactions t
WHERE t.deleted_at IS NULL
  AND t.type IN ('project_deposit','project_expense','client_return','vendor_settlement','retention_withheld','retention_released','supervision');

GRANT SELECT ON public.project_transactions_view TO authenticated;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 3. RPC: close / reopen project period                       │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION close_project_period(
  p_project_id UUID,
  p_end_date DATE,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := get_current_tenant_id();
  v_project projects%ROWTYPE;
  v_start DATE;
  v_supervision NUMERIC;
  v_tx_id UUID;
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Only admins can close a project period';
  END IF;

  SELECT * INTO v_project FROM projects
  WHERE id = p_project_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or not in current tenant';
  END IF;

  SELECT MAX(period_end) + INTERVAL '1 day'
  INTO v_start
  FROM project_period_closes
  WHERE project_id = p_project_id AND reopened_at IS NULL;

  IF v_start IS NULL THEN
    v_start := COALESCE(v_project.start_date, CURRENT_DATE);
  END IF;

  IF v_start > p_end_date THEN
    RAISE EXCEPTION 'Period start (%) cannot be after period end (%)', v_start, p_end_date;
  END IF;

  SELECT COALESCE(ROUND(SUM(
    COALESCE(t.paid_amount, 0) * COALESCE(pss.percentage, v_project.supervision_percentage) / 100.0
  ), 2), 0)
  INTO v_supervision
  FROM transactions t
  LEFT JOIN project_section_supervision pss ON pss.project_id = t.project_id AND pss.section_id = t.section_id
  WHERE t.deleted_at IS NULL
    AND t.project_id = p_project_id
    AND t.type IN ('project_expense','vendor_settlement')
    AND t.expense_category != 'design'
    AND t.date BETWEEN v_start AND p_end_date
    AND COALESCE(t.system_generated, false) = false;

  INSERT INTO transactions (
    type, amount, project_id, project_name, client_id, client_name,
    date, description, system_generated, created_by
  ) VALUES (
    'supervision', v_supervision, p_project_id, v_project.name,
    v_project.client_id, v_project.client_name, p_end_date,
    'إشراف دورة ' || v_start || ' إلى ' || p_end_date,
    true, p_user_id
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO project_period_closes (
    project_id, period_start, period_end, supervision_transaction_id,
    closed_by, tenant_id
  ) VALUES (
    p_project_id, v_start, p_end_date, v_tx_id, p_user_id, v_tenant_id
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION reopen_project_period(
  p_close_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := get_current_tenant_id();
  v_close project_period_closes%ROWTYPE;
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Only admins can reopen a project period';
  END IF;

  SELECT * INTO v_close FROM project_period_closes
  WHERE id = p_close_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Period close not found or not in current tenant';
  END IF;

  IF v_close.reopened_at IS NOT NULL THEN
    RAISE EXCEPTION 'Period is already reopened';
  END IF;

  UPDATE project_period_closes
  SET reopened_at = NOW(), reopened_by = p_user_id, updated_at = NOW(), updated_by = p_user_id
  WHERE id = p_close_id;

  IF v_close.supervision_transaction_id IS NOT NULL THEN
    UPDATE transactions
    SET deleted_at = NOW(), updated_by = p_user_id
    WHERE id = v_close.supervision_transaction_id;
  END IF;
END;
$$;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 4. Trigger: auto-create retention_withheld on deposits      │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION sync_retention_on_deposit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project projects%ROWTYPE;
  v_withheld NUMERIC;
  v_existing UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'project_deposit' AND OLD.linked_transaction_id IS NOT NULL THEN
      UPDATE transactions
      SET deleted_at = NOW(), updated_by = OLD.updated_by
      WHERE id = OLD.linked_transaction_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Treat soft-deleted deposits as deletion for linked retention rows
  IF NEW.type = 'project_deposit' AND NEW.deleted_at IS NOT NULL THEN
    UPDATE transactions
    SET deleted_at = NOW(), updated_by = NEW.updated_by
    WHERE linked_transaction_id = NEW.id
      AND type = 'retention_withheld'
      AND deleted_at IS NULL;
    RETURN NEW;
  END IF;

  IF NEW.type = 'project_deposit' AND COALESCE(NEW.system_generated, false) = false THEN
    SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;

    IF FOUND AND COALESCE(v_project.retention_percentage, 0) > 0 THEN
      v_withheld := ROUND(NEW.amount * v_project.retention_percentage / 100.0, 2);

      IF v_withheld > 0 THEN
        SELECT id INTO v_existing
        FROM transactions
        WHERE linked_transaction_id = NEW.id
          AND type = 'retention_withheld'
          AND deleted_at IS NULL;

        IF FOUND THEN
          UPDATE transactions
          SET amount = v_withheld,
              date = NEW.date,
              description = 'ضمان أعمال عن عربون ' || COALESCE(NEW.description, ''),
              updated_at = NOW(),
              updated_by = NEW.updated_by
          WHERE id = v_existing;
        ELSE
          INSERT INTO transactions (
            type, amount, project_id, project_name, client_id, client_name,
            date, description, linked_transaction_id, system_generated, created_by
          ) VALUES (
            'retention_withheld', v_withheld, NEW.project_id, NEW.project_name,
            NEW.client_id, NEW.client_name, NEW.date,
            'ضمان أعمال عن عربون ' || COALESCE(NEW.description, ''),
            NEW.id, false, NEW.created_by
          );
        END IF;
      ELSE
        UPDATE transactions
        SET deleted_at = NOW(), updated_by = NEW.updated_by
        WHERE linked_transaction_id = NEW.id
          AND type = 'retention_withheld'
          AND deleted_at IS NULL;
      END IF;
    ELSE
      UPDATE transactions
      SET deleted_at = NOW(), updated_by = NEW.updated_by
      WHERE linked_transaction_id = NEW.id
        AND type = 'retention_withheld'
        AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_retention_sync ON transactions;
CREATE TRIGGER transactions_retention_sync
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION sync_retention_on_deposit();


-- ┌─────────────────────────────────────────────────────────────┐
-- │ 5. Indexes for new columns                                  │
-- └─────────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_transactions_linked_transaction_id
  ON public.transactions(linked_transaction_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_system_generated
  ON public.transactions(system_generated) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_period_closes_project_id
  ON public.project_period_closes(project_id) WHERE deleted_at IS NULL;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
