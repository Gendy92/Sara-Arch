# Sara Arch — Development Roadmap

> **Current runtime version:** v175  
> **Last updated:** 2026-06-17

This roadmap prioritizes critical fixes, high-value business features, quality-of-life improvements, and long-term technical excellence.

---

## 1. High Priority Improvements

### 1.1 Critical Fixes (Do First)

| # | Improvement | Problem | Suggested Fix |
|---|-------------|---------|---------------|
| 1.1.1 | **Fix procurement `total_price` save** | `addProcurement` / `editProcurement` did not always compute/store `total_price`, causing vendor balances and purchase reports to show `null`. | ✅ `total_price` is a generated column (`quantity * unit_price`); client payloads now strip any accidental `total_price` values. |
| 1.1.2 | **Fix legacy procurement paid amount** | Legacy procurements without `payment_term` inflated vendor balances. | ✅ Added `migration_v173_legacy_procurements.sql`; new procurements default to `payment_term='immediate'` and `paid_amount=quantity*unit_price`. |
| 1.1.3 | **Prevent negative financial inputs** | Amount inputs allowed negative values, corrupting balances. | ✅ All number inputs already use `min="0"`; `Crud.save()` / `bulkSave()` now reject negative financial values server-side as well. |
| 1.1.4 | **Fix audit trail `old_data`** | UPDATE/DELETE audit logs could record `old_data: null`. | ✅ Added `_fetchOldData()` helper; `save()` accepts an optional pre-fetched old row and logs it with every UPDATE. |
| 1.1.5 | **Remove exposed service-role key** | `SUPABASE_SERVICE_KEY` was hardcoded in `js/config.js`. | ✅ Moved admin user operations to the server-side `admin_create_auth_user` Postgres function; service-role key now only used in GitHub Actions backup workflow. |
| 1.1.6 | **Fix payroll regeneration bug** | Regenerating an already-paid payroll keeps `paid` status with new numbers. | Reset status to `draft` on regeneration or block regeneration of paid payrolls. |
| 1.1.7 | **Add duplicate detection** | Infinite duplicate clients/projects/vendors could be created. | ✅ Added unique normalized-name checks for clients, projects, vendors, sectors, sections, work items, and items; added soft-delete cleanup script. |
| 1.1.9 | **Fix non-admin login (`email_not_confirmed`)** | New users created via public signup or admin RPC could not log in because Supabase still required email confirmation. | ✅ Added `auto_confirm_user` trigger on `auth.users`; backfilled existing unconfirmed accounts; verified public signup and login return a valid session. |
| 1.1.10 | **Harden admin user creation** | `addUser()` had a check-then-act race, could create orphaned `auth.users` rows, and provided poor error reporting. | ✅ Moved profile upsert into atomic `admin_create_auth_user` RPC; added duplicate username/email pre-checks; added per-row failure messages; added `profiles.username` unique constraint. |

### 1.2 Data Consistency & Security

| # | Improvement | Rationale |
|---|-------------|-----------|
| 1.2.1 | **Create database views** for balances (client, project, vendor, office). | Move critical calculations from browser to database for consistency. |
| 1.2.2 | **Add PostgreSQL functions/triggers** for supervision, net salary, and vendor balance. | Guarantees correctness regardless of client code. |
| 1.2.3 | **Tighten RLS policies** so users can only access their own/allowed rows. | Replace `authenticated_all` with ownership or permission-based policies. |
| 1.2.4 | **Rotate Supabase keys** and remove from repository history. | Mitigate exposure from hardcoded keys. |
| 1.2.5 | **Add input sanitization** to prevent XSS in modals and dropdowns. | Security hardening. |

### 1.3 Core Business Features

| # | Improvement | Rationale | Effort |
|---|-------------|-----------|--------|
| 1.3.1 | **Invoicing module** | Generate client invoices with status workflow and PDF export. | Medium |
| 1.3.2 | **Restore from backup** | Import previously exported JSON/ZIP backups. | Medium |
| 1.3.3 | **Document attachments** | Link files to clients/projects/transactions via Supabase Storage. | Medium |
| 1.3.4 | **Retention / holdback tracking** | Track project retention amounts. | Low |

---

## 2. Medium Priority Improvements

### 2.1 Scale & Performance

| # | Improvement | Rationale |
|---|-------------|-----------|
| 2.1.1 | **Server-side pagination** on transactions, clients, vendors, and employees. | Prevents unbounded queries from degrading performance. |
| 2.1.2 | **Add missing indexes** on frequently filtered columns (`client_id`, `employee_id`, `date`, `type`). | Improves query speed. |
| 2.1.3 | **Optimize dashboard queries** with materialized views or pre-aggregated tables. | Reduces repeated heavy calculations. |
| 2.1.4 | **Cascade soft deletes** consistently across all related tables. | Prevents orphaned visible records. |

### 2.2 User Experience

| # | Improvement | Rationale |
|---|-------------|-----------|
| 2.2.1 | **Complete PWA experience** — add install prompt, offline fallback page, background sync queue. | Improves mobile reliability. |
| 2.2.2 | **Form validation UX** — inline validation, required-field highlighting, error messages. | Reduces user errors. |
| 2.2.3 | **Empty state CTAs** — guide users when lists are empty. | Onboarding improvement. |
| 2.2.4 | **Quick date filters** on transactions, attendance, payroll, and statements. | Faster navigation. |
| 2.2.5 | **Fix iOS input zoom** by setting `font-size: 16px` on inputs. | Mobile usability. |
| 2.2.6 | **Keyboard shortcuts** for common actions (save, close modal, search). | Power-user productivity. |

