# Sara-Arch Security Hardening Action Plan

> Last updated: 2026-06-29 (v273 deployed)

## 1. Current Findings

### Supabase Security Advisor (active)
| Finding | Risk | Status |
|---------|------|--------|
| 6 balance/transaction views run as `SECURITY DEFINER` (bypass RLS) | **High** — any authenticated user could read balances across tenants if they query the view directly | **Fixed in v270** |
| `schema_migrations` table has RLS disabled | Medium — version history is readable by authenticated users | **Fixed in v270** |

### Other Known Risks
| Risk | Impact | Status |
|------|--------|--------|
| SMTP not configured for Supabase Auth | Password-reset emails are not actually sent | Open — requires Supabase project config |
| `log_app_error()` granted to `anon` | Potential small DoS / log-spam vector | **Fixed in v273** — per-IP server-side rate limit + client-side throttle |
| PWA service-worker cache | Users may run stale JS until hard refresh | **Fixed in v271** — update prompt added |
| CI migration runner used Node 20 without native WebSocket support | Deploy pipeline failed at migration step | **Fixed in v270** |

## 2. Immediate Fixes Applied (v270)

### 2.1 Balance views now respect RLS
The following views were switched to `security_invoker` so they evaluate the caller's privileges and honor the tenant-scoped RLS policies on their base tables:

- `public.project_balances`
- `public.client_balances`
- `public.vendor_balances`
- `public.office_balance`
- `public.office_transactions_view`
- `public.project_transactions_view`

Files changed:
- `schema_full_fix.sql` — view definitions now include `WITH (security_invoker = true)`.
- `migration_v270_security_advisor_hardening.sql` — idempotent `ALTER VIEW ... SET (security_invoker = true)` for existing databases, guarded for Postgres 15+.

### 2.2 `schema_migrations` RLS enabled
- `ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;`
- No policies are granted to `authenticated`; the migration runner accesses the table through the `SECURITY DEFINER` `apply_migration()` function running as the postgres owner.

### 2.3 CI migration runner fixed
- `scripts/run-migrations.js` now creates the Supabase client with `realtime: { enabled: false }`, removing the Node 20 WebSocket dependency.
- GitHub Actions workflows (`pages.yml`, `ci.yml`) updated to Node 22.

## 3. Verification Checklist

After CI deploys v270 and migrations run:

- [ ] Open Supabase **Security Advisor** and confirm the 6 view warnings and the `schema_migrations` warning are gone.
- [ ] Log in as a **non-admin user** and verify project/vendor/client/office balances still show only the current tenant's data.
- [ ] Log in as an **admin** and verify the same screens still work.
- [ ] Open browser DevTools → Network and confirm `version.json` returns `273`, assets load with `?v=273`, and the service worker registers as `sw.js?v=273`.
- [ ] Confirm the GitHub Actions `deploy` workflow reaches the "All migrations applied" step.

## 4. Short-Term Hardening (v271)

1. **Review `SECURITY DEFINER` functions** ✅
   - `apply_migration` — service_role only ✔
   - `admin_reset_password`, `admin_create_auth_user`, `admin_update_auth_email` — admin checks ✔
   - `get_current_tenant_id`, `is_app_admin` — helper functions, no direct grants ✔
   - `log_app_error` — per-IP server-side rate limit + client-side throttle (v273).

2. **Rate-limit `log_app_error`** ✅
   - Added `app_error_throttle` table and rewrote `log_app_error()` to drop reports beyond 10/min per IP.
   - Added client-side deduplication in `js/error-reporter.js`.

3. **Tenant-isolation regression test** ✅
   - Added `tests/tenant_isolation.sql` — run it in the Supabase SQL Editor to verify isolation.

## 5. Manual Hardening (see `docs/SECURITY_RUNBOOK.md`)

The steps below require Supabase dashboard / GitHub Secrets access and are documented in detail in `docs/SECURITY_RUNBOOK.md`:

- **Rotate Supabase API keys** and update GitHub Secrets.
- **Enable MFA** for admin accounts.
- **Configure SMTP / Auth provider** so password-reset emails actually deliver.
- **Restore a daily backup to staging** monthly to prove the restore path works.
- **Review `app_errors` and `audit_logs`** weekly for anomalies.
- **Network restrictions**: restrict Supabase API keys by referer/IP where possible.

## 6. Decision Log

| Decision | Rationale |
|----------|-----------|
| Switch views to `security_invoker` instead of re-writing them | Underlying tables already have tenant-scoped RLS (migration v240). Invoker mode lets those policies enforce isolation without changing view logic. |
| No `authenticated` policy on `schema_migrations` | The table is an internal runner detail; denying all app-user access is the safest default. The `apply_migration` function runs as the postgres owner and bypasses RLS. |
| Keep `log_app_error` as `SECURITY DEFINER` for now | It intentionally allows anonymous clients to report JS errors. We will mitigate with rate limiting rather than removing the capability. |
