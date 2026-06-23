-- Migration v245 — Fix ambiguous start_date reference in dashboard_monthly_revenue_expenses
-- Idempotent. Run in Supabase SQL Editor.

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
    SELECT to_char(t.date, 'YYYY-MM') AS mk, SUM(t.paid_amount) AS amt
    FROM transactions t
    JOIN vendors v ON v.id = t.vendor_id
    WHERE t.deleted_at IS NULL AND v.is_office IS TRUE AND t.type IN ('project_expense','vendor_settlement') AND t.date >= filter_start_date
    GROUP BY to_char(t.date, 'YYYY-MM')
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

NOTIFY pgrst, 'reload schema';
