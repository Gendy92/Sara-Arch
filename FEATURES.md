# Sara Arch — Features

## 1. Existing Features

### 1.1 Authentication & Access Control
- Username/password login mapped to Supabase Auth.
- `admin` and `user` roles.
- Per-screen permission matrix (`view`, `add`, `edit`, `delete`, `print`).
- Admin-only screens: Register, Settings, Users, Permissions, Audit, Backup.

### 1.2 Dashboard
- KPI cards for clients, projects, active projects, employees, and total financial movement.
- Monthly revenue vs. expense bar chart.
- Office expense distribution pie chart.
- Top vendors with outstanding balances.
- Active client balances list.

### 1.3 Clients & Projects
- Client CRUD with contact details and notes.
- Project CRUD under each client.
- Project statuses: active, completed, on-hold, cancelled.
- Client detail view with project table.
- Project detail view with KPIs, transactions, and tasks.
- Client and project statements with Excel export and print.
- Project budget with remaining balance.

### 1.4 Financial Transactions
- Project deposits (`project_deposit`).
- Project expenses (`project_expense`) with construction/design categorization.
- Office expenses (`office_expense`) linked to employee and sector.
- Owner deposits (`owner_deposit`) and withdrawals (`withdrawal`).
- Auto-calculated supervision entries (`supervision`).
- Payment terms: immediate, credit, settlement with partial paid amounts.
- Pagination on project expenses.

### 1.5 Vendors
- Vendor CRUD with service vs. merchandise classification.
- Vendor statement showing paid vs. owed balances.
- Vendor purchases (procurements) list with Excel export.
- Outstanding balance dashboard.

### 1.6 Procurements
- Add/edit procurement records linked to project, vendor, and item.
- Quantity, unit price, and auto-calculated total price.
- Payment term and paid amount tracking.
- Categorization by expense type.

### 1.7 Employees
- Employee CRUD with salary, job title, contact, and hire date.
- Fingerprint attendance upload from Excel/CSV.
- Attendance statuses: present, absent, late, half-day, leave.
- Monthly payroll generation with draft → approved → paid workflow.
- Payroll deductions based on attendance, plus bonuses and penalties.
- Custody (petty cash) assignment and settlement.

### 1.8 Tasks
- Global task list across projects.
- Status filter: pending, in-progress, done.
- Task priority and assignee fields.

### 1.9 Master Data
- Sectors CRUD (office expense categories).
- Work sections CRUD (construction phases).
- Work items CRUD under sections with unit and price.
- Bulk import of work sections/items via Excel paste/upload.
- Items catalog CRUD exists in code.

### 1.10 Administration
- User management: list Supabase users and profiles, add/edit users.
- Permissions management per user per screen.
- Audit log (last 100 INSERT/UPDATE/DELETE records).
- Local backup export as JSON ZIP.

### 1.11 Reports & Exports
- Client statement Excel export.
- Project statement Excel export.
- Vendor statement Excel export.
- Vendor purchases Excel export.
- Office ledger Excel export.
- Print/PDF export for statements.

### 1.12 Technical / UX
- Single-page app with hash-based routing.
- Arabic RTL interface.
- Mobile-responsive layout with bottom navigation.
- PWA manifest and service worker for offline static caching.
- Searchable dropdowns for all major selects.
- Skeleton loaders and toast notifications.
- Version-based cache busting.

---

## 2. Planned Features

Based on `ROADMAP.md` and amendment requests:

### Core Business
- **Invoicing module** — create invoices, numbering, status workflow, PDF export.
- **Inventory / stock management** — track item quantities, reorder alerts.
- **Quotations / estimates (عروض أسعار)** — convert quotes to projects.
- **Purchase orders (أوامر شراء)** — approval workflow.
- **Retention / holdback tracking (ضمان الأعمال)** — per-project retention amounts.

### Documents & Attachments
- **Document attachments** — upload and link files to projects/clients/transactions via Supabase Storage.

### Reporting & Analytics
- **Profit & Loss (P&L) report**.
- **Aging report** for accounts receivable and payable.
- **Cash flow statement**.
- **Project profitability card**.
- **Dashboard charts** enhancements.
- **Site diary / daily reports**.

### Platform
- **Restore from backup** — import previously exported ZIP/JSON backups.
- **Notifications / alerts** — overdue payments, low stock, deadlines.
- **URL routing / deep linking**.
- **Comprehensive test suite**.
- **Server-side business logic triggers** for consistency.

---

## 3. Missing Features / Gaps

### 3.1 UI Gaps
- **Items catalog screen** — `items` table and CRUD exist, but no screen currently loads it.
- **Custody expenses UI** — `custody_expenses` table exists but is not used; custody is tracked only by `returned_amount`.
- **Employee transactions UI** — `employee_transactions` are only consumed for payroll bonus/penalty sums; no screen to add/edit them directly.
- **Salary history UI** — `employee_salary_history` table exists but has no interface.
- **Settings screen** — no actual configurable settings (currency, company name, default supervision percentage, logo).

### 3.2 Functional Gaps
- **Restore from backup** — backup is export-only.
- **Invoicing** — no invoice creation or management.
- **Inventory tracking** — procurements do not affect stock levels.
- **Quotations / purchase orders** — not implemented.
- **Document attachments** — no Supabase Storage integration.
- **Retention tracking** — not implemented.
- **P&L / aging / cash flow reports** — not implemented.

### 3.3 Data Consistency Gaps
- **Client-side calculations only** — supervision, balances, payroll, and vendor payables are computed in the browser; no database views/triggers enforce consistency.
- **No server-side aggregation** — large unbounded queries may degrade at scale.
- **Audit `old_data` is always null** — UPDATE/DELETE audit logs do not capture previous values.
- **Duplicate detection** — no unique checks or warnings for duplicate clients/projects/vendors.
- **Soft-deleted records** — not always excluded from backup exports and some queries.

### 3.4 Security Gaps
- **Exposed service-role key** in `js/config.js` and `scripts/backup.sh`.
- **Open RLS policies** — any authenticated user can access any row.
- **Service key stored in localStorage** for admin operations.
- **No input sanitization** beyond basic table rendering — XSS risk in modals/dropdowns.

### 3.5 Testing Gaps
- **No automated tests** — only manual `TEST_PLAN.md` for v83.
- **Test plan is outdated** — v83 test plan does not cover v162 features.

### 3.6 Documentation Gaps
- `APP_TABS_GUIDE.md` and `APP_TABS_GUIDE_EN.md` are at v105 while runtime is v162.
- `TEST_DATA.md` and `TEST_PLAN.md` target v83.
- `ROADMAP.md` is based on a v105 audit.
