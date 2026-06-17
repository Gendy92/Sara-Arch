# Sara Arch — System Documentation

## 1. Overview

**Sara Arch** (سارة أبو العلا — النظام المالي والمحاسبي) is a browser-based financial and operations management system for a construction/design office. It manages clients, projects, vendors, employees, payroll, custody, procurements, and office accounting in a single-page application.

The system is intentionally lightweight: it uses no frontend framework, no build step, and no backend server. All data persistence and authentication are handled by Supabase, with the frontend calling the Supabase REST API directly.

---

## 2. User Roles

### 2.1 Roles

| Role | Description |
|------|-------------|
| `admin` | Full access to all screens, including Settings, Users, Permissions, Audit, and Backup. |
| `user` | Access is restricted to screens and actions granted in the `user_permissions` table. |

### 2.2 Role Sources

- **Supabase Auth `user_metadata.role`** — set at registration.
- **`profiles` table** — mirrors `auth.users` and stores Arabic `name`, `username`, and `role`. This is the preferred source for display.
- **`user_permissions` table** — per-screen matrix for non-admin users.

### 2.3 Permission Matrix

Permissions are evaluated per screen with five actions:

- `can_view` — show the screen in navigation and allow routing.
- `can_add` — show "Add" buttons.
- `can_edit` — show "Edit" buttons.
- `can_delete` — show "Delete" buttons.
- `can_print` — allow export/print actions.

The following screens are **admin-only** regardless of `user_permissions`:

- Register
- Settings
- Users
- Permissions
- Audit Log
- Backup

---

## 3. Application Modules

### 3.1 Login & Authentication

- Users log in with a **username** and password.
- The username is mapped internally to a valid email (`username@gendy92.github.io`) for Supabase Auth, with a legacy `@local` fallback for old accounts.
- In **Authentication → Settings**, keep **Email provider** enabled but turn **Confirm email** off so logins work without confirmation loops.
- JWT tokens are stored in `sessionStorage` (tab-scoped).
- After login, the app loads the user's `profile` and permissions.

### 3.2 Dashboard (الرئيسية)

- KPI cards: total clients, total projects, active projects, employees, total financial movement.
- Monthly revenue/expense bar chart.
- Office expense pie chart by sector.
- Top vendors with outstanding balances.
- Client balances list (active customers with non-zero balance).

### 3.3 Clients & Projects (العملاء والمشاريع)

- Client cards with contact info and aggregate balance.
- Each client can have multiple projects.
- Project fields: name, address, contract value, supervision percentage, design percentage, status, dates, notes.
- Project statuses: `active`, `completed`, `on_hold`, `cancelled`.
- Client detail view: summary + project table.
- Project detail view: KPIs, transactions, tasks.
- Actions: add/edit/delete clients and projects; view statement and budget.

### 3.4 Vendors (الموردين)

- Vendor list with name, type, sector, and balance.
- Vendor types: `service` (خدمات) and `merchandise` (بضاعة).
- Vendor statement: service expenses and procurements with paid/unpaid balances.
- Vendor purchases: procurement history.
- Actions: add/edit/delete vendor; view statement/purchases.

### 3.5 Transactions (معاملات المشاريع)

Two tabs:

1. **All (الكل)** — recent deposits, expenses, and auto-generated supervision rows.
2. **Expenses (المصروفات)** — paginated project expenses with paid/balance columns.

Transaction types:

| Type | Arabic | Purpose |
|------|--------|---------|
| `project_deposit` | عربون مشروع | Client deposit / advance |
| `project_expense` | مصروف مشروع | Project construction or design expense |
| `office_expense` | مصروف مكتبي | Office operating expense |
| `owner_deposit` | توريد صاحب المكتب | Owner capital injection |
| `withdrawal` | سحب صاحب المكتب | Owner withdrawal |
| `supervision` | أتعاب supervision | Calculated supervision fee |

Additional fields: `expense_category` (`construction`/`design`), `payment_term` (`immediate`/`credit`/`settlement`), `paid_amount`, section/item categorization.

### 3.6 Office (المكتب)

- Unified office ledger.
- Owner deposits and withdrawals.
- Office expenses tied to employees and sectors.
- Custody records (عهد نقدية) with office/project type.
- Office Excel export.

### 3.7 Employees (الموظفين)

- Employee records: name, job title, salary, contact, hire date, status.
- Fingerprint attendance upload: parses Excel/CSV, auto-detects columns, marks status (`present`, `absent`, `late`, `half_day`, `leave`).
- Monthly payroll generator:
  - Draft → Approved → Paid workflow.
  - Deductions based on attendance.
  - Bonuses and penalties from `employee_transactions`.
- Custody assignment and settlement.

### 3.8 Tasks (المهام)

- Global list of project tasks.
- Filter by status: `pending`, `in_progress`, `done`.
- Tasks are linked to projects.

### 3.9 Master Data (البيانات الأساسية)

- **Sectors** — office expense categories.
- **Items** — material catalog (CRUD exists but no dedicated screen currently loads it).
- **Work Sections** — construction phases.
- **Work Items** — tasks/items under each section, with unit and price.
- Bulk import of work sections/items via Excel paste/upload.

### 3.10 Settings (الإعدادات)

Admin gateway containing:

- **Users** — list Supabase users and profiles; add/edit users through the server-side `admin_create_auth_user` Postgres function so no service-role key is exposed in the browser.
- **Permissions** — configure per-user, per-screen access.
- **Audit Log** — last 100 INSERT/UPDATE/DELETE records.
- **Backup** — export all tables as JSON into a ZIP file.

---

## 4. Workflow Explanation

### 4.1 Client → Project → Transaction Workflow

