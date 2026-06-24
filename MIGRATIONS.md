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

## Adding a new migration

1. Create `migration_v<NNN>_<short_desc>.sql`.
2. Add the same SQL block to `schema_full_fix.sql` in the appropriate section.
3. Update this log and mark the status as **Pending**.
4. The next `main` deploy will apply it automatically and the status will be updated by the CI log.
