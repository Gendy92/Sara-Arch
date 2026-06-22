# Sara-Arch — Acceptance Review Results

**Date:** 2026-06-17  
**Reviewer:** Kimi Code CLI (code-level/static review)  
**Branch reviewed:** `dev.2` / `main` (fast-forwarded)  
**Method:** Source-code audit against `tests/acceptance-checklist.md`. No live UI session was available, so items requiring credentials or browser interaction are marked **Blocked** rather than Pass/Fail.

---

## Summary

| Category | Pass | Fail | Partial / Blocked | NA |
|----------|------|------|-------------------|----|
| Authentication | 0 | 0 | 4 | 0 |
| Dashboard | 4 | 0 | 1 | 0 |
| Clients & Projects | 6 | 0 | 0 | 0 |
| Transactions | 6 | 0 | 0 | 0 |
| Office Cash Flow | 4 | 0 | 0 | 0 |
| Vendors & Procurement | 6 | 0 | 0 | 0 |
| Employees | 0 | 0 | 0 | 4 |
| Master Data | 4 | 0 | 0 | 0 |
| Users & Permissions | 2 | 0 | 1 | 0 |
| Backup | 2 | 0 | 0 | 0 |
| **Total** | **34** | **0** | **6** | **4** |

**Verdict:** All verifiable code paths look correct. The remaining 6 blocked items need a live login/UI run to confirm.

---

## Detailed Results

