# Sara-Arch — Acceptance Testing Checklist

**Target deployment:** `dev.2` build  
**Tester:** _______________  
**Date:** _______________  
**Result:** ☐ Pass / ☐ Fail

---

## How to use

1. Deploy the latest `dev.2` branch to GitHub Pages.
2. Open the deployed URL in an incognito/private window.
3. Run each test case and mark **Pass** or **Fail**.
4. For any failure, record the screen/section, steps, and console error in the **Notes / Defects** table at the end.
5. After sign-off, fast-forward `main` to the tested `dev.2` commit.

---

## 1. Authentication & Session

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| AUTH-01 | Login with valid admin credentials | Dashboard loads, user name/role shown | ☐ Pass ☐ Fail | |
| AUTH-02 | Login with invalid credentials | Error message, no dashboard access | ☐ Pass ☐ Fail | |
| AUTH-03 | Refresh page after login | Session remains active | ☐ Pass ☐ Fail | |
| AUTH-04 | Close tab and reopen | Requires login again (sessionStorage) | ☐ Pass ☐ Fail | |
| AUTH-05 | Non-admin user access to Settings/Users/Permissions/Audit/Backup | Screen hidden or access denied | ☐ Pass ☐ Fail | |

---

## 2. Dashboard

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| DASH-01 | KPI cards display | Client, project, active, employee, total movement totals shown | ☐ Pass ☐ Fail | |
| DASH-02 | Income vs expenses totals pie chart | Income and expense slices rendered | ☐ Pass ☐ Fail | |
| DASH-03 | Top vendors list | Vendors with non-zero outstanding balances appear | ☐ Pass ☐ Fail | |
| DASH-04 | Active client balances list | Active clients with deposits/expenses/balance appear | ☐ Pass ☐ Fail | |
| DASH-05 | Reload dashboard | No console errors, data refreshes | ☐ Pass ☐ Fail | |

---

## 3. Clients & Projects

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| CLNT-01 | Add a new client | Client appears in list | ☐ Pass ☐ Fail | |
| CLNT-02 | Edit a client | Changes saved and reflected | ☐ Pass ☐ Fail | |
| CLNT-03 | Client empty state | Friendly message when no clients | ☐ Pass ☐ Fail | |
| PROJ-01 | Add a project under a client | Project appears under client card | ☐ Pass ☐ Fail | |
| PROJ-02 | Open project detail | Deposits, expenses, balance, supervision calculated | ☐ Pass ☐ Fail | |
| PROJ-03 | Project budget | Budget modal shows consistent totals | ☐ Pass ☐ Fail | |
| PROJ-04 | Project statement | Includes deposits and project_expense transactions | ☐ Pass ☐ Fail | |
| PROJ-05 | Client statement | Per-project chapters and client summary correct | ☐ Pass ☐ Fail | |

---

## 4. Transactions

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| TX-01 | Add project deposit | Appears in project statement and budget | ☐ Pass ☐ Fail | |
| TX-02 | Add project expense (construction) | Deducts from project balance, affects supervision | ☐ Pass ☐ Fail | |
| TX-03 | Add project expense (design) | Deducts but does not affect supervision | ☐ Pass ☐ Fail | |
| TX-04 | Edit a transaction | Amount/type updated everywhere | ☐ Pass ☐ Fail | |
| TX-05 | Delete a transaction | Soft-deleted, removed from statements | ☐ Pass ☐ Fail | |

---

## 5. Office Cash Flow

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| OFF-01 | Add owner deposit | Office income increases | ☐ Pass ☐ Fail | |
| OFF-02 | Add office expense by sector | Expense appears in office list and dashboard pie | ☐ Pass ☐ Fail | |
| OFF-03 | Add owner withdrawal | Office balance decreases | ☐ Pass ☐ Fail | |
| OFF-04 | Office empty state | Friendly message when no transactions | ☐ Pass ☐ Fail | |

---

## 6. Vendors & Procurement

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| VND-01 | Add a vendor | Vendor appears in list | ☐ Pass ☐ Fail | |
| VND-02 | Add procurement linked to a project | Project budget/statement reflect it via linked transaction | ☐ Pass ☐ Fail | |
| VND-03 | Edit procurement quantity/price | Linked transaction amount updates | ☐ Pass ☐ Fail | |
| VND-04 | Delete procurement | Linked transaction soft-deleted | ☐ Pass ☐ Fail | |
| VND-05 | Vendor purchases screen | Lists procurements with totals | ☐ Pass ☐ Fail | |
| VND-06 | Vendor statement | Balances and history correct | ☐ Pass ☐ Fail | |

---

## 7. Employees

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| EMP-01 | Add an employee | Employee appears in list | ☐ Pass ☐ Fail | |
| EMP-02 | Add attendance record | Record saved, duplicate date blocked | ☐ Pass ☐ Fail | |
| EMP-03 | Invalid attendance status | Save rejected with error | ☐ Pass ☐ Fail | |
| EMP-04 | Employee custody | Can add/view custody record | ☐ Pass ☐ Fail | |

---

## 8. Master Data

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| MST-01 | Add sector | Sector appears in list | ☐ Pass ☐ Fail | |
| MST-02 | Add work section | Section appears in list | ☐ Pass ☐ Fail | |
| MST-03 | Add work item | Item appears linked to section | ☐ Pass ☐ Fail | |
| MST-04 | Add item (catalog) | Item appears in catalog list | ☐ Pass ☐ Fail | |

---

## 9. Users & Permissions

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| USR-01 | Create a new user | User can log in | ☐ Pass ☐ Fail | |
| USR-02 | Assign permissions | Permission changes take effect | ☐ Pass ☐ Fail | |
| USR-03 | Audit log | INSERT/UPDATE/DELETE actions logged | ☐ Pass ☐ Fail | |

---

## 10. Backup

| # | Test Case | Expected Result | Result | Notes |
|---|-----------|-----------------|--------|-------|
| BKP-01 | Manual backup download | ZIP with JSON files downloaded | ☐ Pass ☐ Fail | |
| BKP-02 | Backup status list | Shows available/missing tables | ☐ Pass ☐ Fail | |

---

## Notes / Defects

| ID | Section | Steps to Reproduce | Severity | Owner | Status |
|----|---------|--------------------|----------|-------|--------|
|    |         |                    |          |       |        |
|    |         |                    |          |       |        |
|    |         |                    |          |       |        |

---

## Sign-off

- ☐ All critical test cases passed.
- ☐ Defects documented and accepted or fixed.
- ☐ `main` branch fast-forwarded to tested `dev.2` commit.

**Tester signature:** _______________  
**Date:** _______________
