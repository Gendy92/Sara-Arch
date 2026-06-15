# Sara-Arch — Improvement Suggestions

> Based on static analysis of runtime v162.  
> Priorities: 🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Low

---

## ✅ Recently Addressed (This Pass)

The following critical/high issues were fixed in the latest code pass:

- ✅ `Auth.can()` now defaults to deny when no permission row exists.
- ✅ Hardcoded Supabase keys removed from `js/config.js`, `scripts/backup.js`, `scripts/backup.sh`, and `.env`.
- ✅ Service-role key no longer stored in browser `localStorage`; admin UI removed.
- ✅ `js/config.local.js` (gitignored) introduced for local credentials.
- ✅ RLS policies in `schema_full_fix.sql` now restrict non-admin modifications to row owners.
- ✅ `schema_full_fix.sql` reconciled with app expectations (`due_date`, `username`, `notes`, `section_name`, `work_items.notes`, `project_tasks` trigger).
- ✅ Procurement save no longer sends `total_price` to the generated column.
- ✅ Procurement UI exposed in vendor purchases with add/edit/delete actions.
- ✅ Items catalog exposed in Master Data screen.
- ✅ Client and project statements now include procurements to match project budget.
- ✅ XSS mitigations in `UI.openModal`, `UI.actions`, searchable dropdowns, and key list screens.
- ✅ `project_tasks` added to backup export list.

> **Still required manually:** Rotate Supabase keys in the dashboard if they were ever committed or exposed.

---

## 🔴 Critical Suggestions (Fix Immediately)

### 1. Rotate Exposed Supabase Keys
**Why:** Service-role key and anon key are committed to the repository in `.env`, `scripts/backup.js`, and `js/config.js`.  
**Action:**
1. Rotate the Supabase service-role key and anon key in the Supabase dashboard.
2. Add `.env` to `.gitignore`.
3. Remove `scripts/backup.js` hardcoded key; read from GitHub secret only.
4. For client config, consider using a build step or injecting environment variables at deploy time.

### 2. Remove Service-Role Key from Browser
**Why:** The app stores `SUPABASE_SERVICE_KEY` in `localStorage` and sends it from the browser in admin API calls. Any XSS vulnerability gives full database access.  
**Action:**
- Move admin user operations (`authListUsers`, `authCreateUser`, `authUpdateUser`) to a Supabase Edge Function or a secure backend proxy.
- Delete the service-key input UI from Settings.
- Never expose service keys in client-side bundles.

### 3. Fix `Auth.can()` Default Permission
**Why:** `Auth.can()` returns `true` when no permission row exists, meaning new users get full access until permissions are explicitly configured.  
**Action:**
```js
// js/auth.js
static can(screen, action) {
  if (Auth.isAdmin()) return true;
  const p = Auth.permissions.find(x => x.screen === screen);
  return p ? !!p[`can_${action}`] : false;
}
```

### 4. Implement Real RLS Policies
**Why:** All tables use `authenticated_all` (`USING (true)`), so any logged-in user can read/write/delete any row.  
**Action:**
- Replace with ownership-based policies: `created_by = auth.uid()` or `role = 'admin'`.
- For shared data (e.g., clients, projects), use a tenant/organization model or explicit access lists.
- Test policies with a non-admin user before deploying.

### 5. Escape User-Controlled HTML Output
**Why:** Multiple `innerHTML` interpolations render client/vendor/employee names without escaping, enabling stored XSS.  
**Action:**
- Use `App.esc()` (or `textContent`) for all user-supplied text in lists, tables, modals, and dropdowns.
- Audit every `innerHTML`/`insertAdjacentHTML` usage in `js/app-loaders.js`, `js/crud.js`, and `js/ui.js`.

### 6. Unify Schema Baseline
**Why:** `schema.sql` + migrations vs `schema_full_fix.sql` produce different effective schemas; code expects `project_tasks.due_date`, `profiles.username`, and `payroll_records.notes`.  
**Action:**
- Pick one canonical baseline (`schema.sql` + migrations is recommended).
- If keeping `schema_full_fix.sql`, add migrations to add `due_date`, `username`, and `notes`.
- Document the exact migration order in `README.md`.

### 7. Fix Procurement Save (`total_price`)
**Why:** Code sends `total_price` to a generated column, which PostgreSQL rejects.  
**Action:**
```js
// In addProcurement/editProcurement, remove total_price from payload
delete data.total_price;
```
- Also expose procurement CRUD in the vendor UI (currently dead code).