1. Admin creates a **Client**.
2. Under the client, admin creates one or more **Projects**.
3. For each project, the admin records:
   - **Deposits** (`project_deposit`) from the client.
   - **Expenses** (`project_expense`) categorized as construction or design.
4. The system calculates:
   - Construction expenses = total expenses − design expenses.
   - Supervision fee = construction expenses × supervision_percentage / 100.
   - Client balance = deposits − expenses − supervision.

### 4.2 Vendor Payment Workflow

1. Create a **Vendor** with type `service` or `merchandise`.
2. Record service expenses directly in **Transactions** linked to the vendor.
3. Record procurements (merchandise purchases) in **Procurements** linked to vendor and project.
4. For each record, set `payment_term`:
   - `immediate` → fully paid.
   - `credit` / `settlement` → partial payment via `paid_amount`.
5. Vendor balance = (service cost + merchandise) − (service paid + merchandise paid).

### 4.3 Office Cash Flow Workflow

1. **Owner deposits** increase office cash.
2. **Owner withdrawals** decrease office cash.
3. **Office expenses** decrease office cash.
4. **Supervision income** from all projects increases office cash.
5. Office balance = (owner deposits + supervision income) − (office expenses + withdrawals).

### 4.4 Payroll Workflow

1. Upload fingerprint attendance file for the month.
2. System parses attendance and stores `attendance_records`.
3. Generate payroll:
   - Daily rate = base_salary / 30.
   - Deductions = (absent days × daily rate) + (half days × daily rate × 0.5).
   - Bonuses = sum of `employee_transactions` where type = `bonus`.
   - Penalties = sum of `employee_transactions` where type = `penalty`.
   - Net salary = base_salary − deductions + bonuses − penalties.
4. Payroll status moves: `draft` → `approved` → `paid`.

### 4.5 Custody Workflow

1. Create a custody record for an employee:
   - `office` type: linked to sector.
   - `project` type: linked to client/project.
2. Record the handed amount.
3. As expenses occur, they are currently tracked by updating `returned_amount` directly (the `custody_expenses` table exists but is not yet used in the UI).
4. Status auto-derived: `active`, `partial`, or `settled`.

### 4.6 Master Data Import Workflow

1. Admin navigates to **Master Data → Work Sections/Items**.
2. Downloads an Excel template or copies data from a spreadsheet.
3. Pastes/upload data; the system bulk-inserts sections and items.
4. Items are automatically linked to sections by name.

### 4.7 Backup Workflow

1. **Automatic:** GitHub Actions runs daily at 03:00 UTC, exports each table as JSON, commits to `backups/YYYY-MM-DD/`.
2. **Manual in-app:** Admin goes to **Settings → Backup** and downloads a ZIP containing JSON exports.
3. **Supabase native:** Daily backups are retained according to the Supabase plan.

---

## 5. Data Flow

1. **Bootstrap:** `index.html` loads `version.json`, then CDN libraries, then local JS modules sequentially.
2. **Auth:** `auth.js` authenticates with Supabase and loads profile/permissions.
3. **API calls:** `api.js` wraps Supabase REST endpoints with JWT and API key headers.
4. **CRUD:** `crud.js` handles all create/update/delete modals and writes `created_by`/`updated_by`.
5. **UI:** `ui.js` provides modals, searchable selects, spreadsheet import, and toast notifications.
6. **Routing:** `app-core.js` renders screens based on URL hash.
7. **Loaders:** `app-loaders.js` fetches data and renders each screen.
8. **Reports:** `app-reports.js` handles statement generation, Excel, and print/PDF export.
9. **Audit:** every write is logged asynchronously to `audit_logs`.
10. **Soft deletes:** rows are never hard-deleted; `deleted_at` is set to the current timestamp.

---

## 6. Architecture Notes

- **No build step:** static files are served directly.
- **No server-side rendering:** all UI is generated in the browser.
- **Client-side calculations:** balances, supervision, payroll, and vendor payables are computed in JS after fetching raw rows.
- **Denormalized names:** many tables store `*_name` columns to reduce joins over REST.
- **Versioning:** `version.json` coordinates cache busting and service-worker cache names.
- **PWA:** service worker caches static assets; manifest supports add-to-home-screen.

---

## 7. File Organization

```text
/
├── index.html              # App bootstrap and script loader
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline caching
├── version.json            # Runtime version
├── css/style.css           # All styles
├── js/
│   ├── config.js           # Supabase credentials and constants
│   ├── api.js              # REST API wrapper
│   ├── auth.js             # Authentication and permissions
│   ├── ui.js               # UI components (modal, selects, spreadsheet)
│   ├── app-core.js         # Router, layout, core utilities
│   ├── app-loaders.js      # Screen data loaders and dashboard
│   ├── app-reports.js      # Statements, Excel, print/PDF
│   └── crud.js             # All create/update/delete operations
├── schema.sql              # Initial database schema
├── schema_full_fix.sql     # Consolidated schema fix
├── migration_v*.sql        # Incremental migrations
├── scripts/                # GitHub Actions backup scripts
├── .github/workflows/      # CI/CD workflows
└── backups/                # Exported JSON backups
```

---

## 8. Terminology

| Term | Meaning |
|------|---------|
| عربون مشروع | Project deposit / advance from client |
| مصروف مشروع | Project expense |
| مصروف مكتبي | Office expense |
| توريد صاحب المكتب | Owner deposit / capital injection |
| سحب صاحب المكتب | Owner withdrawal |
| أتعاب supervision | Supervision fee based on construction cost |
| عهد نقدية | Custody / petty cash given to an employee |
| مستخلص | Procurement / purchase record |
| بند | Work item / line item |
| قسم | Work section / phase |
