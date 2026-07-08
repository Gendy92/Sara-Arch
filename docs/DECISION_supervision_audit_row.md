# Decision Doc — Supervision as a System-Locked Audit Row

**Status:** Adopted / Implemented in v294  
**Date:** 2026-07-06  
**Decision date:** 2026-07-09  
**Applies to:** Sara-Arch v294+  
**Stakeholders:** Product owner, accountant, lead dev

---

## 1. Context

Supervision fees are currently **computed on demand** from project expenses:

```
Supervision Fee = (Project Expenses − Design Expenses) × Supervision% / 100
```

This value flows into:
- Project net balance
- Client balance
- Dashboard KPIs
- Office income (implicitly)

It is **not stored as a transaction row**. This keeps the ledger clean and avoids double-entry drift, but it creates two problems:
1. **Reconciliation:** An accountant cannot line up the supervision amount against a bank statement or client invoice.
2. **Audit trail:** There is no immutable record of what supervision was charged for a given period.

---

## 2. Options

### Option A — Keep computed only (status quo)
- **Pros:** Simple, no risk of stale/corrupt rows, no migration needed.
- **Cons:** No reconciliation trail; period-close reports are hard to defend.

### Option B — Generate a system-locked row at period close
- **Pros:** Creates an immutable audit row only when a period is finalized; live calculations remain the source of truth until then.
- **Cons:** Requires a "period close" concept and UI; rows must be non-editable and clearly tagged.

### Option C — Generate a system-locked row immediately, hidden until period close
- **Pros:** Rows exist from day one; can be exposed/reconciled at any time.
- **Cons:** More rows in the transaction table; risk of users treating them as real cash movements before close.

---

## 3. Recommended Approach

**Adopt Option B: generate a system-locked `supervision` transaction row when a project period is closed.**

### Rules
1. The row is created by a `SECURITY DEFINER` function or trigger, not by user input.
2. It is tagged `system_generated = true` and `editable = false`.
3. It is excluded from the live "computed" supervision total (to avoid double counting) — instead, closed periods use the stored row, and open periods use the formula.
4. If a closed period is reopened, the system row is deleted or marked void, and the formula takes over again.
5. The row type is `supervision` and is included in project/client statements and office income reports.

### Migration
- Add columns to `transactions`: `system_generated boolean default false`, `period_closed boolean default false`.
- Add a `project_period_closes` table (project_id, period, closed_at, closed_by) if it does not exist.
- Backfill: existing projects remain "open" and continue using the computed formula.

### Open questions
- Who can close a period? (Suggest: admin only.)
- Can a period be reopened? (Suggest: yes, with audit log entry.)
- Should the supervision row be generated per project per month, per invoice, or per manual close?

---

## 4. Decision needed

Please confirm:
1. Adopt Option B.
2. Define who can close a period and whether reopening is allowed.
3. Choose the period granularity (monthly, per invoice, manual).

Once confirmed, this can be turned into implementation tickets.
