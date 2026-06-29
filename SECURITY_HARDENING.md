# Sara-Arch Security Hardening Action Plan

> Last updated: 2026-06-29 (v271 deployed)

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
| `log_app_error()` granted to `anon` | Potential small DoS / log-spam vector | Open — review in v271 |
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
- [ ] Open browser DevTools → Network and confirm `version.json` returns `270`, assets load with `?v=270`, and the service worker registers as `sw.js?v=270`.
- [ ] Confirm the GitHub Actions `deploy` workflow reaches the "All migrations applied" step.

## 4. Short-Term Hardening (v271)

1. **Review `SECURITY DEFINER` functions**
   - `apply_migration` — service_role only ✔
   - `admin_reset_password`, `admin_create_auth_user`, `admin_update_auth_email` — admin checks ✔
   - `get_current_tenant_id`, `is_app_admin` — helper functions, no direct grants ✔
   - `log_app_error` — consider removing `anon` grant or adding a rate-limit check.

2. **Rate-limit `log_app_error`**
   - Add an in-memory or per-IP throttle in `js/error-reporter.js`.
   - Alternatively restrict the RPC to `authenticated` only and drop `anon` grant.

3. **Tenant-isolation regression test** ✅
   - Added `tests/tenant_isolation.sql` — run it in the Supabase SQL Editor to verify isolation.

## 5. Medium-Term Hardening

- **SMTP / Auth provider**: Configure Supabase Auth with a real email provider so password-reset emails actually deliver.
- **Admin MFA**: Enforce MFA for admin accounts in Supabase Auth settings.
- **Network restrictions**: Restrict Supabase API keys by referer/IP where possible.
- **Secrets audit**: rotate `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` periodically; confirm they are only in GitHub Secrets and local `.env` (gitignored).
- **Backup verification**: restore the daily SQL backup to a staging project monthly.
- **Audit log review**: schedule a weekly review of `app_errors` and `audit_logs` for anomalies.

## 6. Decision Log

| Decision | Rationale |
|----------|-----------|
| Switch views to `security_invoker` instead of re-writing them | Underlying tables already have tenant-scoped RLS (migration v240). Invoker mode lets those policies enforce isolation without changing view logic. |
| No `authenticated` policy on `schema_migrations` | The table is an internal runner detail; denying all app-user access is the safest default. The `apply_migration` function runs as the postgres owner and bypasses RLS. |
| Keep `log_app_error` as `SECURITY DEFINER` for now | It intentionally allows anonymous clients to report JS errors. We will mitigate with rate limiting rather than removing the capability. |
