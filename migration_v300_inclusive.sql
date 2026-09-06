-- v300 inclusive migration
-- Applies all pending migrations in one file: v294, v296, v298, v300
-- Run this in the Supabase SQL Editor if the v264 migration runner is not yet active.

-- migration_v294_retention_and_supervision_audit.sql
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

-- Drop dependent views first so we can change the project_balances column list.
DROP VIEW IF EXISTS public.office_transactions_view CASCADE;
DROP VIEW IF EXISTS public.office_balance CASCADE;
DROP VIEW IF EXISTS public.client_balances CASCADE;
DROP VIEW IF EXISTS public.project_balances CASCADE;
DROP VIEW IF EXISTS public.project_transactions_view CASCADE;

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

CREATE OR REPLACE VIEW public.office_balance WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    COALESCE(SUM(CASE WHEN t.type IN ('owner_deposit','income') AND COALESCE(t.payment_method,'cash') = 'cash' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.type IN ('office_expense','withdrawal') AND COALESCE(t.payment_method,'cash') = 'cash' THEN t.amount ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN t.type = 'custody_return' AND COALESCE(t.payment_method,'cash') = 'cash' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.type = 'transfer' AND COALESCE(t.payment_method,'cash') = 'cash' THEN t.amount ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.transfer_to = 'cash' THEN t.amount ELSE 0 END), 0) AS cash_balance,
    COALESCE(SUM(CASE WHEN t.type IN ('owner_deposit','income') AND t.payment_method = 'bank' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.type IN ('office_expense','withdrawal') AND t.payment_method = 'bank' THEN t.amount ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN t.type = 'custody_return' AND t.payment_method = 'bank' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.payment_method = 'bank' THEN t.amount ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.transfer_to = 'bank' THEN t.amount ELSE 0 END), 0) AS bank_balance,
    COALESCE((SELECT SUM(pb.supervision) FROM project_balances pb JOIN projects p ON p.id = pb.project_id WHERE p.deleted_at IS NULL), 0) AS supervision_income,
    COALESCE((SELECT SUM(t2.paid_amount) FROM transactions t2 JOIN vendors v ON v.id = t2.vendor_id WHERE t2.deleted_at IS NULL AND v.is_office IS TRUE AND t2.type = 'vendor_settlement'), 0)
    +
    COALESCE((SELECT SUM(p.paid_amount) FROM procurements p JOIN vendors v ON v.id = p.vendor_id WHERE p.deleted_at IS NULL AND v.is_office IS TRUE), 0) AS office_vendor_income
  FROM transactions t
  WHERE t.deleted_at IS NULL AND t.type IN ('owner_deposit','office_expense','withdrawal','custody_return','income','transfer')
)
SELECT
  cash_balance,
  bank_balance,
  cash_balance + bank_balance AS liquid_balance,
  supervision_income + office_vendor_income AS other_income,
  cash_balance + bank_balance + supervision_income + office_vendor_income AS total_balance
FROM base;

CREATE OR REPLACE VIEW public.office_transactions_view WITH (security_invoker = true) AS
SELECT
  t.id,
  t.created_at,
  t.type,
  t.amount,
  t.payment_method,
  t.description,
  t.employee_name,
  t.sector_name,
  t.vendor_name
FROM transactions t
WHERE t.deleted_at IS NULL AND t.type IN ('owner_deposit','office_expense','withdrawal','income')
UNION ALL
SELECT
  t.id,
  t.created_at,
  'office_income'::TEXT AS type,
  t.paid_amount AS amount,
  COALESCE(t.payment_method, 'cash') AS payment_method,
  ('إيراد مكتب - ' || COALESCE(t.description, ''))::TEXT AS description,
  t.employee_name,
  t.sector_name,
  v.name AS vendor_name
