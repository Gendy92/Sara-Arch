# Sara Arch — Changelog

> **Current version:** v239  
> **Branch:** `dev.2` / `main` (fast-forward synced)  
> **Last updated:** 2026-06-22

---

## Version 239 (Current)

### Added
- **Restore-from-backup UI** in the Backup screen: preview ZIP contents and restore data table-by-table using upsert.
- `API.upsert()` helper in `api.js` for conflict-aware bulk inserts.
- Marketing **landing page** (`landing.html`) with hero, features, pricing, and CTA.

### Changed
- `COMMERCIAL_READINESS.md` updated to reference the landing page.
- Bumped runtime, service-worker cache, and asset query-string version to `239`.

## Version 238

### Added
- Commercial readiness package: `COMMERCIAL_READINESS.md` with pricing, terms, SLA, support workflow, privacy policy, and onboarding checklist.

### Changed
- **XSS hardening pass** in `app-loaders.js`: payment method and payment term badges are now escaped before rendering in transactions and office tables.
- **Payroll regeneration** now resets `paid` records back to `draft` so they can be reviewed/edited again, and updates the linked office expense transaction.
- **Navigation:** removed **📋 البيانات الأساسية** from the main sidebar; it remains accessible inside **⚙️ الإعدادات**.
- Bumped runtime, service-worker cache, and asset query-string version to `238`.

## Version 237

### Added
- New **Office Income** (`📈 إيراد مكتبي`) button and `type = 'income'` transaction support.
- Office vendor seed: **"مكتب سارة أبو العلا"** (`vendors.is_office = true`) for internal income attribution.
- Confirmation guard when selecting the internal office vendor on project expenses to avoid double-counting costs.
- Excel-style spreadsheet entry for custody expenses (office and project templates).
- Custody expense type picker (office vs. project) with auto-opening of the correct sheet.
- Custody employee shown in expense sheets and custody picker locked until expense type is chosen.
- Project cascade enforced: **Project** input disabled until **Client** is selected in all forms and spreadsheets.

### Changed
- Simplified custody entry by removing `custody_type` selector from Add Custody and adding **Office Custody Expense** directly on the Office screen.
- Removed **التصنيف** column from the Add Cash Custody form.
- Updated `office_balance`, `office_transactions_view`, dashboard KPIs, and monthly revenue/expense RPCs to include office-vendor income and `income` transactions.
- Updated searchable dropdown scope and linked Client ↔ Project cascade inside spreadsheets.
- Sara-vendor warning text clarified to explain design fees / equipment rental should be recorded as office income.
- Bumped runtime, service-worker cache, and asset query-string version to `237`.

## Version 175

### Added
- `admin_create_auth_user` now upserts the `profiles` row atomically inside the same transaction, eliminating orphaned `auth.users` rows.
- New `auth_user_exists(user_email)` RPC for duplicate-email pre-checks.
- Unique constraint `profiles_username_unique` on `profiles.username`.
- `addUser()` now pre-checks duplicate username and email and reports per-row failure reasons.

### Changed
- `addUser()` no longer does a separate client-side profile POST/PATCH; it relies on the atomic RPC.
- `editUser()` no longer creates a username-less profile fallback; it errors if the profile is missing.
- Tightened `_isMissingColumnErr()` to only treat `PGRST204` / `42703` as missing-column errors.
- Bumped runtime version to `175`.

---

## Version 174

### Added
- `migration_v173_legacy_procurements.sql` to normalize legacy procurement and project_expense payment tracking.
- Server-side negative-value guard for all financial numeric fields.
- Procurement add/edit now defaults to `payment_term='immediate'` and `paid_amount=quantity*unit_price`.

### Changed
- `Crud.save()` now strips the generated `total_price` column for procurements and accepts an optional pre-fetched `oldData` row for reliable audit logging.
- `Crud.bulkSave()` rejects negative financial values and strips generated `total_price`.
- Bumped runtime version to `174`.

---

## Version 173

### Added
- `auto_confirm_user` trigger on `auth.users` so every new user is confirmed automatically.
- Backfill update to confirm any existing unconfirmed accounts.
- Public signup/login now returns a valid session for non-admin users.

### Changed
- Applied `schema_full_fix.sql` (idempotent) through the Supabase Management API.
- Updated `ROADMAP.md` and known-issues list to reflect completed critical fixes.

---

## Version 172

### Added
- Server-side user creation via `admin_create_auth_user` Postgres function; no service-role key in the browser.
- Username-to-email mapping with `@gendy92.github.io` domain and legacy `@local` fallback.
- Procurement form section grouping (`التعريف`, `القيمة`, `التفاصيل`).
- `LOGIC_SPEC.md` and generated `LOGIC_SPEC-v1.xlsx` accounting reference workbook.

### Changed
- Modal redesign: sticky header/footer, scrollable body, RTL actions, mobile bottom-sheet.
- Client/project balances now subtract supervision consistently across dashboard, lists, and detail views.
- Overpayment validation rejects `paid_amount > amount` for transactions and `paid_amount > total_price` for procurements.
- `schema_full_fix.sql` made idempotent with updated dashboard RPC signatures and deduplicated sectors.
- Documentation (`README.md`, `DOCUMENTATION.md`) synchronized with auth, Pages Actions, and backup secrets.