### 8. Fix Statement vs Budget Discrepancy
**Why:** Client/project statements exclude procurements, but project budget includes them, causing reports to disagree.  
**Action:**
- Include procurements in client/project statements as expense rows.
- Or clearly separate "operational transactions" from "procurement purchases" in reporting.

---

## 🟠 High Priority Suggestions

### 9. Add Server-Side Aggregation
**Why:** Dashboard and statements load thousands of rows into the browser and sum them client-side.  
**Action:**
- Create PostgreSQL views or functions for balances:
  - `vw_client_balances`
  - `vw_project_budgets`
  - `vw_vendor_balances`
  - `vw_office_balance`
- Update dashboard and report screens to query these views.

### 10. Fix Pagination and Data Truncation
**Why:** Transactions "All" tab loads only the latest 100 rows silently; vendor statements cap at 200 rows.  
**Action:**
- Use server-side pagination with `limit`/`offset` and total counts.
- Show "Showing 1–50 of 1,247" indicators.
- Never paginate in memory over a partial dataset.

### 11. Harden Backup Export
**Why:** `downloadLocalBackup()` fetches entire tables without limits, which will fail at scale.  
**Action:**
- Use a Supabase Edge Function to stream backup files, or
- Paginate table exports in chunks and stream into the ZIP.
- Exclude soft-deleted rows by default.

### 12. Add Proper Error Handling
**Why:** Silent API failures leave the UI stuck on "جاري التحميل...".  
**Action:**
- Wrap all `API.request()` calls with `.catch()` handlers that show toast errors.
- In loaders, always call `UI.hideLoading()` even on failure.
- Do not silently return `0` from `API.count()` on errors.

### 13. Implement Real Permission Enforcement
**Why:** `can_print` is stored but never checked; action buttons are not consistently gated by `Auth.can()`.  
**Action:**
- Audit every action button to call `Auth.can(screen, 'add'|'edit'|'delete'|'print')`.
- Hide or disable buttons the user cannot use.

### 14. Fix Attendance Upload Behavior
**Why:** Uploading attendance soft-deletes the entire month, wiping prior uploads.  
**Action:**
- Upsert attendance per `employee_id` + `date` instead of bulk-deleting.
- Validate parsed times and flag invalid rows for review.

### 15. Add Duplicate Detection
**Why:** Duplicate clients, projects, vendors, sectors, and work sections/items are allowed.  
**Action:**
- Normalize names (trim, lowercase, remove extra spaces) before saving.
- Check for existing records and prompt for confirmation.
- Add unique constraints where appropriate.

