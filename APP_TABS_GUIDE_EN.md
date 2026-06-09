# Sara Arch — Complete App Tabs Guide

> Version v105 — Detailed breakdown of every screen with exact formulas

---

## 1. 📊 Dashboard

### Data Loaded
Four parallel API calls:
- All clients (`clients`)
- All projects (`projects`)
- All employees (`employees`)
- All transactions (`transactions`)

### KPI Cards

| Card | Formula |
|------|---------|
| Clients | `clients.length` |
| Projects | `projects.length` |
| Active | `projects.filter(p => p.status === 'active').length` |
| Employees | `employees.length` |
| Total Movement | `totalIncome + totalExp` |

```js
totalIncome = sum of 'project_deposit' + 'owner_deposit' (amount)
totalExp    = sum of 'project_expense' + 'office_expense' (amount)
```
> ⚠️ "Total Movement" = income + expenses (NOT net profit)

---

### Client Balances

**Filter:** Shows **all clients who have projects** (not just those with a balance)

**Per-client formula:**
```js
// For each project belonging to the client:
constr      = expenses - design_expenses
sup_project = constr × supervision_percentage / 100

// Client totals:
totalExp  = Σ expenses across all their projects
totalSup  = Σ sup_project across all their projects
dep       = Σ deposits for this client
balance   = dep - totalExp - totalSup
```

| Column | Formula |
|--------|---------|
| Income (وارد) | `dep` |
| Expenses | `totalExp` |
| Supervision | `totalSup` |
| Balance | `dep - totalExp - totalSup` |

- **Green** = balance ≥ 0 (client still has credit)
- **Red** = balance < 0 (client owes money)

**Sorting:** By **absolute balance value** descending (largest deviation first)

---

### Active Vendors

**Data:** Vendors + project expense transactions + procurements

**Service costs (from transactions):**
```js
serviceCost = Σ amount for all project_expense linked to vendor
servicePaid = isNew ? Σ paid_amount : Σ amount
```

**Merchandise (from procurements):**
```js
merchandise = Σ total_price
merchPaid   = isNew ? Σ paid_amount : 0    // ⚠️ Old = 0 (assumed fully unpaid)
```

**Balance:**
```js
totalCost = serviceCost + merchandise
totalPaid = servicePaid + merchPaid
balance   = totalCost - totalPaid
```

| Color | Meaning |
|-------|---------|
| Red | We owe vendor (`balance > 0`) |
| Green | Vendor has credit (`balance < 0`) |

**Sorting:** By absolute balance value

---

## 2. 🏢 Office

### Data
- `owner_deposit` (owner injections)
- `office_expense` + `withdrawal` (office expenses + withdrawals)
- All projects + project expenses

### Formulas

```js
// Office revenue
income       = Σ owner_deposit
supervision  = Σ [ (project_expenses - design) × supervision% ] per project
totalIncome  = income + supervision

// Office expenses
expense = Σ office_expense + Σ withdrawal

// Office balance
balance = totalIncome - expense
```

### Table
Merges 3 sources into one table:
1. `owner_deposit` → green badge
2. `office_expense` + `withdrawal` → red badge
3. **Supervision** (computed) → synthetic row with no `id` (non-editable)

Sorted by `created_at` descending

---

## 3. 👥 Clients & Projects

### Main Screen

Fetches:
- All clients + their projects
- All project expenses + deposits

**Per-client card:**
- Client info (name, phone, email, address)
- Actions: Edit | Delete | Client Statement
- "+ Project" button per client
- Project table for that client

### Project Table (per project)

```js
exp    = Σ project_expense for this project
design = Σ project_expense where expense_category = 'design'
constr = exp - design
sup    = constr × supervision_percentage / 100
dep    = Σ project_deposit for this project
```

Columns: Project | Address | Value | Expenses | Supervision% | Supervision | Status | Actions

Actions: Edit | Delete | Statement | Budget

### Project Statement

**Data:** Deposits + expenses for the project

**Date filter:** From/To (inclusive)

**Ledger construction:**
| Type | In | Out |
|------|-----|-----|
| Income (deposit) | `amount` | 0 |
| Expense (construction) | 0 | `amount` |
| Divider ━━ Design Expenses ━━ | 0 | 0 |
| Design expense | 0 | `amount` |
| Supervision | 0 | `supervisionAmount` |

```js
supervisionAmount = (totalExp - designExp) × supervision% / 100
```

**Running balance:**
```js
balance += in - out   // cumulative from first to last row
```

**Expense detail table:**
```js
paid = isNew ? paid_amount : amount
bal  = amount - paid
```

Section: `section_name` or "Design" or "Construction"

---

### Client Statement

**Fetches:** All deposits + all expenses (all projects), then client-side filters to this client's projects

**Per project:**
```js
dep    = Σ deposits for project
exp    = Σ expenses for project
design = Σ design expenses
constr = exp - design
sup    = constr × supervision%
bal    = dep - exp - sup
```

