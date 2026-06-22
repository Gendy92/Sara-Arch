-- Migration v242 — Per-project, per-section supervision percentages
-- Idempotent. Run in Supabase SQL Editor as a single script.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. New junction table for project/section supervision   │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS project_section_supervision (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  section_id UUID REFERENCES work_sections(id) ON DELETE CASCADE,
  percentage NUMERIC DEFAULT 0,
  tenant_id UUID REFERENCES tenants(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, section_id)
);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Triggers                                             │
-- └─────────────────────────────────────────────────────────┘

DROP TRIGGER IF EXISTS project_section_supervision_u ON project_section_supervision;
CREATE TRIGGER project_section_supervision_u
BEFORE UPDATE ON project_section_supervision
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_section_supervision_cb ON project_section_supervision;
CREATE TRIGGER project_section_supervision_cb
BEFORE INSERT ON project_section_supervision
FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS project_section_supervision_tenant ON project_section_supervision;
CREATE TRIGGER project_section_supervision_tenant
BEFORE INSERT OR UPDATE ON project_section_supervision
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. RLS                                                  │
-- └─────────────────────────────────────────────────────────┘

ALTER TABLE project_section_supervision ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all" ON project_section_supervision;
DROP POLICY IF EXISTS "tenant_scope" ON project_section_supervision;
CREATE POLICY "tenant_scope" ON project_section_supervision
FOR ALL TO authenticated
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Backfill default rates from project-level percentage │
-- └─────────────────────────────────────────────────────────┘

INSERT INTO project_section_supervision (project_id, section_id, percentage, tenant_id)
SELECT p.id, s.id, COALESCE(p.supervision_percentage, 0), p.tenant_id
FROM projects p
CROSS JOIN work_sections s
WHERE p.deleted_at IS NULL
  AND s.deleted_at IS NULL
ON CONFLICT (project_id, section_id) DO NOTHING;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. Update balance view to use per-section rates         │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW public.project_balances AS
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
  COALESCE(d.amt, 0) - COALESCE(cr.amt, 0) - COALESCE(e.amt, 0) - COALESCE(sv.amt, 0) AS balance
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
WHERE p.deleted_at IS NULL;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. Update dashboard functions                           │
-- └─────────────────────────────────────────────────────────┘

DROP FUNCTION IF EXISTS public.dashboard_monthly_revenue_expenses(integer);
CREATE OR REPLACE FUNCTION dashboard_monthly_revenue_expenses(months_back INT DEFAULT 6)
RETURNS TABLE(month_key TEXT, project_revenue NUMERIC, project_expense NUMERIC, office_revenue NUMERIC, office_expense NUMERIC) AS $$
DECLARE
  start_date DATE;
BEGIN
  start_date := (date_trunc('month', CURRENT_DATE) - ((months_back - 1) || ' months')::INTERVAL)::DATE;
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(0, months_back - 1) AS i
  ),
  month_keys AS (
    SELECT to_char(date_trunc('month', CURRENT_DATE) - (i || ' months')::INTERVAL, 'YYYY-MM') AS mk
    FROM months
  ),
  project_dep AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'project_deposit' AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  supervision AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk,
           ROUND(SUM(COALESCE(t.paid_amount, 0) * COALESCE(pss.percentage, p.supervision_percentage) / 100.0), 2) AS amt
    FROM projects p
    JOIN transactions t ON t.project_id = p.id
    LEFT JOIN project_section_supervision pss ON pss.project_id = p.id AND pss.section_id = t.section_id
    WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL AND t.type IN ('project_expense','vendor_settlement') AND t.expense_category != 'design' AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  project_exp AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.paid_amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'project_expense' AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  vendor_settlement AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'vendor_settlement' AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  owner_dep AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'owner_deposit' AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  office_vendor_income AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.paid_amount) AS amt
    FROM transactions t
    JOIN vendors v ON v.id = t.vendor_id
    WHERE t.deleted_at IS NULL AND v.is_office IS TRUE AND t.type IN ('project_expense','vendor_settlement') AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  office_income AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'income' AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  office_exp AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type IN ('office_expense','withdrawal') AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  custody_ret AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'custody_return' AND t.date >= start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  )
  SELECT m.mk::TEXT,
         COALESCE(pd.amt, 0) + COALESCE(s.amt, 0) AS project_revenue,
         COALESCE(pe.amt, 0) + COALESCE(vs.amt, 0) AS project_expense,
         COALESCE(od.amt, 0) + COALESCE(ovi.amt, 0) + COALESCE(oi.amt, 0) AS office_revenue,
         COALESCE(oe.amt, 0) - COALESCE(cr.amt, 0) AS office_expense
  FROM month_keys m
  LEFT JOIN project_dep pd ON pd.mk = m.mk
  LEFT JOIN supervision s ON s.mk = m.mk
  LEFT JOIN project_exp pe ON pe.mk = m.mk
  LEFT JOIN vendor_settlement vs ON vs.mk = m.mk
  LEFT JOIN owner_dep od ON od.mk = m.mk
  LEFT JOIN office_vendor_income ovi ON ovi.mk = m.mk
  LEFT JOIN office_income oi ON oi.mk = m.mk
  LEFT JOIN office_exp oe ON oe.mk = m.mk
  LEFT JOIN custody_ret cr ON cr.mk = m.mk
  ORDER BY m.mk;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.dashboard_active_client_balances(integer);
