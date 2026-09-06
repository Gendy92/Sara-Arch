-- v300 custody trigger fix — production patch
-- Run this in Supabase SQL Editor *before* applying migration_v301_notifications.sql
-- if the production database was brought up to v300 without the custody-expenses
-- trigger or without the recursion guard on custody_records_state_trigger.
--
-- This script is idempotent and safe to re-run.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. custody_records state trigger (with recursion guard) │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION custody_records_state_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Guard against recursion: custody_recompute_state() updates custody_records,
  -- which would fire this trigger again.
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
-- │ 2. custody_expenses state trigger                       │
-- │    Keeps custody_records totals in sync when expenses   │
-- │    (spent / returned) are inserted, updated, or deleted.│
-- └─────────────────────────────────────────────────────────┘

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

DROP TRIGGER IF EXISTS custody_expense_limit_t ON custody_expenses;
CREATE TRIGGER custody_expense_limit_t
BEFORE INSERT OR UPDATE ON custody_expenses
FOR EACH ROW EXECUTE FUNCTION custody_expense_limit_check();

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

DROP TRIGGER IF EXISTS custody_return_limit_t ON custody_records;
CREATE TRIGGER custody_return_limit_t
BEFORE UPDATE ON custody_records
FOR EACH ROW EXECUTE FUNCTION custody_return_limit_check();

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. Refresh all existing custody records                 │
-- └─────────────────────────────────────────────────────────┘

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM custody_records WHERE deleted_at IS NULL LOOP
    PERFORM custody_recompute_state(rec.id);
  END LOOP;
END $$;