FROM transactions t
JOIN vendors v ON v.id = t.vendor_id
WHERE t.deleted_at IS NULL AND v.is_office IS TRUE AND t.type IN ('project_expense','vendor_settlement')
UNION ALL
SELECT
  NULL::UUID AS id,
  p.created_at,
  'supervision'::TEXT AS type,
  pb.supervision AS amount,
  'cash'::TEXT AS payment_method,
  ('إشراف ' || p.name)::TEXT AS description,
  '-'::TEXT AS employee_name,
  '-'::TEXT AS sector_name,
  '-'::TEXT AS vendor_name
FROM project_balances pb
JOIN projects p ON p.id = pb.project_id
WHERE pb.supervision > 0
UNION ALL
SELECT
  t.id,
  t.created_at,
  'custody_return'::TEXT AS type,
  t.amount,
  COALESCE(t.payment_method, 'cash') AS payment_method,
  ('رد عهدة - ' || COALESCE(t.description, ''))::TEXT AS description,
  t.employee_name,
  t.sector_name,
  NULL::TEXT AS vendor_name
FROM transactions t
WHERE t.deleted_at IS NULL AND t.type = 'custody_return'
UNION ALL
SELECT
  t.id,
  t.created_at,
  'transfer'::TEXT AS type,
  t.amount,
  COALESCE(t.payment_method, 'cash') AS payment_method,
  ('تحويل من ' || CASE WHEN t.payment_method = 'bank' THEN 'بنكي' ELSE 'نقدي' END || ' إلى ' || CASE WHEN t.transfer_to = 'bank' THEN 'بنكي' ELSE 'نقدي' END || COALESCE(' - ' || t.description, ''))::TEXT AS description,
  NULL::TEXT AS employee_name,
  NULL::TEXT AS sector_name,
  NULL::TEXT AS vendor_name
FROM transactions t
WHERE t.deleted_at IS NULL AND t.type = 'transfer';

GRANT SELECT ON public.project_balances TO authenticated;
GRANT SELECT ON public.client_balances TO authenticated;
GRANT SELECT ON public.office_balance TO authenticated;
GRANT SELECT ON public.office_transactions_view TO authenticated;

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

-- migration_v296_custody_ledger.sql
-- Migration v296 — Unify custody spent/returned ledger
-- Idempotent. Run in Supabase SQL Editor as a single script.
-- Adds a `type` column to custody_expenses (`spent` | `returned`) so the
-- full custody ledger (expenses + cash returns) lives in one table.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Schema change: add type column                       │
-- └─────────────────────────────────────────────────────────┘

ALTER TABLE custody_expenses
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'spent'
  CHECK (type IN ('spent','returned'));

-- Backfill existing rows as spent expenses.
UPDATE custody_expenses SET type = 'spent' WHERE type IS NULL;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Recompute state function (split spent / returned)    │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION custody_recompute_state(p_custody_id UUID)
RETURNS void AS $$
DECLARE
  v_amount NUMERIC;
  v_spent NUMERIC;
  v_returned_cash NUMERIC;
  v_remaining NUMERIC;
  v_status TEXT;
BEGIN
  SELECT COALESCE(amount,0)
  INTO v_amount
  FROM custody_records WHERE id = p_custody_id;

  SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'spent' OR type IS NULL), 0),
         COALESCE(SUM(amount) FILTER (WHERE type = 'returned'), 0)
  INTO v_spent, v_returned_cash
  FROM custody_expenses
  WHERE custody_id = p_custody_id AND deleted_at IS NULL;

  v_remaining := GREATEST(v_amount - v_spent - v_returned_cash, 0);

  IF v_remaining <= 0 THEN
    v_status := 'settled';
  ELSIF v_spent + v_returned_cash > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'active';
  END IF;

  UPDATE custody_records
  SET returned_amount = v_spent,
      returned_cash_amount = v_returned_cash,
      remaining_balance = v_remaining,
      status = v_status
  WHERE id = p_custody_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Expense limit check (respects spent/returned split)  │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION custody_expense_limit_check()
RETURNS TRIGGER AS $$
DECLARE
  v_amount NUMERIC;
  v_other_spent NUMERIC;
  v_other_returned NUMERIC;
  v_current_amount NUMERIC := 0;
  v_available NUMERIC;