**Totals:**
```js
totalDep = Σ dep across all projects
totalExp = Σ exp across all projects
totalSup = Σ sup across all projects
totalBal = totalDep - totalExp - totalSup
```

**Display:**
- Top summary
- Per project: badges (income/expenses/supervision/balance) + deposit table + construction table + design table + supervision line

---

### Project Budget

```js
budget          = project.value
totalDep        = Σ deposits
totalExp        = Σ expenses
totalDesign     = Σ design expenses
totalConstr     = totalExp - totalDesign
supervision     = totalConstr × supervision%
remainingBudget = budget - totalExp
clientBalance   = totalDep - totalExp - supervision
expPct          = budget > 0 ? Math.min(100, (totalExp / budget) × 100) : 0
```

**Cards:**
| Card | Color |
|------|-------|
| Project Budget | default |
| Client Deposits | green |
| Actual Expenses | red |
| Office Supervision | gold |
| Remaining Budget | green if ≥ 0, red if < 0 |
| Client Balance | blue if ≥ 0, red if < 0 |

**Progress bar:** `expPct%` — green if expenses ≤ budget, red if over

**Status messages:**
- `completed` + remaining > 0 → "Remaining budget: X"
- `completed` + remaining < 0 → "Budget exceeded by X"
- `active` → "Project in progress"

---

## 4. 💰 Transactions

### "All" Tab
Fetches:
- Last 50 transactions (`project_deposit` + `project_expense`)
- All projects
- **All** project expenses (no limit) ← ⚠️ will crash if too many
- All transactions (for KPIs)

### KPIs
```js
deposits    = Σ project_deposit
expenses    = Σ project_expense
supervision = Σ [ (exp - design) × supervision% ] per project
balance     = deposits - expenses - supervision
```

### Table
Merges real transactions + synthetic supervision rows:
- **Deposit** → green badge
- **Expense** → red badge
- **Supervision** → computed row (non-editable)

**Expense columns:**
```js
// Paid (in Expenses tab)
paid = isNew ? paid_amount : amount
// Remaining
bal  = amount - paid
```

**Payment badges:**
- `payment_method`: Cash/Bank/Transfer → gray badge
- `payment_term`: Immediate (green) / Credit (orange) / Settlement (blue)

---

### Add Project Expense

**Columns:** Client | Project | Vendor | Section | Item | Payment Method | Amount | Paid | Date | Description

**Post-input logic:**
```js
// 1. auto-compute payment_term
payment_term = 'immediate'
if (amount === 0 && paid_amount > 0)  payment_term = 'settlement'
else if (amount > paid_amount)         payment_term = 'credit'

// 2. auto-detect expense_category
expense_category = sectionName.includes('تصميم') ? 'design' : 'construction'

// 3. fallback if DB column missing
if (error contains 'section_id' || 'payment_method' || ...)
  → strip new fields and retry
```

**Cascades:**
- Client → Project
- Section → Item (section filters items)

---

### Edit Transaction

**Transaction types:**

| Type | Fields | Cascade |
|------|--------|---------|
| Project Deposit | Client, Project, Amount, Payment Method | Client→Project |
| Project Expense | Client, Project, Vendor, Section, Item, Payment Method, Amount, Paid | Client→Project + Section→Item |
| Office Expense | Employee, Sector, Amount | — |
| Supervision | Project, Percentage | — |

Same `payment_term`, `expense_category`, and fallback logic applies in edit.

---

## 5. 🏗️ Vendors

### Vendor List
- Name, Type (Service/Merchandise), Specialty, Contact, Phone
- Actions: Edit | Delete | Statement | Purchases

### Vendor Statement

**Data:** Vendor + procurements + project/office expenses

**Unified ledger construction:**

| Source | amount | paid | Meaning |
|--------|--------|------|---------|
| New procurement | `total_price` | `paid_amount` | Partial payment |
| Old procurement | `total_price` | `0` | ⚠️ Assumed fully unpaid |
| New transaction | `amount` | `paid_amount` | Partial expense |
| Old transaction | `0` | `amount` | Settlement (reduces balance) |

**Running balance:**
```js
balanceChange = amount - paid
running += balanceChange
```

- Red = we owe (`running ≥ 0`)
- Green = vendor credit (`running < 0`)

---

### Vendor Purchases

Fetches all `procurements` for vendor + date filter

Columns: Date | Project | Item | Quantity | Unit Price | Total | Category | Actions

> ⚠️ **Bug:** `total_price` is never computed during save — if DB has no trigger, value is null

---

### Add/Edit Procurement

Fields: Vendor* | Project | Item* | Quantity | Unit Price | Category | Date | Notes

```js
quantity   = +fd.get('quantity') || 1
unit_price = +fd.get('unit_price') || 0
// total_price is NOT computed here! ⚠️
```

---

## 6. 🧑‍💼 Employees

### Employee List
- Name, Job Title, Salary, Active Custody
- Actions: Edit | Delete | Custody | Attendance

### Custody (العهدة)