---

## Version 162

### Added
- Clickable client, project, and vendor detail views with deep summary cards.
- Navigation from lists to detail screens for clients, projects, and vendors.

### Changed
- Updated service-worker cache and version metadata to v162.

---

## Recent Versions (v137 → v162)

### v161
- Added a global **Tasks** screen with status filter (`pending`, `in_progress`, `done`).
- Enabled tasks navigation in the main menu.

### v160
- Restored **PDF print export** for client, project, and vendor statements.
- Fixed print-specific CSS for cleaner output.

### v159
- Added **Excel download** for project statement and project budget.

### v158
- Enhanced custody (عهد نقدية) with office/project type selection and conditional fields.

### v157
- Added custody money management inside the Office tab, linked to employee and sector.

### v156
- Vendor statement and purchases now show paid vs. owed amounts with balance color coding.

### v155
- Paginated project transactions (10 rows per page) for the main table and expenses tab.
- Bounded dashboard KPI queries to 1000 rows to improve performance.

### v154
- Added **Excel download** for client statement.

### v153
- Added **Excel download** for vendor statement and vendor purchases.

### v152
- Fixed Excel paste/import data entry.
- Added reference sheet to Excel templates.
- Fixed report Excel column widths.

### v151
- Replaced standard selects with fast searchable dropdowns for clients, vendors, projects, sections, items, and more.

### v150
- Added vendor outstanding balance display inside the Vendors screen.

### v149
- Preserved the Supabase service key during cache clear operations.

### v148
- Added dashboard Top 10 lists.
- Added project remaining balance column.
- Applied dashboard query limits.

### v147
- Fixed `deleted_at` filters on edit operations.
- Updated project budget to include procurements.
- Updated project statement to exclude owner deposits.
- Added limit to vendor purchases query.

### v146
- Improved SQL cleanup script using `DISTINCT ON` instead of `MIN(uuid)`.

### v145
- Simplified SQL cleanup script syntax; removed CTEs.

### v144
- Added duplicate detection for all master data: sectors, work sections, work items, and items.
- Added SQL cleanup script for duplicate master data.

### v143
- Hidden pagination controls on empty lists.
- Final UI polish.

### v142
- Fixed pagination edge cases: made `API.count` resilient to errors and `_paginationHtml` handles `NaN`.

### v141
- Fixed critical bugs: audit logging, silent API errors, pagination, and iOS input zoom.

### v140
- Fixed user creation to work without a service key.
- Added service-key validation on save.
- Added auto-reload and clearer diagnostics.

### v139
- Created users via `authSignUp` without requiring a service role key.

### v138
- Fixed user listing to show auth users when profiles table is empty.
- Auto-create profile on registration.
- Improved invalid service-key warning.

### v137
- Made user listing work without a service key by falling back to the `profiles` table.

---

## Schema & Migration History

| Migration | Purpose |
|-----------|---------|
| `schema.sql` | Initial full database schema with tables, triggers, RLS, and seed data. |
| `schema_full_fix.sql` | Consolidated schema fix with corrected foreign keys and columns. |
| `migration_v109.sql` | Added `project_tasks` table and related indexes. |
| `migration_v119_drop_tax.sql` | Removed tax columns from `transactions` and `procurements`. |
| `migration_v130_fix_transactions.sql` | Added missing transaction columns (`section_id`, `item_id`, `payment_term`, `paid_amount`, etc.). |
| `import_work_sections_items.sql` | Seeded work sections and ~50 work items. |
| `cleanup_duplicate_master_data.sql` | Soft-deleted duplicate master-data rows by normalized name. |

---

## Known Issues at v239

- Some documentation (`APP_TABS_GUIDE.md`, `TEST_PLAN.md`, `acceptance-results.md`) lags behind runtime version.
- Employee module is documented as on hold; attendance RLS is currently open per `LOGIC_SPEC.md`.
- RLS policies are currently open to all authenticated users; true data isolation requires separate Supabase projects per client or a multi-tenancy refactor.

### Resolved at v175
- ✅ Orphaned `auth.users` rows on partial user creation (profile upsert moved into atomic RPC).
- ✅ Duplicate username/email pre-checks in `addUser()`.
- ✅ Per-row error reporting in `addUser()`.
- ✅ `editUser()` no longer creates broken username-less profiles.
- ✅ Missing-column error detection tightened.

### Resolved at v174
- ✅ Procurement `total_price` save consistency (generated column; stripped from client payloads).
- ✅ Legacy procurements / project_expense rows without `payment_term` normalized to `immediate` and fully paid.
- ✅ Audit trail `old_data` reliability improved (explicit pre-fetch helper + optional caller-provided old row).
- ✅ Negative financial inputs blocked at the data layer and via `min="0"` on all number fields.

### Resolved at v173
- ✅ Non-admin login blocked by `email_not_confirmed`.
- ✅ Service-role key removed from client-side config; used only in GitHub Actions backup secret.

See [ROADMAP.md](./ROADMAP.md) for planned fixes and features.
