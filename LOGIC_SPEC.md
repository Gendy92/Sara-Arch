# Sara-Arch — Logic Specification (Accounting & Math POV)

**Purpose:** Describe the business rules, accounting equations, and mathematical relationships used in Sara-Arch without reference to code syntax. Intended for finance/accounting review and product decisions.

---

## 1. Core Accounting Model

The system is built around a single **transaction ledger**. Every money movement is recorded as one row with:

- **Type** — what kind of movement it is.
- **Amount** — the gross value.
- **Paid amount** — what has already been settled.
- **Balance** — what remains unpaid.

### Transaction Types

| Type (Arabic) | Type (system) | Accounting meaning |
|---------------|---------------|--------------------|
| عربون مشروع | `project_deposit` | Client prepayment / advance received |
| مصروف مشروع | `project_expense` | Cost incurred for a project |
| مصروف مكتبي | `office_expense` | General & administrative operating cost |
| توريد صاحب المكتب | `owner_deposit` | Owner capital injection |
| سحب صاحب المكتب | `withdrawal` | Owner drawings / distribution |
| أتعاب supervision | `supervision` *(computed, not stored)* | Fee earned on construction expenses |
| مشتريات / مستخلص | `procurement` | Purchase from vendor, auto-mirrored as `project_expense` |

### Basic Balance Equation (per row)

```
Unpaid Balance = Amount − Paid Amount
```

- If `Amount = Paid` → the row is fully settled.
- If `Paid = 0` → the full amount is still owed / still receivable.
- If `Paid > Amount` → overpayment (allowed by the system, but should be flagged).

---

## 2. Project Accounting

### 2.1 Project Inputs

For a single project, gather all its live (non-deleted) transactions:

```
Project Deposits  = Σ Amount of all project_deposit transactions
Project Expenses  = Σ Amount of all project_expense transactions
Design Expenses   = Σ Amount of project_expense where category = design
Construction Exp. = Project Expenses − Design Expenses
```

### 2.2 Supervision Fee

Supervision is a fee the office earns as a percentage of construction-related expenses only. Design costs are excluded from the base.

```
Supervision Fee = Construction Expenses × (Supervision % / 100)
```

Where `Supervision %` is set on the project master record.

**Important:** Supervision is **computed on demand** and is **not stored as a separate transaction row**. It affects project net balance and office income, but it does not appear directly in the transaction list unless a manual supervision transaction is created.

### 2.3 Project Net Balance

```
Project Net Balance = Project Deposits − Project Expenses − Supervision Fee
```

Interpretation:
- **Positive** → client still owes money (deposits exceed costs + fee).
- **Zero** → account is square.
- **Negative** → project is over-budget or over-paid by the client.

### 2.4 Client Balance

A client may have many projects. The client balance is the sum of the net balances of all client projects, with supervision applied consistently everywhere:

```
Client Deposits    = Σ Project Deposits     (for all client projects)
Client Expenses    = Σ Project Expenses     (for all client projects)
Client Supervision = Σ Supervision Fee      (for all client projects)
Client Balance     = Client Deposits − Client Expenses − Client Supervision
```

The same supervision formula is applied consistently in project detail, client detail, client list, and dashboard active-client balances. The canonical view `client_balances` enforces this formula.

---

## 3. Vendor Accounting

A vendor can supply two things:

1. **Services** → recorded directly as `project_expense` with the vendor linked.
2. **Merchandise / Materials** → recorded first as a `procurement`, which auto-creates a linked `project_expense` transaction.

### 3.1 Vendor Owed

```
Service Owed    = Σ Amount of project_expense rows linked to the vendor
Merchandise Owed= Σ Total Price of procurement rows linked to the vendor
Total Owed      = Service Owed + Merchandise Owed
```

### 3.2 Vendor Paid

```
Service Paid    = Σ Paid Amount of those service project_expense rows
Merchandise Paid= Σ Paid Amount of those procurements
Total Paid      = Service Paid + Merchandise Paid
```

### 3.3 Vendor Balance

```
Vendor Balance = Total Owed − Total Paid
```

Interpretation:
- **Positive** → office still owes the vendor.
- **Zero** → fully paid.
- **Negative** → vendor was over-paid.

### 3.4 Office Vendor

The system seeds one special vendor marked `is_office = true` (e.g. "مكتب سارة أبو العلا"). This vendor represents the office itself and can be used for:

- Project expenses where the office is the service provider.
- Procurements where the office is the supplier.
- Office expenses linked to a vendor for traceability.

Transactions linked to the office vendor are **not** included in vendor balances or top-vendor dashboards; instead, their paid amounts are treated as **office income** and appear in the office cash-flow.

---

## 4. Office Cash Flow

The office is treated as its own entity. Its position is the result of owner injections, project-related income, and operating expenses.

### 4.1 Office Income

```
Owner Deposits     = Σ Amount of owner_deposit transactions
Supervision Income = Σ Supervision Fee across all projects
Total Income       = Owner Deposits + Supervision Income
```

### 4.2 Office Expense

```
Office Expenses = Σ Amount of office_expense transactions
Owner Withdrawals = Σ Amount of withdrawal transactions
Total Outflow   = Office Expenses + Owner Withdrawals
```

### 4.3 Office Balance

```
Office Balance = Total Income − Total Outflow
```

Interpretation:
- **Positive** → office has net cash/surplus.
- **Zero** → break-even.
- **Negative** → office is in deficit (requires owner deposit).

---

## 5. Procurement Linkage

A procurement is a purchase record. When it is linked to a project, the system automatically mirrors it as a project expense transaction so that project balance, vendor balance, and office reporting stay consistent.

### 5.1 Procurement Value

