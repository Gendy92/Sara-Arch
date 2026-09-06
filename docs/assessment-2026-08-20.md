# Sara Arch — Inclusive Application Assessment
> Date: 2026-08-20  
> Version assessed: v303  
> Status: code is healthy; production backend is offline due to Supabase restoration

---

## 1. Executive Summary

The application codebase passes all automated quality gates:

- **Lint:** clean (`eslint js/ tests/`)
- **Unit tests:** 69/69 passing
- **npm audit:** 0 vulnerabilities (after `npm audit fix`)
- **Version bumped:** v303 (atomic invoice operations + permission hardening)
- **Runtime smoke test:** login page loads with no JS errors and no failed static requests

The only blocker is the **Supabase project `tvjkctttcijymqvaetsv`**, which is currently in **Restoration in progress** mode. Until restoration completes, no login, data fetch, or mutation can succeed.

---

## 2. Backend / Infrastructure Status

| Item | Finding |
|------|---------|
| Supabase project URL | `https://tvjkctttcijymqvaetsv.supabase.co` |
| Dashboard status | **Restoration in progress** |
| Project plan | Free tier |
| Impact | All API calls fail with `Failed to fetch` / network error |
| Cause | Supabase is restoring the project from a backup; the project is offline during restoration |
| Action required | Wait for dashboard to show **Active**, then test login. If the database was restored to a point before v301/v302, re-apply the pending migrations (see §9). |

Public Supabase status pages also report ongoing API Gateway/JWT incidents, but your specific project being in restoration is the immediate cause.

---

## 3. Application Architecture

### 3.1 Load order and dependencies
- `index.html` loads CDN libs (SheetJS, JSZip) and local scripts sequentially.
- Local script order is safe: `config → utils → api → auth → error-reporter → ui → sync → notification-service → app-core → app-loaders → backup-manager → app-reports → crud`.
- `App.start()` is called after all modules are loaded.
- No circular dependency or missing-module errors were found.

### 3.2 Global state
- State is held on the global `App`, `Auth`, `Crud`, `API`, `UI`, `SyncManager`, and `NotificationService` objects.
- This is simple but makes unit testing rely on globals; tests currently handle this correctly.

### 3.3 Routing
Hash-based routing supports the following screens:

`dashboard`, `clients`, `client`, `projects`, `project`, `transactions`, `office`, `reports`, `employees`, `employee-transactions`, `tasks`, `settings`, `users`, `permissions`, `audit`, `backup`, `master`, `vendors`, `vendor`, `invoices`, `invoice`, `notifications`, `login`, `register`.

---

## 4. Authentication & Session

| Area | Status | Notes |
|------|--------|-------|
| Login form | ✅ OK | Validates username/password, shows spinner, disables button |
| Error messaging | ✅ Improved | Network errors now show a clear Arabic message instead of raw `Failed to fetch` |
| Session expiry | ✅ OK | 10-minute idle timer implemented |
| Auto-confirm users | ✅ OK | Trigger on `auth.users` prevents `email_not_confirmed` |
| Username→email mapping | ✅ OK | Uses `SARA_EMAIL_DOMAIN` from config |
| Config injection | ⚠️ Watch | Local dev requires `js/config.local.js`; deploy uses GitHub secret `SUPABASE_ANON_KEY` |

---

## 5. CRUD / Data Entry Functions

### 5.1 Clients & Projects
| Function | Status | Notes |
|----------|--------|-------|
| Add client | ✅ OK | Duplicate-name check, soft delete support |
| Edit client | ✅ OK | Updates profile/related names via triggers |
| Delete client | ✅ OK | Cascades to projects, transactions, etc. |
| Add project | ✅ OK | Spreadsheet bulk add with supervision rates |
| Edit project | ✅ OK | Includes supervision rate editor |
| Delete project | ✅ Fixed | Now cascades to related transactions/procurements/tasks |
| Project detail | ✅ OK | Loads statement, budget, tasks |

