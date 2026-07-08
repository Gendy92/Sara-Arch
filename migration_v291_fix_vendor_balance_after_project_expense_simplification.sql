-- v291: Fix vendor_balances view after v290 project-expense simplification.
--
-- In v290, the manual project expense form stopped collecting paid_amount;
-- project expenses are now treated as fully paid for project cash-flow, while
-- real vendor payments are recorded as vendor_settlement rows.
--
-- This migration updates the vendor_balances view so service project_expense
-- rows contribute to "owed" but NOT to "paid". Only vendor_settlement rows
-- and procurement paid_amount count as actual vendor payments.

CREATE OR REPLACE VIEW public.vendor_balances WITH (security_invoker = true) AS
SELECT
  v.id AS vendor_id,
  v.name AS vendor_name,
  COALESCE(SUM(amounts.total_owed), 0) AS total_owed,
  COALESCE(SUM(amounts.total_paid), 0) AS total_paid,
  COALESCE(SUM(amounts.total_owed), 0) - COALESCE(SUM(amounts.total_paid), 0) AS balance
FROM vendors v
LEFT JOIN (
  -- Service-linked project expenses: cost recognition only.
  SELECT
    vendor_id,
    COALESCE(SUM(amount), 0) AS total_owed,
    0 AS total_paid
  FROM transactions
  WHERE deleted_at IS NULL AND type = 'project_expense' AND vendor_id IS NOT NULL
  GROUP BY vendor_id

  UNION ALL

  -- Procurements: still carry their own paid_amount lifecycle.
  SELECT
    vendor_id,
    COALESCE(SUM(total_price), 0) AS total_owed,
    COALESCE(SUM(CASE WHEN payment_term IS NOT NULL THEN paid_amount ELSE total_price END), 0) AS total_paid
  FROM procurements
  WHERE deleted_at IS NULL AND vendor_id IS NOT NULL
  GROUP BY vendor_id

  UNION ALL

  -- Project-agnostic vendor payments (v290+).
  SELECT
    vendor_id,
    0 AS total_owed,
    COALESCE(SUM(paid_amount), 0) AS total_paid
  FROM transactions
  WHERE deleted_at IS NULL AND type = 'vendor_settlement' AND vendor_id IS NOT NULL
  GROUP BY vendor_id
) amounts ON amounts.vendor_id = v.id
WHERE v.deleted_at IS NULL
GROUP BY v.id, v.name;

GRANT SELECT ON public.vendor_balances TO authenticated;

NOTIFY pgrst, 'reload schema';
