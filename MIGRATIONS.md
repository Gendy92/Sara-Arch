# Database Migrations Log

The canonical full schema is in `schema_full_fix.sql`. New migrations should be appended to this file
and also saved as `migration_v<NNN>_<description>.sql`.

## Automated migrations (after v264)

Once `migration_v264_migration_runner.sql` has been applied manually one time, the GitHub Actions
Pages deploy workflow will automatically apply any pending `migration_*.sql` files after deploying
the front-end. No manual Supabase steps are needed for routine migrations.

## Manual one-time setup

Run `migration_v264_migration_runner.sql` in Supabase SQL Editor to create the `schema_migrations`
table and `apply_migration()` RPC.

Alternatively, run **`migration_v267_unified_recent_changes.sql`** once to apply all recent changes
(v263–v269) in a single file and bootstrap the migration tracker at the same time.

## Migration history

| Version | File | Description | Status | Run date | Notes |
|---------|------|-------------|--------|----------|-------|
| v109 | `migration_v109.sql` | Initial base migration | Applied | - | Legacy |
| v119 | `migration_v119_drop_tax.sql` | Drop tax column | Applied | - | Legacy |
| v130 | `migration_v130_fix_transactions.sql` | Fix transactions schema | Applied | - | Legacy |
| v173 | `migration_v173_legacy_procurements.sql` | Legacy procurements fixes | Applied | - | Legacy |
| v240 | `migration_v240_rls_tenants.sql` | RLS + multi-tenancy | Applied | - | Required for tenant isolation |
| v242 | `migration_v242_per_section_supervision.sql` | Per-section supervision rates | Applied | - | |
| v243 | `migration_v243_email_support.sql` | Username/email auth support | Applied | - | |
| v245 | `migration_v245_fix_dashboard.sql` | Dashboard fixes | Applied | - | |
| v248 | `migration_v248_cleanup_duplicate_work_items.sql` | Cleanup duplicate work items | Applied | - | |
| v256 | `migration_v256_add_custody_expenses_created_by.sql` | Add created_by/updated_by to custody_expenses | Applied | - | |
| v257 | `migration_v257_office_transfer.sql` | Office cash↔bank transfers | Applied | - | |
| v263 | `migration_v263_app_errors.sql` | Front-end error tracking table + RPC | **Auto** | - | Will be applied by CI after v264 runner is active |
| v264 | `migration_v264_migration_runner.sql` | Automated migration tracking + runner | **Pending (run once manually)** | - | Enables CI auto-migration |
| v265 | `migration_v265_auto_backup_logs.sql` | Backup log table with device + user details | **Auto** | - | Applied by CI after v264 runner |
| v266 | `migration_v266_admin_password_reset.sql` | Admin direct password reset RPC | **Auto** | - | Applied by CI after v264 runner |
| v267 | `migration_v267_unified_recent_changes.sql` | Unified migration for v263–v269 | **Manual (run once)** | - | Single file to bootstrap everything |
| v268 | `migration_v268_fix_profile_self_insert_rls.sql` | Prevent self-signup as admin | **Auto** | - | Applied by CI after v264 runner |
| v269 | `migration_v269_create_app_settings.sql` | Create missing app_settings table | **Auto** | - | Applied by CI after v264 runner |
| v270 | `migration_v270_security_advisor_hardening.sql` | Switch balance views to `security_invoker`, enable schema_migrations RLS | **Auto** | - | Applied by CI after v264 runner |
| v273 | `migration_v273_rate_limit_app_errors.sql` | Per-IP rate limit on `log_app_error()` + client-side throttle | **Auto** | - | Applied by CI after v264 runner |
| v285 | `migration_v285_stricter_tenant_isolation.sql` | Stricter tenant isolation policies + diagnostics | **Auto** | - | Applied by CI after v264 runner |
| v286 | `migration_v286_lock_apply_migration.sql` | Advisory lock around `apply_migration()` to prevent concurrent runs | **Auto** | - | Applied by CI after v264 runner |
| v287 | `migration_v287_cleanup_verification_helpers.sql` | Drop stale verification views/functions | **Auto** | - | Applied by CI after v264 runner |
| v288 | `migration_v288_fix_app_settings_admin_policy.sql` | Fix `app_settings` RLS admin policy | **Auto** | - | Applied by CI after v264 runner |
| v289 | `migration_v289_admin_reset_password_email.sql` | Admin "email new password" RPC + profile helper | **Auto** | - | Applied by CI after v264 runner |
| v291 | `migration_v291_fix_vendor_balance_after_project_expense_simplification.sql` | Separate accrual (`project_expense`) from cash settlement (`vendor_settlement`) in `vendor_balances` | **Auto** | - | Applied by CI after v264 runner |
| v292 | `migration_v292_fix_office_vendor_income.sql` | Align `office_vendor_income` with LOGIC_SPEC v1.5 (exclude `project_expense.paid_amount`) | **Auto** | - | Applied by CI after v264 runner; run `verify_high_priority.sql` after apply |
| v293 | `migration_v293_add_common_indexes.sql` | Add indexes for transactions, projects, employees, custody, audit | **Auto** | - | Applied by CI after v264 runner |
| v294 | `migration_v294_retention_and_supervision_audit.sql` | Retention/holdback tracking + supervision period-close audit rows | **Pending** | - | Apply after v264 runner is active; requires `npm run health` |

## Adding a new migration

1. Create `migration_v<NNN>_<short_desc>.sql`.
2. Add the same SQL block to `schema_full_fix.sql` in the appropriate section.
3. Update this log and mark the status as **Pending**.
4. The next `main` deploy will apply it automatically and the status will be updated by the CI log.
