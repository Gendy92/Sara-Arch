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