| Test ID | Test Name | Assessment | Evidence |
|---|---|---|---|
| AUTH-01 | Login with valid admin credentials | Blocked | Requires live Supabase credentials and UI interaction to verify token/session. |
| AUTH-02 | Login with invalid credentials | Blocked | Requires runtime attempt against Supabase Auth; code path exists in `Auth.login` / `API.authSignIn`. |
| AUTH-03 | Refresh page after login | Blocked | Token is restored from `sessionStorage` in `Auth.init`, but refresh behavior needs runtime verification. |
| AUTH-04 | Close tab and reopen | Blocked | Token stored in `sessionStorage` is tab-scoped; tab-close behavior can only be verified interactively. |
| AUTH-05 | Non-admin access to Settings/Users/Permissions/Audit/Backup | Pass | `App.go` (`app-core.js:132`) redirects non-admin users away from admin-only screens. |
| DASH-01 | KPI cards display | Pass | `App.loadDashboard` (`app-loaders.js:81–96`) calls `dashboard_kpis` RPC and renders all KPI cards. |
| DASH-02 | Income vs expenses totals pie chart | Pass | `loadDashboard` builds income/expense rows and renders `_renderPie` (`app-loaders.js:98–102`). |
| DASH-03 | Top vendors list | Pass | `loadDashboard` calls `dashboard_top_vendors` RPC and renders outstanding balances, now including the office vendor (`app-loaders.js:72–80`). |
| DASH-04 | Active client balances list | Pass | `loadDashboard` calls `dashboard_active_client_balances` RPC and renders balances (`app-loaders.js:112–117`). |
| DASH-05 | Reload dashboard | Blocked | Reload / no-console-errors verification requires actual browser interaction. |
| CLNT-01 | Add a new client | Pass | `Crud.addClient` (`crud.js:255–272`) opens spreadsheet modal, checks duplicates, and bulk-saves. |
| CLNT-02 | Edit a client | Pass | `Crud.editClient` (`crud.js:274–296`) loads record, validates name uniqueness, and saves. |
| CLNT-03 | Client empty state | Pass | `App.loadClients` (`app-loaders.js:153–155`) shows friendly empty message. |
| PROJ-01 | Add a project under a client | Pass | `Crud.addProject` (`crud.js:303–331`) enforces client linkage and duplicate project names per client. |
| PROJ-02 | Open project detail | Pass | `App.loadProject` (`app-loaders.js:272–331`) computes deposits, expenses, supervision, and balance. |
| PROJ-03 | Project budget | Pass | `Crud.projectBudget` (`crud.js:1365–1391`) computes and displays budget totals including supervision. |
| PROJ-04 | Project statement | Pass | `Crud.projectStatement` (`crud.js:1265–1316`) lists project deposits and project_expense transactions. |
| PROJ-05 | Client statement | Pass | `Crud.clientStatement` (`crud.js:1161–1219`) builds per-project chapters and client summary. |
| PROJ-06 | Supervision consistency | Pass | Same formula `(expenses − design) × supervision% / 100` used in `loadClients`, `loadClient`, `loadProject`, `projectBudget`, dashboard RPC, and office views. |
| TX-01 | Add project deposit | Pass | `Crud.addProjectDeposit` (`crud.js:627–652`) inserts `type='project_deposit'` and refreshes statements. |
| TX-02 | Add project expense (construction) | Pass | `Crud.addProjectExpense` defaults `expense_category='construction'`; supervision is calculated on construction expenses. |
| TX-03 | Add project expense (design) | Pass | Design category is excluded from supervision in all calculation paths (`app-loaders.js:284–286`). |
| TX-04 | Edit a transaction | Pass | `Crud.editTx` (`crud.js:785–907`) handles all transaction types and updates records. |
| TX-05 | Delete a transaction | Pass | `Crud.delTx` (`crud.js:909–911`) calls `softDelete` on transactions, setting `deleted_at`. |
| TX-06 | Overpayment validation | Pass | `Crud.save` (`crud.js:42–46`) rejects `paid_amount > amount` for transactions. |
| OFF-01 | Add owner deposit | Pass | `Crud.addOwnerDeposit` (`crud.js:737–749`) inserts `type='owner_deposit'`. |
| OFF-02 | Add office expense by sector | Pass | `Crud.addOfficeExpense` (`crud.js:711–735`) requires employee and sector, inserts `type='office_expense'`. |
| OFF-03 | Add owner withdrawal | Pass | `Crud.addOwnerWithdrawal` (`crud.js:751–763`) inserts `type='withdrawal'`, deducted in office balance. |
| OFF-04 | Office empty state | Pass | `App.loadOffice` (`app-loaders.js:625`) shows friendly message when no transactions. |
| VND-01 | Add a vendor | Pass | `Crud.addVendor` (`crud.js:383–412`) validates duplicates and bulk-saves. |
| VND-02 | Add procurement linked to a project | Pass | `Crud.addProcurement` + `_syncProcurementTransaction` (`crud.js:453–486`) creates a linked `project_expense`. |
| VND-03 | Edit procurement quantity/price | Pass | `Crud.editProcurement` (`crud.js:525–560`) saves changes and re-syncs linked transaction. |
| VND-04 | Delete procurement | Pass | `Crud.delProcurement` (`crud.js:562–573`) soft-deletes procurement and its linked transaction. |
| VND-05 | Vendor purchases screen | Pass | `Crud.vendorPurchases` (`crud.js:1638–1685`) lists procurements with totals. |
| VND-06 | Vendor statement | Pass | `Crud.vendorStatement` (`crud.js:1518–1588`) computes balances from transactions and procurements. |
| VND-07 | Procurement overpayment validation | Pass | `Crud.save` (`crud.js:47–51`) rejects `paid_amount > total_price` for procurements. |
| EMP-01 | Add an employee | NA | Employee module is documented as on hold in `LOGIC_SPEC.md` (open RLS). |
| EMP-02 | Add attendance record | NA | Employee module on hold; attendance RLS currently open per `LOGIC_SPEC.md`. |
| EMP-03 | Invalid attendance status | NA | Employee module on hold. |
| EMP-04 | Employee custody | NA | Employee module on hold. |
| MST-01 | Add sector | Pass | `Crud.addSector` (`crud.js:970–984`) validates duplicates and bulk-saves. |
| MST-02 | Add work section | Pass | `Crud.addWorkSection` (`crud.js:1062–1076`) validates duplicates and bulk-saves. |
| MST-03 | Add work item | Pass | `Crud.addWorkItem` (`crud.js:1104–1124`) links item to section and checks duplicates. |
| MST-04 | Add item (catalog) | Pass | `Crud.addItem` (`crud.js:1012–1029`) validates duplicates and bulk-saves to `items`. |
| USR-01 | Create a new user | Blocked | `Crud.addUser` exists, but verifying the new user can log in requires live Supabase credentials/runtime. |
| USR-02 | Assign permissions | Pass | `App.savePermissions` (`app-loaders.js:1113–1136`) persists to `user_permissions`; `Auth.can` enforces them. |
| USR-03 | Audit log | Pass | `Crud._logAudit` (`crud.js:101–109`) is invoked from `save` and `softDelete` for INSERT/UPDATE/DELETE. |
| BKP-01 | Manual backup download | Pass | `App.downloadLocalBackup` (`app-loaders.js:996–1037`) fetches tables and downloads a ZIP of JSON files. |
| BKP-02 | Backup status list | Pass | `App.loadBackup` (`app-loaders.js:977–994`) probes each table and lists available/missing JSON entries. |

---

## Blocked / Manual Items

These require an actual browser session with valid credentials:

1. **AUTH-01** — Login with valid admin credentials.
2. **AUTH-02** — Login with invalid credentials.
3. **AUTH-03** — Refresh page after login.
4. **AUTH-04** — Close tab and reopen.
5. **DASH-05** — Reload dashboard (no console errors).
6. **USR-01** — Create a new user and verify login.

To close these, either:
- Provide me with a **test username/password** (and optionally a service-role key) and I can run an automated browser/API session.
- Or run them manually in an incognito window and fill the original `tests/acceptance-checklist.md`.

---

## Recommendation

The code-level review shows **no failures**. Once the 6 blocked items are verified manually, `dev.2` can be considered signed off and `main` is already at the same commit.