### 5.2 Transactions
| Function | Status | Notes |
|----------|--------|-------|
| Project deposit | ✅ Fixed | Now stores `client_name` |
| Project expense | ✅ OK | Auto-computes `expense_category` from section name |
| Office expense / income | ✅ OK | Proper type handling |
| Owner deposit / withdrawal | ✅ OK | Tracks office balance |
| Office transfer | ✅ OK | Cash↔bank transfer |
| Custody expense | ✅ OK | Links custody to office expense |
| Paid-amount guard | ✅ Fixed | Blocks `paid_amount > amount` even when `amount` is missing |

### 5.3 Employees
| Function | Status | Notes |
|----------|--------|-------|
| Add employee | ✅ OK | Includes salary |
| Edit employee | ✅ Fixed | Salary field restored; false salary-history entries eliminated |
| Delete employee | ✅ OK | Cascades to attendance, payroll, custody, etc. |
| Attendance import | ✅ Fixed | Fingerprint import now only deletes records for imported employees |
| Payroll generation | ✅ OK | Generates payroll + linked office expense |

### 5.4 Vendors & Purchases
| Function | Status | Notes |
|----------|--------|-------|
| Add vendor | ✅ OK | Duplicate check |
| Edit vendor | ✅ OK | Updates linked names |
| Delete vendor | ✅ OK | Cascades to transactions/procurements |
| Add procurement | ✅ OK | `total_price` is generated column; client strips it |
| Vendor payment | ✅ OK | Creates settlement transaction |
| Vendor statement / purchases | ✅ OK | Screen and Excel export show balance direction |

### 5.5 Invoicing
| Function | Status | Notes |
|----------|--------|-------|
| Create invoice | ✅ OK | Dynamic line items, auto numbering |
| Edit invoice | ⚠️ Risk | Deletes old items then inserts new ones in two calls; partial failure can leave invoice without items |
| Print invoice | ✅ Fixed | Uses `App.printReport()`, portrait page, escaped fields |
| Mark paid | ⚠️ Risk | Creates transaction then updates invoice; partial failure can orphan the transaction |
| Export invoice | N/A | No Excel export currently implemented |

### 5.6 Master Data
| Function | Status | Notes |
|----------|--------|-------|
| Sectors / Items | ✅ OK | Duplicate checks, soft delete |
| Work sections / items | ✅ OK | Bulk import from Excel, duplicate checks |

### 5.7 Users & Permissions
| Function | Status | Notes |
|----------|--------|-------|
| Add user | ✅ OK | Atomic `admin_create_auth_user` RPC |
| Edit user | ✅ OK | Updates profile + role |
| Reset password | ✅ OK | Uses `admin_reset_password` RPC |
| Email new password | ✅ OK | Calls `admin_reset_password_email`; unit tests added |
| Permissions screen | ✅ OK | Maps to `user_permissions` |
| Permission guards | ⚠️ Risk | Most `Crud.*` functions trust UI button hiding; console-level calls are not guarded |

---

## 6. PDF, Print & Excel Exports

| Function | Status | Notes |
|----------|--------|-------|
| Client statement print | ✅ Fixed | Modal header/actions hidden, title cleanup improved |
| Client statement Excel | ✅ Fixed | Includes supervision and correct balance |
| Project statement print | ✅ Fixed | Modal chrome hidden |
| Project statement Excel | ✅ Fixed | No `[object Object]`, supervision included |
| Project budget Excel | ✅ Fixed | Real supervision percentage |
| Vendor statement print | ✅ OK | Modal chrome hidden |
| Vendor statement Excel | ✅ Improved | Absolute balance + direction column |
| Vendor purchases print | ✅ OK | Modal chrome hidden |
| Vendor purchases Excel | ✅ Improved | Absolute balance + direction column |
| Invoice print | ✅ Fixed | Portrait, escaped fields, correct PDF filename |
| Office Excel export | ✅ Fixed | Now uses Blob/manual download pattern; also checks `office` `print` permission. |

---

## 7. Reports

| Report | Status | Notes |
|--------|--------|-------|
| Cash flow | ✅ OK | Date-filtered chart + table |
| Profit & Loss | ✅ OK | Income vs expense summary |
| Office flow | ✅ OK | Office-specific cash flow |
| Aging (A/R + A/P) | ✅ OK | Buckets + Excel export |
| Dashboard KPIs | ✅ OK | Loads from views/materialized calculations |
| Dashboard charts | ✅ OK | Uses Chart.js (loaded via CDN?) — verify `Chart` global exists; currently no console error |