BEGIN
  SELECT COALESCE(amount,0)
  INTO v_amount
  FROM custody_records WHERE id = NEW.custody_id;

  IF TG_OP = 'UPDATE' THEN
    v_current_amount := COALESCE(OLD.amount,0);
  END IF;

  SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'spent' OR type IS NULL), 0),
         COALESCE(SUM(amount) FILTER (WHERE type = 'returned'), 0)
  INTO v_other_spent, v_other_returned
  FROM custody_expenses
  WHERE custody_id = NEW.custody_id
    AND deleted_at IS NULL
    AND id IS DISTINCT FROM COALESCE(OLD.id, NULL);

  v_available := v_amount - v_other_spent - v_other_returned + v_current_amount;

  IF NEW.amount > v_available THEN
    RAISE EXCEPTION 'مبلغ المصروف (%) يتجاوز الرصيد المتاح (%)', NEW.amount, v_available;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Return limit check (split spent / returned)          │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION custody_return_limit_check()
RETURNS TRIGGER AS $$
DECLARE
  v_spent NUMERIC;
  v_returned NUMERIC;
  v_available NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'spent' OR type IS NULL), 0),
         COALESCE(SUM(amount) FILTER (WHERE type = 'returned'), 0)
  INTO v_spent, v_returned
  FROM custody_expenses
  WHERE custody_id = NEW.id AND deleted_at IS NULL;

  IF NEW.returned_cash_amount IS DISTINCT FROM OLD.returned_cash_amount THEN
    v_available := NEW.amount - v_spent;
    IF NEW.returned_cash_amount > v_available THEN
      RAISE EXCEPTION 'مبلغ السداد (%) يتجاوز الرصيد المتبقي (%)', NEW.returned_cash_amount, v_available;
    END IF;
  END IF;

  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    IF NEW.amount < v_spent + NEW.returned_cash_amount THEN
      RAISE EXCEPTION 'لا يمكن تقليل مبلغ العهدة عن مجموع المصروفات والسداد (%).', v_spent + NEW.returned_cash_amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. custody_records state trigger with recursion guard   │
-- └─────────────────────────────────────────────────────────┘
-- custody_recompute_state() UPDATEs custody_records, so the AFTER trigger
-- must not re-fire when it is invoked from inside the trigger itself.

