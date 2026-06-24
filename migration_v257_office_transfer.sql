-- v257: Add internal transfer support between office cash and bank accounts.
-- Old records with NULL payment_method continue to be treated as cash.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_to TEXT;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('project_deposit','project_expense','office_expense','owner_deposit','income','expense','deposit','withdrawal','supervision','client_return','vendor_settlement','custody_return','transfer'));

DROP VIEW IF EXISTS public.office_balance;
DROP VIEW IF EXISTS public.office_transactions_view;

CREATE OR REPLACE VIEW public.office_balance AS
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
    COALESCE((SELECT SUM(t2.paid_amount) FROM transactions t2 JOIN vendors v ON v.id = t2.vendor_id WHERE t2.deleted_at IS NULL AND v.is_office IS TRUE AND t2.type IN ('project_expense','vendor_settlement')), 0) AS office_vendor_income
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

GRANT SELECT ON public.office_balance TO authenticated;
GRANT SELECT ON public.office_transactions_view TO authenticated;