### 2.3 Missing UI Modules

| # | Improvement | Rationale |
|---|-------------|-----------|
| 2.3.1 | **Items catalog screen** | `items` CRUD exists but no UI loads it. |
| 2.3.2 | **Employee transactions screen** | Allow direct entry of advances, penalties, bonuses, other. |
| 2.3.3 | **Custody expenses screen** | Use the existing `custody_expenses` table instead of updating `returned_amount`. |
| 2.3.4 | **Salary history screen** | Surface `employee_salary_history` data. |
| 2.3.5 | **Real Settings page** | Configure currency, company name, logo, default supervision percentage. |

### 2.4 Reporting

| # | Improvement | Rationale |
|---|-------------|-----------|
| 2.4.1 | **Profit & Loss (P&L) report** | High-value management report. |
| 2.4.2 | **Aging report** (A/R and A/P). | Track overdue receivables/payables. |
| 2.4.3 | **Cash flow statement**. | Office liquidity overview. |
| 2.4.4 | **Project profitability card** on project detail. | Quick project health check. |

---

## 3. Long Term Improvements

### 3.1 Architecture Modernization

| # | Improvement | Rationale |
|---|-------------|-----------|
| 3.1.1 | **Migrate to a frontend framework** (e.g., Vue, React, Svelte) or a build system. | Improves maintainability as the app grows. |
| 3.1.2 | **Introduce proper URL routing** with deep-linkable screens. | Enables sharing and browser navigation. |
| 3.1.3 | **Move business logic to Supabase Edge Functions or database functions**. | Security, consistency, and scalability. |
| 3.1.4 | **Adopt a state management pattern** instead of global variables. | Easier debugging and testing. |
| 3.1.5 | **Split `crud.js` and `app-loaders.js` into per-module files**. | Reduces technical debt. |

### 3.2 Inventory & Procurement

| # | Improvement | Rationale |
|---|-------------|-----------|
| 3.2.1 | **Inventory / stock management** with quantity on hand, reorder points, and stock alerts. | Critical for merchandise vendors. |
| 3.2.2 | **Purchase orders** with approval workflow. | Formal procurement process. |
| 3.2.3 | **Quotations / estimates** convertible to projects/invoices. | Sales pipeline support. |

### 3.3 Collaboration & Notifications

| # | Improvement | Rationale |
|---|-------------|-----------|
| 3.3.1 | **Notifications / alerts** for overdue payments, low stock, task deadlines. | Proactive management. |
| 3.3.2 | **Multi-user real-time updates** via Supabase realtime channels. | Avoid stale data across sessions. |
| 3.3.3 | **Task scheduling with Gantt/calendar view**. | Project planning. |
| 3.3.4 | **Site diary / daily reports**. | Field operations tracking. |

### 3.4 Quality Assurance

| # | Improvement | Rationale |
|---|-------------|-----------|
| 3.4.1 | **Automated test suite** (unit + integration) with Jest or Vitest. | Prevents regressions. |
| 3.4.2 | **Update `TEST_PLAN.md` and `TEST_DATA.md` to v162**. | Current test docs target v83. |
| 3.4.3 | **End-to-end tests** with Playwright. | Confidence in critical workflows. |
| 3.4.4 | **Documentation automation** — generate schema docs from migrations. | Keeps docs in sync with code. |

### 3.5 DevOps & Operations

| # | Improvement | Rationale |
|---|-------------|-----------|
| 3.5.1 | **Staged deployments** (staging Supabase + preview GitHub Pages). | Safer releases. |
| 3.5.2 | **Automated schema diff checks** in CI. | Catch migration drift. |
| 3.5.3 | **Backup integrity verification** — validate exported JSON and test restore. | Ensure backups are usable. |
| 3.5.4 | **Migrate secrets to a secrets manager** or GitHub encrypted secrets only. | Security best practice. |

---

## 4. Suggested Phasing

### Phase 1 — Stabilize (Mostly complete at v175)
- ✅ Fix non-admin login (`email_not_confirmed`).
- ✅ Remove exposed service-role key from browser; keep it only in GitHub Actions secrets.
- ✅ Add duplicate detection for master data.
- ✅ Add global error handling / toast failures.
- ✅ Procurement `total_price` save consistency.
- ✅ Legacy procurement paid amount migration.
- ✅ Negative amount input guards.
- ✅ Audit trail `old_data` fix.
- ✅ Harden admin user creation.
- ⏳ Payroll regeneration status reset.
- Tighten RLS and rotate exposed keys.
- Add database views for balances.

### Phase 2 — Core Value (Weeks 3–6)
- Invoicing module.
- Restore from backup.
- Document attachments.
- Complete missing UI modules (items, employee transactions, custody expenses, settings).

### Phase 3 — Scale & UX (Weeks 7–10)
- Server-side pagination and indexes.
- PWA enhancements.
- P&L, aging, and cash flow reports.
- Form validation and mobile UX fixes.

### Phase 4 — Platform (Weeks 11+)
- Inventory and purchase orders.
- Notifications and real-time updates.
- Automated testing.
- Architecture modernization (framework migration if justified).

---

## 5. Quick Wins (< 30 minutes each)

1. Add `min="0"` to all amount/price/quantity inputs.
2. Fix iOS input zoom (`font-size: 16px` on inputs).
3. Add `theme-color` meta tag and Arabic page title.
4. Update `index.html` CSS cache-busting query param to match `version.json`.
5. Fix `doLogout()` to use `UI.confirm()`.
6. Add project profit margin to the project budget page.
7. Reset payroll status to `draft` on regeneration.
8. Add unique normalized-name checks for clients, projects, and vendors.