CREATE OR REPLACE FUNCTION custody_records_state_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  PERFORM custody_recompute_state(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS custody_records_state_t ON custody_records;
CREATE TRIGGER custody_records_state_t
AFTER INSERT OR UPDATE OF amount, returned_cash_amount ON custody_records
FOR EACH ROW EXECUTE FUNCTION custody_records_state_trigger();

-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. Refresh all existing custody records                 │
-- └─────────────────────────────────────────────────────────┘

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM custody_records WHERE deleted_at IS NULL LOOP
    PERFORM custody_recompute_state(rec.id);
  END LOOP;
END $$;

-- migration_v298_aging_report.sql
-- v298: Aging (A/R and A/P) report views
-- Adds client receivables and vendor payables aging buckets.

-- Per-project last activity date for client/project transactions.
CREATE OR REPLACE VIEW public.report_aging_ar WITH (security_invoker = true) AS
WITH project_due AS (
  SELECT
    pb.client_id,
    c.name AS client_name,
    pb.project_id,
    pb.project_name,
    GREATEST(0, -pb.balance) AS amount_due,
    (
      SELECT MAX(t.date)
      FROM transactions t
      WHERE t.deleted_at IS NULL
        AND t.project_id = pb.project_id
        AND t.type IN ('project_deposit','project_expense','vendor_settlement','client_return','retention_withheld','retention_released','supervision')
    ) AS last_date
  FROM public.project_balances pb
  JOIN clients c ON c.id = pb.client_id
  WHERE c.deleted_at IS NULL
    AND GREATEST(0, -pb.balance) > 0
),
bucketed AS (
  SELECT
    client_id,
    client_name,
    project_id,
    project_name,
    amount_due,
    last_date,
    COALESCE(CURRENT_DATE - last_date, 0) AS days_overdue,
    CASE
      WHEN COALESCE(CURRENT_DATE - last_date, 0) <= 30 THEN amount_due
      ELSE 0
    END AS bucket_current,
    CASE
      WHEN COALESCE(CURRENT_DATE - last_date, 0) BETWEEN 31 AND 60 THEN amount_due
      ELSE 0
    END AS bucket_1_30,
    CASE
      WHEN COALESCE(CURRENT_DATE - last_date, 0) BETWEEN 61 AND 90 THEN amount_due
      ELSE 0
    END AS bucket_31_60,
    CASE
      WHEN COALESCE(CURRENT_DATE - last_date, 0) BETWEEN 91 AND 120 THEN amount_due
      ELSE 0
    END AS bucket_61_90,
    CASE
      WHEN COALESCE(CURRENT_DATE - last_date, 0) > 120 THEN amount_due
      ELSE 0
    END AS bucket_over_90
  FROM project_due
)
SELECT
  client_id,
  client_name,
  SUM(amount_due) AS total_due,
  MAX(last_date) AS last_date,
  MAX(days_overdue) AS days_overdue,
  SUM(bucket_current) AS bucket_current,
  SUM(bucket_1_30) AS bucket_1_30,
  SUM(bucket_31_60) AS bucket_31_60,
  SUM(bucket_61_90) AS bucket_61_90,
  SUM(bucket_over_90) AS bucket_over_90
FROM bucketed
GROUP BY client_id, client_name;

CREATE OR REPLACE VIEW public.report_aging_ap WITH (security_invoker = true) AS
WITH vendor_last AS (
  SELECT
    v.id AS vendor_id,
    v.name AS vendor_name,
    GREATEST(
      (SELECT MAX(p.date) FROM procurements p WHERE p.deleted_at IS NULL AND p.vendor_id = v.id),
      (SELECT MAX(t.date) FROM transactions t WHERE t.deleted_at IS NULL AND t.vendor_id = v.id AND t.type IN ('vendor_settlement','project_expense'))
    ) AS last_date
  FROM vendors v
  WHERE v.deleted_at IS NULL
),
bucketed AS (
  SELECT
    vb.vendor_id,
    vl.vendor_name,
    vb.balance AS amount_due,
    vl.last_date,
    COALESCE(CURRENT_DATE - vl.last_date, 0) AS days_overdue,
    CASE
      WHEN COALESCE(CURRENT_DATE - vl.last_date, 0) <= 30 THEN vb.balance
      ELSE 0
    END AS bucket_current,
    CASE
      WHEN COALESCE(CURRENT_DATE - vl.last_date, 0) BETWEEN 31 AND 60 THEN vb.balance
      ELSE 0
    END AS bucket_1_30,
    CASE
      WHEN COALESCE(CURRENT_DATE - vl.last_date, 0) BETWEEN 61 AND 90 THEN vb.balance
      ELSE 0
    END AS bucket_31_60,
    CASE
      WHEN COALESCE(CURRENT_DATE - vl.last_date, 0) BETWEEN 91 AND 120 THEN vb.balance
      ELSE 0
    END AS bucket_61_90,
    CASE
      WHEN COALESCE(CURRENT_DATE - vl.last_date, 0) > 120 THEN vb.balance
      ELSE 0
    END AS bucket_over_90
  FROM public.vendor_balances vb
  JOIN vendor_last vl ON vl.vendor_id = vb.vendor_id
  WHERE vb.balance > 0
)
SELECT
  vendor_id,
  vendor_name,
  amount_due,
  last_date,
  days_overdue,
  bucket_current,
  bucket_1_30,
  bucket_31_60,
  bucket_61_90,
  bucket_over_90
FROM bucketed;

GRANT SELECT ON public.report_aging_ar TO authenticated;
GRANT SELECT ON public.report_aging_ap TO authenticated;

-- migration_v300_invoicing.sql
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