**Full custody lifecycle:**
```
Give custody → Spend from it → Return money → Settle
```

**Custody formulas:**
```js
given     = +custody.amount
spent     = Σ custody_expenses for this custody
returned  = +custody.returned_amount
remaining = given - spent - returned
```

**Employee custody summary:**
```js
activeTotal  = Σ amount for custody where status = 'active'
settledTotal = Σ amount for custody where status = 'settled'
```

- **Give custody:** Modal with amount + client + project + date
- **Custody expense:** Records in `custody_expenses` (amount + description + date)
- **Return:** Adds to `returned_amount`
- **Settle:** Changes `status` to `'settled'` (no balance validation)

---

### Attendance / Fingerprint Upload

**Excel upload:**
- Reads `.xlsx` / `.csv`
- Auto-detects columns: Name | Date | Check-in | Check-out
- Matches employee name with database (exact match then partial match)

**Status determination:**
```js
if (!checkIn && !checkOut)     status = 'absent'
else if (checkIn && !checkOut) status = 'half_day'
else if (checkIn > '09:15')    status = 'late'
else                            status = 'present'
```

> Note: Check-out time does **not** affect status

**Save:**
- Soft-deletes all existing attendance records for the selected month
- Inserts new records in batches of 50

---

### Payroll

**Salary calculation:**
```js
base       = +employee.salary || 0
dailyRate  = base / 30
deductions = round(absent × dailyRate + half_day × dailyRate × 0.5)
bonuses    = Σ employee_transactions where type = 'bonus'
penalties  = Σ employee_transactions where type = 'penalty'
net_salary = base - deductions + bonuses - penalties
```

> `late` and `leave` are counted but do **not** trigger deductions currently

**Status workflow:**
```
draft → approved → paid
```

- **Generate:** Computes and saves (updates if exists)
- **Approve:** Changes `status` to `approved`
- **Pay:** Changes `status` to `paid`

> ⚠️ If you regenerate a `paid` payroll, it keeps `paid` status with new numbers (should reset to `draft`)

---

## 7. 📦 Master Data

### Sections
1. **Sectors** — Office expense categories
2. **Items** — Material catalog (name, spec, brand, unit) — no quantities
3. **Work Sections** — Project construction phases
4. **Work Items** — Tasks within each section

### Excel Upload (v105)

**Mode 1: Sections only**
- Single column: Section name
- Creates sections only

**Mode 2: Sections + Items**
- Section column + Item column + (optional) Notes
- Matches existing sections by name
- Creates missing sections first
- Creates items with deduplication by (section + item name)

---

## 8. 🔐 Users & Permissions

### Users
- Fetches Supabase Auth users + `profiles` table
- Name: `profiles.name` → fallback `user_metadata.name` → `safeName()`
- Role: `profiles.role` → fallback `user_metadata.role` → `'user'`

**Add user:**
- Spreadsheet: username | name | password | role
- Calls `authCreateUser` then `POST profiles`

**Edit:**
- Updates `profiles` only
- ⚠️ **Does not update `user_metadata` in Auth** → old name persists

### Permissions

**7 screens × 5 actions = 35 checkboxes per user**

Screens: dashboard | clients | vendors | transactions | office | employees | master

Actions:
- `can_view` — View
- `can_add` — Add
- `can_edit` — Edit
- `can_delete` — Delete
- `can_print` — Print

> `admin` bypasses all checks. Regular users get checkboxes.

---

## 9. 📜 Audit & Backup

### Audit Log
- Logs: INSERT | UPDATE | DELETE
- Per operation: table, ID, action type, user, timestamp
- ⚠️ **`old_data` is always `null`** — no before/after diff
- ⚠️ **limit = 100** — older records not accessible
- Filter: by table name only

### Backup
- Fetches 19 tables as JSON
- Packs into ZIP
- Downloads to device
- ⚠️ **No Restore** — export only
- ⚠️ Fetches all data (does not exclude soft-deleted)

---

## 10. ⚙️ Settings

**3 cards:**
1. Users & Permissions → button opens Users screen
2. Backup → button opens Backup screen
3. Audit Log → button opens Audit screen

**Clear Cache:**
- Clears `localStorage` + `sessionStorage`
- Preserves `sara_token` (keeps user logged in)
- Reloads page

> ⚠️ No actual settings (currency, company name, default supervision %, etc.)

---

## Core Formulas Summary

| Metric | Formula |
|--------|---------|
| **Construction expenses** | `totalExpenses - designExpenses` |
| **Supervision** | `constr × supervision_percentage / 100` |
| **Client balance** | `deposits - expenses - supervision` |
| **Vendor balance** | `(serviceCost + merchandise) - (servicePaid + merchPaid)` |
| **Remaining budget** | `budget - expenses` |
| **Expense % of budget** | `Math.min(100, (expenses / budget) × 100)` |
| **Net salary** | `baseSalary - deductions + bonuses - penalties` |
| **Daily rate** | `salary / 30` |
| **Custody remaining** | `given - spent - returned` |