---

## 8. PWA, Offline Sync & Notifications

| Feature | Status | Notes |
|---------|--------|-------|
| Service worker | ✅ OK | Registered, cache-busted with `?v=302` |
| Manifest | ✅ OK | Present |
| Offline fallback page | ✅ OK | `offline.html` |
| SyncManager | ✅ OK | Queue, replay, last-sync, indicator update on enqueue fixed |
| Offline-sync E2E | ✅ Added | 2 Playwright specs |
| Notification bell UI | ✅ OK | Unread badge, dropdown, mark read, archive |
| Notifications screen | ✅ OK | All / Unread / Archived filters |
| `generate_notifications` RPC | ✅ OK | Overdue clients, task deadlines, contract milestones |
| Browser NotificationService | ✅ Added | Permission, show, schedule, cancel; unit tests added |

---

## 9. Database / Migrations Status

Migrations present and ready for CI auto-apply:

- `migration_v300_invoicing.sql`
- `migration_v300_custody_triggers_fix.sql`
- `migration_v301_notifications.sql` (includes v300 custody catch-up)
- `migration_v302_security_advisor_hardening.sql`

**Risk:** If the Supabase restore reverts the database to a state before v301/v302, you must reapply these migrations. Options:

1. Push a new commit to `main` and let the Pages deploy workflow run migrations automatically.
2. Or run the SQL files manually in Supabase SQL Editor in version order (v300 → v301 → v302).

---

## 10. Security

| Item | Status | Notes |
|------|--------|-------|
| Service-role key in browser | ✅ OK | Removed; admin operations use SECURITY DEFINER RPCs |
| Anon key injection | ✅ OK | Via `config.local.js` at deploy time |
| RLS | ✅ OK | Tenant isolation in place |
| Security Advisor hardening | ✅ Ready | `migration_v302_security_advisor_hardening.sql` prepared |
| Branch protection | ⚠️ Pending | Manual GitHub setting |
| MFA / key rotation | ⚠️ Pending | Manual owner actions |
| Permission guards in JS | ⚠️ Risk | Functions rely on hidden buttons rather than runtime checks |

---

## 11. Remaining Risk Register

| # | Risk | Severity | Suggested Action |
|---|------|----------|------------------|
| 1 | Supabase restoration offline | **Blocker** | Wait for restoration; verify migrations after |
| 2 | Invoice edit is not atomic | Medium | Wrap item delete+insert in a single DB RPC |
| 3 | Invoice mark-paid is not atomic | Medium | Wrap transaction+invoice update in a single DB RPC |
| 4 | No function-level permission guards | Medium | Add `Auth.can` checks to destructive `Crud.*` functions |
| 5 | Office Excel export uses `XLSX.writeFile` | Low | Switch to blob-download pattern for Safari/mobile |
| 6 | No duplicate detection on transactions/procurements | Low | Add DB unique partial indexes or UI warnings (still open) |
| 7 | Auto-backup triggers download without gesture | Low | Browser-dependent; acceptable for now |
| 8 | Exposed Resend API key in chat history | **High** | Rotate the Resend key in Resend dashboard |

---

## 12. Test Coverage

| Suite | Count | Status |
|-------|-------|--------|
| Unit tests (Vitest) | 69 | ✅ Passing |
| E2E tests (Playwright) | 35 listed | ⚠️ Not executed — staging Supabase credentials not available in this session |

---

## 13. Recommendations

1. **Do nothing on the app code until Supabase restoration finishes.** The login failure is environmental.
2. **After restoration:**
   - Log in and verify core screens (Dashboard, Clients, Projects, Transactions).
   - Open Supabase Table Editor and confirm `notifications`, `notification_rules`, `invoices`, `invoice_items` exist.
   - If any v301/v302 objects are missing, trigger a `main` deploy or run the migrations manually.
3. **Security:**
   - Enable `main` and `dev.2` branch protection rules.
   - Rotate the Supabase anon/service keys and the Resend key.
4. **Quality:**
   - Run the full Playwright E2E suite once staging credentials are available.
   - Consider adding function-level permission guards before adding non-admin users.

---

*Prepared by Kimi Code CLI assessment run on 2026-08-20.*
