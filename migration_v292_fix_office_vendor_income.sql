-- v292: Align office_vendor_income calculation with LOGIC_SPEC v1.5.
-- After v291, project_expense.paid_amount is forced equal to amount and only
-- records cost recognition, not cash movement. Office vendor income must come
-- from actual cash settlements: vendor_settlement rows + procurements paid.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Dashboard KPIs function                               │
-- └─────────────────────────────────────────────────────────┘
DROP FUNCTION IF EXISTS public.dashboard_kpis();
CREATE OR REPLACE FUNCTION dashboard_kpis()
RETURNS TABLE(
  client_count BIGINT,
  project_count BIGINT,
  active_project_count BIGINT,
  employee_count BIGINT,
  project_income NUMERIC,
  project_expense NUMERIC,
  office_income NUMERIC,
  office_expense NUMERIC,
  total_income NUMERIC,
  total_expense NUMERIC,
  total_movement NUMERIC
) AS $$
DECLARE
  v_project_deposits NUMERIC;
  v_supervision NUMERIC;
  v_project_expenses NUMERIC;
  v_vendor_settlements NUMERIC;
  v_owner_deposits NUMERIC;
  v_office_vendor_income NUMERIC;
  v_office_income NUMERIC;
  v_office_expenses NUMERIC;
  v_withdrawals NUMERIC;
  v_custody_returns NUMERIC;
BEGIN
  v_project_deposits := COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type = 'project_deposit'), 0);
  v_supervision := COALESCE((SELECT SUM(pb.supervision) FROM project_balances pb JOIN projects p ON p.id = pb.project_id WHERE p.deleted_at IS NULL), 0);
  v_project_expenses := COALESCE((SELECT SUM(t.paid_amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type = 'project_expense'), 0);
  v_vendor_settlements := COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type = 'vendor_settlement'), 0);
  v_owner_deposits := COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type = 'owner_deposit'), 0);
  v_office_vendor_income :=
    COALESCE((SELECT SUM(t.paid_amount) FROM transactions t JOIN vendors v ON v.id = t.vendor_id WHERE t.deleted_at IS NULL AND v.is_office IS TRUE AND t.type = 'vendor_settlement'), 0)
    +
    COALESCE((SELECT SUM(p.paid_amount) FROM procurements p JOIN vendors v ON v.id = p.vendor_id WHERE p.deleted_at IS NULL AND v.is_office IS TRUE), 0);
  v_office_income := COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type = 'income'), 0);
  v_office_expenses := COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type = 'office_expense'), 0);
  v_withdrawals := COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type = 'withdrawal'), 0);
  v_custody_returns := COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.deleted_at IS NULL AND t.type = 'custody_return'), 0);

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) AS client_count,
    (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS project_count,
    (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND status = 'active') AS active_project_count,
    (SELECT COUNT(*) FROM employees WHERE deleted_at IS NULL AND is_active = true) AS employee_count,
    v_project_deposits + v_supervision AS project_income,
    v_project_expenses + v_vendor_settlements AS project_expense,
    v_owner_deposits + v_office_vendor_income + v_office_income AS office_income,
    v_office_expenses + v_withdrawals - v_custody_returns AS office_expense,
    v_project_deposits + v_supervision + v_owner_deposits + v_office_vendor_income + v_office_income AS total_income,
    v_project_expenses + v_vendor_settlements + v_office_expenses + v_withdrawals - v_custody_returns AS total_expense,
    v_project_deposits + v_supervision + v_owner_deposits + v_office_vendor_income + v_office_income + v_project_expenses + v_vendor_settlements + v_office_expenses + v_withdrawals - v_custody_returns AS total_movement;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Monthly revenue/expenses function                     │
-- └─────────────────────────────────────────────────────────┘
DROP FUNCTION IF EXISTS public.dashboard_monthly_revenue_expenses(integer);
CREATE OR REPLACE FUNCTION dashboard_monthly_revenue_expenses(months_back INT DEFAULT 6)
RETURNS TABLE(month_key TEXT, project_revenue NUMERIC, project_expense NUMERIC, office_revenue NUMERIC, office_expense NUMERIC) AS $$
DECLARE
  filter_start_date DATE;
BEGIN
  filter_start_date := (date_trunc('month', CURRENT_DATE) - ((months_back - 1) || ' months')::INTERVAL)::DATE;
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
    WHERE t.deleted_at IS NULL AND t.type = 'project_deposit' AND t.date >= filter_start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  supervision AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk,
           ROUND(SUM(COALESCE(t.paid_amount, 0) * COALESCE(pss.percentage, p.supervision_percentage) / 100.0), 2) AS amt
    FROM projects p
    JOIN transactions t ON t.project_id = p.id
    LEFT JOIN project_section_supervision pss ON pss.project_id = p.id AND pss.section_id = t.section_id
    WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL AND t.type IN ('project_expense','vendor_settlement') AND t.expense_category != 'design' AND t.date >= filter_start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  project_exp AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.paid_amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'project_expense' AND t.date >= filter_start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  vendor_settlement AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'vendor_settlement' AND t.date >= filter_start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  owner_dep AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'owner_deposit' AND t.date >= filter_start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  office_vendor_income AS (
    SELECT mk, SUM(amt) AS amt
    FROM (
      SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.paid_amount) AS amt
      FROM transactions t
      JOIN vendors v ON v.id = t.vendor_id
      WHERE t.deleted_at IS NULL AND v.is_office IS TRUE AND t.type = 'vendor_settlement' AND t.date >= filter_start_date
      GROUP BY to_char(t.date, 'YYYY-MM')
      UNION ALL
      SELECT to_char(p.date, 'YYYY-MM') AS mk, SUM(p.paid_amount) AS amt
      FROM procurements p
      JOIN vendors v ON v.id = p.vendor_id
      WHERE p.deleted_at IS NULL AND v.is_office IS TRUE AND p.date >= filter_start_date
      GROUP BY to_char(p.date, 'YYYY-MM')
    ) u
    GROUP BY mk
  ),
  office_income AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'income' AND t.date >= filter_start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  office_exp AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type IN ('office_expense','withdrawal') AND t.date >= filter_start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
  ),
  custody_ret AS (
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.amount) AS amt
    FROM transactions t
    WHERE t.deleted_at IS NULL AND t.type = 'custody_return' AND t.date >= filter_start_date
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

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Office balance view                                   │
-- └─────────────────────────────────────────────────────────┘
DROP VIEW IF EXISTS public.office_balance;
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