### 16. Move Token Storage to `httpOnly` Cookie or Mitigate XSS
**Why:** Auth token in `localStorage` is vulnerable to XSS theft.  
**Action:**
- Short-term: fix all XSS vectors (see #5).
- Long-term: use Supabase SSR/auth helpers with `httpOnly` cookies if a backend is introduced.

---

## 🟡 Medium Priority Suggestions

### 17. Implement Custody Expenses UI
**Why:** `custody_expenses` table exists but is never used; custody is tracked only by `returned_amount`.  
**Action:**
- Add a screen to record custody expenses linked to a custody record.
- Calculate remaining custody as `amount − SUM(custody_expenses.amount)`.

### 18. Implement Employee Transactions UI
**Why:** `employee_transactions` (advance/penalty/bonus/other) are only summed for payroll; no UI to add/edit them.  
**Action:**
- Add an "Employee Transactions" screen or section under Employees.
- Clarify whether `advance` should reduce net salary.

### 19. Implement Salary History Logging
**Why:** `employee_salary_history` table is unused.  
**Action:**
- On salary edit, insert a history row with old/new salary and effective date.
- Add a view to show salary change history per employee.

### 20. Expose Items Catalog in UI
**Why:** `items` CRUD exists but no screen shows it, and `procurements.item_id` is always null.  
**Action:**
- Add an "Items / Materials" card in Master Data.
- Use the items catalog in procurement dropdowns.

### 21. Fix `project_tasks.updated_at` Trigger
**Why:** `project_tasks` has `updated_at` but no trigger to auto-update it.  **Action:**
```sql
CREATE TRIGGER project_tasks_u BEFORE UPDATE ON project_tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 22. Fix `setDateRange('last_month')` for January
**Why:** `String(m).padStart(2,'0')` on month `0` produces `00`.  **Action:**
```js
let y = today.getFullYear();
let m = today.getMonth(); // 0-based
if (m === 0) { m = 12; y -= 1; }
const start = `${y}-${String(m).padStart(2,'0')}-01`;
```

### 23. Add Content Security Policy (CSP)
**Why:** No CSP meta tag; XSS impact is amplified.  **Action:**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src https://*.supabase.co;">
```

### 24. Improve Service Worker Path Handling
**Why:** `sw.js` hardcodes `/Sara-Arch/...` paths, which breaks if deployed under a different base path.  **Action:**
- Generate asset paths relative to deployment root.
- Or use a build tool to inject the correct base path.

### 25. Standardize Number Parsing
**Why:** Spreadsheet import treats `0` as missing and does not handle Arabic numerals or currency symbols.  **Action:**
- Use `value == null || value === ''` for required checks.
- Normalize locale-specific numbers before parsing.

### 26. Add Form Validation UX
**Why:** Many forms submit without validating required fields or numeric ranges.  **Action:**
- Highlight invalid fields.
- Show inline error messages.
- Block submission until valid.

### 27. Fix Idle Timeout Redirect
**Why:** `App.onIdleTimeout()` calls `Auth.logout()` but leaves the user on a stale screen.  **Action:**
```js
static onIdleTimeout() {
  Auth.logout();
  App.go('login');
  UI.toast('انتهت جلسة العمل، يرجى تسجيل الدخول مرة أخرى');
}
```

---

## 🟢 Low Priority Suggestions

### 28. Update Stale Documentation
**Why:** `APP_TABS_GUIDE.md` (v105), `TEST_PLAN.md` (v83), and `TEST_DATA.md` (v83) lag behind runtime v162.  **Action:**
- Update guides to cover Tasks, Excel exports, detail views, pagination, and custody enhancements.

### 29. Fix CSS Cache-Busting in `index.html`
**Why:** `index.html` links to `css/style.css?v=124` while `version.json` is `162`.  **Action:**
- Generate the version query param dynamically or keep it in sync.

### 30. Add `aria-label` and `autocomplete` Attributes
**Why:** Accessibility and mobile usability improvements.  **Action:**
- Add `autocomplete` to login inputs.
- Add `aria-label` to icon-only buttons.

### 31. Remove Dead Code
**Why:** Several functions are defined but never used or duplicated.  **Action:**
- Remove `API.authUpdateUser()` if unused.
- Remove duplicate `return '';` in `app-core.js`.
- Remove `loadTxExpenses()` wrapper if not used.

### 32. Add Automated Testing
**Why:** No automated tests exist; regression risk is high.  **Action:**
- Add Jest/Vitest unit tests for calculation functions.
- Add Playwright E2E tests for critical workflows (login → client → project → transaction).

### 33. Introduce a Build Step
**Why:** No bundling makes environment injection, minification, and CSP difficult.  **Action:**
- Consider Vite as a lightweight build tool.
- Enables environment variables, code splitting, and modern tooling.

---

## Suggested Implementation Order

### Week 1 — Security & Stability
1. Rotate exposed keys.
2. Remove service key from browser.
3. Fix `Auth.can()` default.
4. Implement real RLS policies.
5. Escape user-controlled HTML.
6. Fix procurement save and expose UI.

### Week 2 — Schema & Data Integrity
7. Unify schema baseline.
8. Fix `project_tasks` trigger.
9. Add audit columns to tables missing them.
10. Implement duplicate detection.

### Week 3 — Reporting & Performance
11. Add server-side aggregation views.
12. Fix pagination across all screens.
13. Include procurements in statements.
14. Harden backup export.

### Week 4 — Features & Polish
15. Add custody expenses UI.
16. Add employee transactions UI.
17. Add items catalog UI.
18. Improve error handling and form validation.
19. Update documentation and test plan.

---

## Quick Wins (< 1 Hour Each)

- [ ] Add `min="0"` to amount/price/quantity inputs.
- [ ] Fix iOS input zoom (`font-size: 16px`).
- [ ] Fix `setDateRange('last_month')` January bug.
- [ ] Add `project_tasks` updated_at trigger.
- [ ] Fix idle timeout redirect.
- [ ] Remove dead code (`API.authUpdateUser`, duplicate `return ''`).
- [ ] Update `index.html` CSS version query param.
- [ ] Add CSP meta tag.
- [ ] Add `aria-label` to icon buttons.
- [ ] Hide action buttons based on `Auth.can()`.