```
Total Price = Quantity × Unit Price
```

### 5.2 Linked Transaction

For each project-linked procurement, a matching `project_expense` row is maintained with:

```
Amount     = Procurement Total Price
Paid       = Procurement Paid Amount
Category   = merchandise
Project    = same project
Vendor     = same vendor
```

### 5.3 Consistency Rules

- Editing the procurement updates the linked transaction.
- Deleting the procurement soft-deletes the linked transaction.
- A procurement with no project has no linked transaction (it does not affect project balance).

---

## 6. Employee Payroll

### 6.1 Daily Rate

Salaries are assumed on a 30-day month:

```
Daily Rate = Base Salary / 30
```

### 6.2 Attendance Deductions

```
Absence Deduction = Absent Days × Daily Rate
Half-Day Deduction = Half Days × Daily Rate × 0.5
Total Deductions   = round(Absence Deduction + Half-Day Deduction)
```

### 6.3 Additions & Deductions

```
Bonuses   = Σ Amount of employee_transactions where type = bonus
Penalties = Σ Amount of employee_transactions where type = penalty
```

### 6.4 Net Salary

```
Net Salary = Base Salary − Total Deductions + Bonuses − Penalties
```

Workflow status: `draft` → `approved` → `paid`.

### 6.5 Payroll → Office Expense Linkage

Every payroll record maintains a linked `office_expense` transaction via `payroll_records.office_expense_id`.

- Generating payroll creates a draft `office_expense` for the net salary.
- Editing payroll updates the linked expense amount/description.
- Paying payroll ensures the linked expense exists and is not soft-deleted.
- Deleting payroll soft-deletes the linked expense.

This keeps salary costs reflected in the office cash-flow automatically.

---

## 7. Custody (Employee Petty Cash)

Custody is cash advanced to an employee for office or project spending.

```
Remaining Custody = Custody Amount − Returned Amount
```

Status mapping:
- `active` → money is out, not yet returned.
- `partial` → part returned.
- `settled` → fully returned.

Employee custody summary:

```
Total Given     = Σ Custody Amount
Total Returned  = Σ Returned Amount
Total Remaining = Total Given − Total Returned
```

---

## 8. Dashboard KPIs

High-level numbers shown on the dashboard:

```
Client Count         = count of active clients
Project Count        = count of active projects
Active Project Count = count of projects with status = active
Employee Count       = count of active employees

Total Income  = Σ project_deposit amounts + Σ owner_deposit amounts
Total Expense = Σ project_expense amounts + Σ office_expense amounts
Total Movement= Total Income + Total Expense
```

The dashboard also shows:
- **Income vs. Expense totals** as a pie chart.
- **Top vendors** by unpaid balance.
- **Active client balances** by deposits, expenses, and net balance.

---

## 9. Entity Relationship Map (Accounting Flow)

```
Owner ──owner_deposit──► Office Cash ◄──withdrawal── Owner
                              │
                              ▼
Client ──project_deposit──► Project ◄──project_expense── Vendor (services)
                                │                ▲
                                │                │ linked transaction
                                └────────► Procurement ──► Vendor (merchandise)
                                │
                                ▼
                         Supervision Fee ──► Office Income
                                │
                                ▼
                         Design Expense (excluded from supervision base)

Office Cash ──office_expense──► Operating Costs / Sectors
Office Vendor ──project_expense──► Office Income
Office Vendor ──procurement──► Office Income
Employee ──custody──► Project / Office expense
Employee ──payroll──► Salary expense
```

---

## 10. Known Accounting Gaps & Decisions Needed

1. **Supervision treatment**
   - Supervision reduces the project net balance and is included consistently in client and project balances via the `project_balances` / `client_balances` views.
   - It is still not stored as a separate receivable row. Decision: should it appear as an auto-generated `project_deposit` or `income` transaction?

2. **Client-level vs. project-level balance** *(resolved)*
   - Client list, client detail, project detail, and dashboard now all subtract supervision consistently using the same balance views.

3. **Overpayments**
   - The system allows `Paid Amount > Amount`. Decide whether to warn/block.

4. **Credit vs. immediate vs. settlement**
   - Payment term is inferred from amount/paid comparison. It is not independently validated against the paid amount.

5. **Employee module (on hold)**
   - Payroll, attendance, and custody RLS policies are currently open because the module is disabled.
   - When enabled, these must follow the same owner/admin permission model.

---

## 11. Quick Reference Formulas

| Area | Formula |
|------|---------|
| Project net balance | `Deposits − Expenses − Supervision` |
| Client balance (all views) | `Σ(Deposits − Expenses − Supervision)` |
| Client supervision | `Σ Project Supervision across all client projects` |
| Supervision fee | `(Expenses − Design Expenses) × Supervision% / 100` |
| Vendor balance | `(Service Owed + Merchandise Owed) − (Service Paid + Merchandise Paid)` |
| Office balance | `(Owner Deposits + Supervision Income + Office Vendor Income) − (Office Expenses + Withdrawals)` |
| Office vendor income | `Σ paid_amount of project_expense/vendor_settlement where vendor.is_office = true` |
| Net salary | `Base Salary − Deductions + Bonuses − Penalties` |
| Custody remaining | `Given − Returned` |
| Unpaid balance (row) | `Amount − Paid Amount` |

---

## 12. Application Settings

Office-level configuration is persisted server-side in the `app_settings` table (`key`, `value`).

- Settings are loaded at startup and merged with a `localStorage` fallback.
- Only administrators can modify settings via RLS.
- Shared keys: `company_name`, `company_address`, `company_phone`, `company_tax`, `default_supervision`, `currency_label`.

---

**Version:** 1.2  
**Branch:** `dev.2`
