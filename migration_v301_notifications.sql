-- Migration v301 — Notifications / Alerts + PWA Background Sync foundation
-- Idempotent. Run in Supabase SQL Editor as a single script.
-- Adds notification tables, rules, generator function, and RLS.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 0. v300 custody trigger catch-up                        │
-- │    Embedded here so the CI runner applies it with v301. │
-- │    See migration_v300_custody_triggers_fix.sql for the  │
-- │    standalone production patch.                         │
-- └─────────────────────────────────────────────────────────┘

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

CREATE OR REPLACE FUNCTION custody_expenses_state_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_custody_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_custody_id := OLD.custody_id;
  ELSE
    v_custody_id := NEW.custody_id;
  END IF;

  PERFORM custody_recompute_state(v_custody_id);

  IF TG_OP = 'UPDATE' AND OLD.custody_id IS DISTINCT FROM NEW.custody_id THEN
    PERFORM custody_recompute_state(OLD.custody_id);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS custody_expenses_state_t ON custody_expenses;
CREATE TRIGGER custody_expenses_state_t
AFTER INSERT OR UPDATE OR DELETE ON custody_expenses
FOR EACH ROW EXECUTE FUNCTION custody_expenses_state_trigger();

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

DROP TRIGGER IF EXISTS custody_expense_limit_t ON custody_expenses;
CREATE TRIGGER custody_expense_limit_t
BEFORE INSERT OR UPDATE ON custody_expenses
FOR EACH ROW EXECUTE FUNCTION custody_expense_limit_check();

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

DROP TRIGGER IF EXISTS custody_return_limit_t ON custody_records;
CREATE TRIGGER custody_return_limit_t
BEFORE UPDATE ON custody_records
FOR EACH ROW EXECUTE FUNCTION custody_return_limit_check();

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM custody_records WHERE deleted_at IS NULL LOOP
    PERFORM custody_recompute_state(rec.id);
  END LOOP;
END $$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Notification tables                                  │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS notification_rules (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  overdue_client_days INT DEFAULT 7,
  task_deadline_days INT DEFAULT 1,
  contract_milestone_days INT DEFAULT 7,
  enabled_types TEXT[] DEFAULT '{overdue_client,task_deadline,contract_milestone}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('overdue_client','task_deadline','contract_milestone','system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','danger')),
  is_read BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  related_table TEXT,
  related_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Indexes                                              │
-- └─────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_table, related_id);
DROP INDEX IF EXISTS idx_notifications_unique_active;
CREATE UNIQUE INDEX idx_notifications_unique_active ON notifications(user_id, type, related_table, related_id)
  WHERE is_read = false AND archived = false;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Triggers                                             │
-- └─────────────────────────────────────────────────────────┘

DROP TRIGGER IF EXISTS notifications_u ON notifications;
CREATE TRIGGER notifications_u BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS notification_rules_u ON notification_rules;
CREATE TRIGGER notification_rules_u BEFORE UPDATE ON notification_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Generator function                                   │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION generate_notifications(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
  v_rules notification_rules%ROWTYPE;
  v_user RECORD;
  v_client RECORD;
  v_task RECORD;
  v_project RECORD;
BEGIN
  SELECT * INTO v_rules FROM notification_rules WHERE tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Overdue client balances
  IF 'overdue_client' = ANY(v_rules.enabled_types) THEN
    FOR v_client IN
      SELECT c.id AS client_id, c.name AS client_name, cb.balance,
             MAX(t.date) AS last_deposit_date
      FROM clients c
      JOIN client_balances cb ON cb.client_id = c.id
      LEFT JOIN transactions t ON t.client_id = c.id AND t.type = 'project_deposit' AND t.deleted_at IS NULL
      WHERE c.tenant_id = p_tenant_id
        AND c.deleted_at IS NULL
        AND cb.balance > 0
      GROUP BY c.id, c.name, cb.balance
      HAVING MAX(t.date) IS NULL OR MAX(t.date) < CURRENT_DATE - v_rules.overdue_client_days
    LOOP
      FOR v_user IN
        SELECT p.id FROM profiles p JOIN user_tenants ut ON ut.user_id = p.id WHERE ut.tenant_id = p_tenant_id
      LOOP
        INSERT INTO notifications (user_id, tenant_id, type, title, message, link, severity, related_table, related_id)
        VALUES (
          v_user.id, p_tenant_id, 'overdue_client',
          'مستحقات العميل المتأخرة',
          'العميل ' || v_client.client_name || ' لديه رصيد مستحق ' || v_client.balance || ' ج.م.',
          '#/clients?id=' || v_client.client_id,
          'warning',
          'clients',
          v_client.client_id
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  -- Task deadlines
  IF 'task_deadline' = ANY(v_rules.enabled_types) THEN
    FOR v_task IN
      SELECT pt.id, pt.name, pt.due_date, p.id AS project_id, p.name AS project_name
      FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      WHERE pt.tenant_id = p_tenant_id
        AND pt.deleted_at IS NULL
        AND pt.status != 'done'
        AND pt.due_date IS NOT NULL
        AND pt.due_date <= CURRENT_DATE + v_rules.task_deadline_days
    LOOP
      FOR v_user IN
        SELECT p.id FROM profiles p JOIN user_tenants ut ON ut.user_id = p.id WHERE ut.tenant_id = p_tenant_id
      LOOP
        INSERT INTO notifications (user_id, tenant_id, type, title, message, link, severity, related_table, related_id)
        VALUES (
          v_user.id, p_tenant_id, 'task_deadline',
          'موعد نهائي للمهمة',
          'المهمة ' || v_task.name || ' (مشروع ' || v_task.project_name || ') تستحق في ' || v_task.due_date || '.',
          '#/tasks',
          'info',
          'project_tasks',
          v_task.id
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  -- Contract milestones (projects with end_date approaching)
  IF 'contract_milestone' = ANY(v_rules.enabled_types) THEN
    FOR v_project IN
      SELECT id, name, end_date
      FROM projects
      WHERE tenant_id = p_tenant_id
        AND deleted_at IS NULL
        AND end_date IS NOT NULL
        AND end_date <= CURRENT_DATE + v_rules.contract_milestone_days
        AND status NOT IN ('completed','cancelled')
    LOOP
      FOR v_user IN
        SELECT p.id FROM profiles p JOIN user_tenants ut ON ut.user_id = p.id WHERE ut.tenant_id = p_tenant_id
      LOOP
        INSERT INTO notifications (user_id, tenant_id, type, title, message, link, severity, related_table, related_id)
        VALUES (
          v_user.id, p_tenant_id, 'contract_milestone',
          'موعد نهائي للمشروع',
          'المشروع ' || v_project.name || ' ينتهي في ' || v_project.end_date || '.',
          '#/project?projectId=' || v_project.id,
          'warning',
          'projects',
          v_project.id
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. Seed default rules for existing tenants              │
-- └─────────────────────────────────────────────────────────┘

INSERT INTO notification_rules (tenant_id)
SELECT id FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM notification_rules)
ON CONFLICT (tenant_id) DO NOTHING;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. RLS                                                  │
-- └─────────────────────────────────────────────────────────┘

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON notifications;
DROP POLICY IF EXISTS "notifications_user_isolation" ON notifications;
CREATE POLICY "notifications_user_isolation" ON notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON notification_rules;
DROP POLICY IF EXISTS "notification_rules_tenant" ON notification_rules;
CREATE POLICY "notification_rules_tenant" ON notification_rules
  FOR ALL TO authenticated
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());
