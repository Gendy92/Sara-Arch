# Sara-Arch Action Plan

> **Live version:** v294  
> **Branch:** `main` / `dev.2` (fast-forward synced)  
> **Last updated:** 2026-07-09

| Check | Result |
|-------|--------|
| Unit tests | **48 passed / 48** |
| Lint | **0 errors, 0 warnings** |
| npm audit | **0 vulnerabilities** |
| GitHub Pages deploy | Green |
| Daily backup | Running |

---

## Do Now — Next 24 hours

| # | Task | Area | Priority | Status | Notes |
|---|------|------|----------|--------|-------|
| 0.1 | Revoke exposed GitHub OAuth token | Security | Critical | **Pending** | Requires GitHub owner login |
| 0.2 | Enable GitHub 2FA on `Gendy92` owner account | Security | Critical | **Pending** | Requires GitHub owner login |
| 0.3 | Enable MFA for admin users in Supabase Auth | Security | Critical | **Pending** | Requires Supabase dashboard + admin devices |
| 0.4 | Insert Resend key + sender into `app_settings` and send test email | Feature | High | **Pending** | Requires actual `re_...` API key |
| 0.5 | Run `verify_high_priority.sql` + `tenant_isolation.sql` + Security Advisor UI | Security | Critical | **Pending** | Requires Supabase dashboard login |

---

## Phase 1 — This Week

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1.1 | Design decision: supervision system-locked audit row | High | **Done** | Decision adopted; implemented in v294 |
| 1.2 | Design decision: retention / holdback model | High | **Done** | Decision adopted; implemented in v294 |
| 1.3 | UI input validation to block `paid_amount > amount` | High | **Done** | Hard guard in `Crud.save()` (v291+) |
| 1.4 | Unit tests for balance, supervision, payroll math | High | **Done** | `tests/unit/accounting.test.js` + `tests/unit/crud.test.js` |
| 1.5 | Patch vitest/vite/esbuild vulnerabilities | High | **Done** | `npm audit` reports 0 vulnerabilities |
| 1.6 | Fix ESLint warnings | Medium | **Done** | 0 errors, 0 warnings (verified `npm run lint`) |
| 1.7 | Protect `main` and `dev.2` with required status checks | High | **Pending** | Requires GitHub owner settings |
| 1.8 | Fast-forward or delete `dev.2` | Low | **Done** | `dev.2` is now fast-forwarded to `main` |

---

## Phase 2 — Short Term (next 2–4 weeks)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.1 | Implement retention / holdback tracking | High | **Done** | `projects.retention_percentage`, `retention_withheld`/`retention_released`, auto-withholding trigger |
| 2.2 | Generate system-locked supervision audit rows | High | **Done** | `project_period_closes`, `close_project_period()` / `reopen_project_period()` RPCs |
| 2.3 | Items catalog UI | High | **Done** | Exists in Master Data screen |
| 2.4 | Custody expenses UI | High | **Partial** | UI exists but spent/returned split not fully wired; verify `custody_expenses` table usage |
| 2.5 | Employee transactions UI | High | **Partial** | Bonuses/penalties consumed in payroll; standalone add/edit screen not implemented |
| 2.6 | Salary history UI | Medium | **Done** | Exists in Employees |
| 2.7 | Real Settings page | High | **Done** | Company settings + users/permissions + backup |
| 2.8 | Restore-from-backup | High | **Done** | UI exists in Settings → Backup |
| 2.9 | Server-side pagination + indexes | High | **Done** | Common indexes added in `migration_v293_add_common_indexes.sql` |
| 2.10 | Update outdated docs | Medium | **In Progress** | CHANGELOG and SECURITY_HARDENING updated; TEST_PLAN/TEST_DATA/APP_TABS_GUIDE/ROADMAP still stale |
| 2.11 | Set up staging Supabase + monthly restore test | High | **Pending** | Requires new Supabase project |
| 2.12 | Rotate Supabase service-role and anon keys | High | **Pending** | Requires Supabase dashboard + GitHub Secrets |

---

## Phase 3 — Medium Term (1–3 months)

| # | Task | Priority | Status |
|---|------|----------|--------|
| 3.1 | Invoicing module with PDF export | High | Pending |
| 3.2 | Inventory / stock tracking | High | Pending |
| 3.3 | P&L, aging, cash-flow reports | High | Pending |
| 3.4 | Document attachments via Supabase Storage | Medium | Pending |
| 3.5 | Notifications / alerts | Medium | Pending |
| 3.6 | PWA offline fallback + background sync queue | Medium | Pending |

## Phase 4 — Long Term

| # | Task | Priority | Status |
|---|------|----------|--------|
| 4.1 | Evaluate migration to frontend framework | Low | Pending |
| 4.2 | Move more business logic to DB triggers / Edge Functions | Medium | Pending |
| 4.3 | End-to-end tests with Playwright | Medium | Pending |
| 4.4 | Split `crud.js` and `app-loaders.js` into per-module files | Low | Pending |

---

## Recent Commits

- `0e8a0ab` — fix: handle soft-deleted deposits in retention sync trigger + regenerate specs
- `c4eadcb` — feat: v294 retention/holdback tracking + supervision period-close audit rows
- `18dd0c4` — ci: Dependabot weekly npm updates
- `2f93da7` — build: `npm run health` script
- `edbe70d` — test: expand Utils tests (clamp, ilikeOr, sleep)
- `c138724` — test: add Auth.fromEmail and safeName unit tests
- `682f7e1` — chore: expose App on window
- `344958a` — ci: run npm audit in CI/deploy workflows
- `b52eb1d` — test: expose API/Crud on window + add Crud guard tests
- `7a95736` — perf: v293 add common indexes
- `160886b` — ci: secret-scan workflow
- `5445fb8` — docs+security: changelog v292, hardening status, pre-commit hook
- `58968e2` — feat: v292 office_vendor_income SQL alignment + accounting unit tests
