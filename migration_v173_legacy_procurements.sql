-- Migration v173: Normalize legacy procurement and transaction payment tracking
-- Apply after schema_full_fix.sql is in place.

-- Legacy procurements created before payment_term/paid_amount columns (or with NULL values)
-- should be treated as immediate/cash purchases: fully paid.
UPDATE procurements
SET payment_term = 'immediate',
    paid_amount = COALESCE(total_price, 0)
WHERE deleted_at IS NULL
  AND (payment_term IS NULL OR paid_amount IS NULL);

-- Legacy project_expense transactions that represent procurements or pre-payment_term
-- records should also be marked immediate and fully paid so vendor balances stay correct.
UPDATE transactions
SET payment_term = 'immediate',
    paid_amount = COALESCE(amount, 0)
WHERE deleted_at IS NULL
  AND (payment_term IS NULL OR paid_amount IS NULL)
  AND type = 'project_expense';
