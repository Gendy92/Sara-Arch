# Decision Doc — Retention / Holdback Tracking

**Status:** Adopted / Implemented in v294  
**Date:** 2026-07-06  
**Decision date:** 2026-07-09  
**Applies to:** Sara-Arch v294+  
**Stakeholders:** Product owner, accountant, lead dev

---

## 1. Context

Construction and supervision contracts commonly withhold a percentage of payments (typically 5–10%) until project close-out. This is called **retention** or **holdback** (ضمان الأعمال).

Sara-Arch currently has **no retention concept**. This is a gap for any project where the client contract includes withheld amounts.

---

## 2. Goals

1. Track how much retention has been withheld per project.
2. Track how much has been released.
3. Show retained amounts in client/project balances and reports.
4. Avoid breaking the existing deposit/expense/supervision model.

---

## 3. Options

### Option A — Project-level field only
- Add `retention_percentage` to `projects`.
- Compute retained amount on demand: `Retention = Eligible Deposits × retention_percentage`.
- **Pros:** Simple.
- **Cons:** Does not handle partial releases or retention on expenses; not flexible enough for real contracts.

### Option B — Separate transaction types
- Add `retention_withheld` and `retention_released` transaction types.
- When a deposit is recorded, optionally withhold retention as a separate row.
- Release retention via a dedicated transaction at close-out.
- **Pros:** Full audit trail; supports partial releases and retention on both deposits and expenses.
- **Cons:** More rows; requires UI changes.

### Option C — Invoice line-item deduction
- Retention is deducted on invoices, not in the core ledger.
- **Pros:** Matches invoicing workflow.
- **Cons:** Sara-Arch does not yet have an invoicing module; retention would be invisible until invoices exist.

---

## 4. Recommended Approach

**Adopt a hybrid of Option A + Option B:**

1. Add `retention_percentage` to `projects` (default 0).
2. When a `project_deposit` is saved, if `retention_percentage > 0`, automatically create a companion `retention_withheld` row for the withheld portion.
3. The net project deposit available for balance calculations becomes `deposit_amount − retention_withheld`.
4. Release retention via a `retention_released` transaction (admin-only) at project close-out.
5. Both withheld and released rows are visible in project/client statements.

### Example

| Transaction | Type | Amount | Effect on project balance |
|-------------|------|--------|---------------------------|
| Client deposit | `project_deposit` | 100,000 | +100,000 |
| Retention withheld (10%) | `retention_withheld` | −10,000 | −10,000 |
| Net usable deposit | — | 90,000 | reflected in balance |
| Retention released at close-out | `retention_released` | +10,000 | +10,000 |

### Migration
- Add `retention_percentage numeric default 0` to `projects`.
- Add `retention_withheld` and `retention_released` to the transaction type enum/check constraint.
- Update balance views to account for these types.
- Backfill: existing projects have `retention_percentage = 0`; no retroactive changes.

### Reporting
- Project detail: show "Retention withheld" and "Retention released" lines.
- Client statement: aggregate retention per project.
- New report: projects with outstanding retention.

---

## 5. Decision needed

Please confirm:
1. Adopt the hybrid A+B approach.
2. Default `retention_percentage` (suggest 0, configurable per project).
3. Whether retention can be withheld on expenses as well as deposits (suggest: start with deposits only).
4. Who can release retention (suggest: admin only).

Once confirmed, this can be turned into implementation tickets.
