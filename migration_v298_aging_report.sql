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