CREATE OR REPLACE FUNCTION dashboard_active_client_balances(limit_count INT DEFAULT 10)
RETURNS TABLE(client_id UUID, client_name TEXT, deposits NUMERIC, expenses NUMERIC, supervision NUMERIC, balance NUMERIC) AS $$
BEGIN
  RETURN QUERY
  WITH active_clients AS (
    SELECT DISTINCT c.id, c.name
    FROM clients c
    JOIN projects p ON p.client_id = c.id
    WHERE c.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND p.status = 'active'
  ),
  client_deposits AS (
    SELECT t.client_id, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND t.type = 'project_deposit'
      AND t.client_id IS NOT NULL
    GROUP BY t.client_id
  ),
  client_returns AS (
    SELECT t.client_id, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND t.type = 'client_return'
      AND t.client_id IS NOT NULL
    GROUP BY t.client_id
  ),
  client_expenses AS (
    SELECT t.client_id, SUM(t.paid_amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND t.type IN ('project_expense','vendor_settlement')
      AND t.client_id IS NOT NULL
    GROUP BY t.client_id
  ),
  project_supervision AS (
    SELECT p.client_id,
           ROUND(SUM(COALESCE(t.paid_amount, 0) * COALESCE(pss.percentage, p.supervision_percentage) / 100.0), 2) AS amt
    FROM projects p
    JOIN transactions t ON t.project_id = p.id
    LEFT JOIN project_section_supervision pss ON pss.project_id = p.id AND pss.section_id = t.section_id
    WHERE p.deleted_at IS NULL
      AND t.deleted_at IS NULL
      AND t.type IN ('project_expense','vendor_settlement')
      AND t.expense_category != 'design'
    GROUP BY p.client_id
  )
  SELECT ac.id AS client_id,
         ac.name AS client_name,
         COALESCE(d.amt, 0) - COALESCE(cr.amt, 0) AS deposits,
         COALESCE(e.amt, 0) AS expenses,
         COALESCE(ps.amt, 0) AS supervision,
         COALESCE(d.amt, 0) - COALESCE(cr.amt, 0) - COALESCE(e.amt, 0) - COALESCE(ps.amt, 0) AS balance
  FROM active_clients ac
  LEFT JOIN client_deposits d ON d.client_id = ac.id
  LEFT JOIN client_returns cr ON cr.client_id = ac.id
  LEFT JOIN client_expenses e ON e.client_id = ac.id
  LEFT JOIN project_supervision ps ON ps.client_id = ac.id
  WHERE COALESCE(d.amt, 0) - COALESCE(cr.amt, 0) - COALESCE(e.amt, 0) - COALESCE(ps.amt, 0) <> 0
  ORDER BY (COALESCE(d.amt, 0) - COALESCE(cr.amt, 0) - COALESCE(e.amt, 0) - COALESCE(ps.amt, 0)) DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 7. Update supervision transaction view descriptions       │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW public.office_transactions_view AS
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
WHERE t.deleted_at IS NULL AND t.type = 'custody_return';

CREATE OR REPLACE VIEW public.project_transactions_view AS
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
  t.paid_amount
FROM transactions t
WHERE t.deleted_at IS NULL AND t.type IN ('project_deposit','project_expense','client_return','vendor_settlement')
UNION ALL
SELECT
  NULL::UUID AS id,
  p.created_at,
  'supervision'::TEXT AS type,
  pb.supervision AS amount,
  ('إشراف ' || p.name)::TEXT AS description,
  NULL::TEXT AS party_name,
  p.name AS project_name,
  NULL::TEXT AS vendor_name,
  NULL::TEXT AS employee_name,
  NULL::TEXT AS sector_name,
  NULL::TEXT AS item_name,
  NULL::TEXT AS section_name,
  NULL::TEXT AS expense_category,
  NULL::TEXT AS payment_method,
  NULL::TEXT AS payment_term,
  NULL::NUMERIC AS paid_amount
FROM project_balances pb
JOIN projects p ON p.id = pb.project_id
WHERE pb.supervision > 0;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 8. Refresh PostgREST cache                              │
-- └─────────────────────────────────────────────────────────┘

NOTIFY pgrst, 'reload schema';
