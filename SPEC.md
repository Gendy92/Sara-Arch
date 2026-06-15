# Sara-Arch — Product Specification Document (SPEC)

**Version:** 1.2  
**Date:** 2026-06-15  
**Status:** Draft — Phase 1 updated, pending final approval  
**Author:** Project documentation analysis  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Purpose](#2-purpose)
3. [Current State & Constraints](#3-current-state--constraints)
4. [Target Users](#4-target-users)
5. [User Roles](#5-user-roles)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Database Requirements](#8-database-requirements)
9. [Future Modules](#9-future-modules)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Glossary](#11-glossary)

---

## 1. Introduction

Sara-Arch (سارة أبو العلا — النظام المالي والمحاسبي) is a browser-based financial and operational management system tailored for small-to-medium construction and design offices. It consolidates client management, project accounting, vendor procurement, employee payroll, custody tracking, and office cash flow into a single lightweight Progressive Web App (PWA).

This specification defines the product’s purpose, current state, intended audience, functional behavior, quality attributes, data model expectations, and criteria for accepting each feature.

---

## 2. Purpose

### 2.1 Problem Statement

Construction and design offices typically manage finances across multiple disconnected spreadsheets: client deposits, project expenses, vendor payments, employee salaries, and office petty cash. This leads to:

- Inconsistent calculations and duplicated data entry.
- Difficulty tracking project profitability.
- Delayed or inaccurate payroll processing.
- Limited visibility into vendor payables and client receivables.
- No centralized audit trail.

### 2.2 Product Goal

Sara-Arch aims to provide a single, centralized, easy-to-use financial and operations platform that:

- Tracks all money movement (income, expenses, payroll, custody, vendor payables).
- Calculates project-level supervision fees and client balances automatically.
- Manages employees, attendance, and monthly payroll.
- Maintains master data (sectors, work sections, items) for consistent categorization.
- Provides printable and exportable statements and reports.
- Enforces role-based access for data security.

### 2.3 Scope

**In scope:**
- Client and project management.
- Project deposits, expenses, and supervision calculation.
- Vendor and procurement management.
- Office cash flow (owner deposits/withdrawals, office expenses).
- Employee records, attendance upload, payroll, and custody.
- Master data management and bulk import.
- User management and permissions.
- Audit logging and backup export.

**Out of scope (for current version):**
- Inventory/stock tracking. N/A
- Invoicing and quotations. N/A
- Purchase orders. N/A
- Document attachments.  no because will consume data whil supabase freeplan wont fit
- Retention/holdback tracking. N/A	
- Advanced analytics and dashboards. don't over complicate			
- Multi-currency support. only EGP.
- Mobile native apps. ok

---

## 3. Current State & Constraints

### 3.1 Runtime Version

The application is currently at **runtime version v163** with active branch `dev.2`. The `main` branch has been fast-forwarded to match `dev.2`.

### 3.2 High-Impact Issues (Resolved in v163)

The following issues were resolved in the v163 development cycle. They are kept here for traceability.

| # | Issue | Status | Resolution |
|---|-------|--------|------------|
| 1 | Exposed Supabase service-role key in `.env`, `scripts/backup.js`, and `js/config.js`. | ✅ Resolved | Keys removed from source; workflow now reads from GitHub Secrets; keys must be rotated in Supabase Dashboard. |
| 2 | Service-role key is stored in browser `localStorage` and used for admin API calls. | ✅ Resolved | Admin auth endpoints now throw in the browser; service-role key is never stored or used client-side. |
| 3 | All tables use open RLS policy `authenticated_all`. | ✅ Resolved | `schema_full_fix.sql` applies admin/full-access + owner-restricted policies via `is_app_admin()`. |
| 4 | `Auth.can()` defaults to `true` when no permission row exists. | ✅ Resolved | `Auth.can()` now default-denies when no permission row exists. |
| 5 | User-controlled data is rendered via `innerHTML` without escaping. | ✅ Resolved | Key screens now use `App.esc()` before injecting user-controlled values into HTML. |
| 6 | `procurements.total_price` is a generated column, but code tries to write it. | ✅ Resolved | Procurement POST/PATCH payloads no longer include `total_price`. |
| 7 | Client/project statements exclude procurements; project budget includes them. | ✅ Resolved | `clientStatement` and `projectStatement` now include procurements as expenses. |
| 8 | Schema drift between `schema.sql`, `schema_full_fix.sql`, and migrations. | ✅ Resolved | `schema_full_fix.sql` reconciles missing columns (`due_date`, `username`, `notes`, etc.) and adds required triggers/indexes. |
| 9 | Procurement and item-catalog CRUD exist but are not exposed in the UI. | ✅ Resolved | Procurement add/edit/delete UI is exposed inside vendor purchases; items catalog card is exposed in Master Data. |
| 10 | Audit log `old_data` is always `null` on UPDATE/DELETE. | ✅ Resolved | `Crud.save` and `Crud.softDelete` now capture `old_data` before writing. |

### 3.2a Remaining High-Impact Items

| # | Issue | Impact | Planned Phase |
|---|-------|--------|---------------|
| A | Client/project/vendor statement layout redesign (summary header + print/PDF) is in `Claude/` and not merged. | Statements do not yet match the exact acceptance criteria. | Phase 2 |
| B | Procurement paid amount is not reflected as a project expense transaction. | Vendor/project balances may diverge from transaction ledger. | Phase 3 |
| C | No Content-Security-Policy meta tag. | XSS mitigation relies only on escaping. | Phase 4 |

### 3.3 Pending Design Updates

The `Claude/` folder contains a redesign of statements and the API layer that addresses some of the issues above. Key pending changes include:

- A `fetchAll()` helper to paginate large queries automatically.
- Redesigned `projectStatement` with a client summary header plus project-only detail table.
- Print/PDF buttons for client and project statements.
- Consistent entity scoping for client, project, and vendor statements.

These changes must be reviewed, approved, and reflected in the specification before implementation.

### 3.4 Baseline Assumptions

- The canonical runtime baseline is `schema_full_fix.sql`, which is idempotent and safe to rerun in the Supabase SQL Editor.
- Legacy migrations remain in the repo for historical reference but should not be applied independently to a fresh project.
- Supabase credentials are provided via `js/config.local.js` (browser) and GitHub Secrets / environment variables (server-side backup). `js/config.js` contains only placeholders.

---

## 5. User Roles

### 5.1 Role Definitions

| Role | Identifier | Description |
|------|------------|-------------|
| **Administrator** | `admin` | Full system access, including user/permission management, audit logs, and backup. |
| **Standard User** | `user` | Access limited to screens and actions granted in `user_permissions`. |

### 5.2 Permission Model

Permissions are evaluated per screen and per action:

| Action | Description |
|--------|-------------|
| `can_view` | User can navigate to and view the screen. |
| `can_add` | User can create new records on the screen. |
| `can_edit` | User can modify existing records. |
| `can_delete` | User can soft-delete records. |
| `can_print` | User can export/print statements and reports. |

### 5.3 Admin-Only Screens

The following screens are restricted to administrators regardless of `user_permissions`:

- User Registration (`register`)
- Settings (`settings`)
- Users (`users`)
- Permissions (`permissions`)
- Audit Log (`audit`)
- Backup (`backup`)

### 5.4 Role Storage

- `auth.users.user_metadata.role` — initial role at registration.
- `profiles.role` — authoritative role used by the application.
- `user_permissions` — per-screen action matrix for non-admin users.

---

## 6. Functional Requirements

### 6.1 Authentication & Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-001 | The system shall allow users to log in with a username and password. | Must |
| AUTH-002 | Usernames shall be mapped internally to an email format for Supabase Auth. | Must |
| AUTH-003 | The system shall maintain a session via JWT stored in `sessionStorage` (scoped to the tab, cleared on close). | Must |
| AUTH-004 | The system shall load the user profile and permissions after login. | Must |
| AUTH-005 | The system shall prevent non-admin users from accessing admin-only screens. | Must |
| AUTH-006 | The system shall hide navigation items that the user cannot view. | Must |
| AUTH-007 | The system shall deny access by default when no permission row exists for a screen. | Must |

### 6.2 Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| DASH-001 | The dashboard shall display KPI cards: total clients, total projects, active projects. | Must |
| DASH-002 | The dashboard shall display a monthly (project) revenue vs. expense bar chart. | Should |
| DASH-003 | The dashboard shall display an office expense pie chart grouped by sector. | Should |
| DASH-004 | The dashboard shall list top vendors with non-zero balances. | Should |
| DASH-005 | The dashboard shall list active clients with non-zero balances. | Should |
| DASH-006 | Dashboard calculations shall use server-side aggregation where possible to avoid loading unbounded datasets. | Should |

### 6.3 Clients & Projects

| ID | Requirement | Priority |
|----|-------------|----------|
| CLNT-001 | Users shall be able to create, edit, and soft-delete clients allowed by admins only. | Must | 
| CLNT-002 | Client records shall include name, phone, address, and notes. | Must |
| CLNT-003 | Users shall be able to create, edit, and admins only can soft-delete projects under a client. | Must |
| CLNT-004 | Project records shall include name, address, value, supervision percentage, status, dates, and notes. | Must |
| CLNT-005 | Project status shall be one of: active, completed, on_hold, cancelled. | Must |
| CLNT-006 | The system shall provide a client detail view showing client summary and project list. | Must |
| CLNT-007 | The system shall provide a project detail view showing KPIs, transactions, and tasks. | Must |
| CLNT-008 | The system shall generate a client statement showing all related transactions each project in separate chapter , separated by Project however 1st page showing summary for all client projects. | Must |
| CLNT-009 | The system shall generate a project statement showing all project related transactions however 1st page showing summary for all client projects. | Must |
| CLNT-010 | The project statement shall include a client summary section at the top, followed by project-specific details. | Should |
| CLNT-011 | The system shall generate a project budget report with remaining balance for each project alone. | Must |
| CLNT-012 | Client and project statements shall support print/PDF. | Should |
| CLNT-013 | The system shall detect and warn about duplicate client names. | Should |

### 6.4 Project Transactions

| ID | Requirement | Priority |
|----|-------------|----------|
| TXN-001 | The system shall support project deposit transactions. | Must |
| TXN-002 | The system shall support project expense transactions categorized as construction or design. | Must |
| TXN-005 | The system shall auto-generate supervision transaction rows based on construction expenses and project supervision percentage except if expense is design cost. | Must |
| TXN-006 | Each transaction shall support `payment_method` (cash / bank / transfer) and `payment_term` (immediate / credit / settlement), with optional partial `paid_amount`. | Should |
| TXN-007 | Transactions shall be linkable to work sections and work items. | must |
| TXN-008 | The expenses tab shall display paginated project expenses with paid/balance columns. | Must |
| TXN-009 | The transactions "All" tab shall not silently truncate data beyond a fixed row limit. | Must |

### 6.5 Office Transactions
| TXN-003 | The system shall support office expense transactions linked to an employee and sector. | Must |
| TXN-004 | The system shall support owner deposit and withdrawal transactions. | Must |
| TXN-010 | The system shall custody to employee as office expense transactions. | Must |
| TXN-011 | The system shall Salaries as office expense transactions. | Must |



### 6.6 Vendors & Procurements

| ID | Requirement | Priority |
|----|-------------|----------|
| VEND-001 | Users shall be able to create, edit, and only admins can soft-delete vendors. | Must |
| VEND-002 | Vendors shall be classified as `service` or `merchandise`. | Must |
| VEND-003 | Vendor records shall include name, contact person, phone, address, sector, type, and notes. | Must |
| VEND-004 | The system shall generate a vendor statement showing service expenses and procurements with paid vs. owed balances. | Must |
| VEND-005 | The system shall display vendor non-zero balance in the vendors list. | Must |
| PROC-001 | Users shall be able to create, edit, and only admins can soft-delete procurement records from the vendor UI. | Must |
| PROC-002 | Procurement records shall link to a project, vendor, and item. | Must |
| PROC-003 | Procurement records shall include quantity, unit price, and total price. | Must |
| PROC-004 | Total price shall be computed by the database or application and shall not conflict with generated columns. | Must |
| PROC-005 | Procurement records shall support payment term and paid amount & to be reflected as project expense transaction. | Should |
| PROC-006 | Vendor statements and purchases shall support print/PDF. | Should |

### 6.7 Office Cash Flow

| ID | Requirement | Priority |
|----|-------------|----------|
| OFFC-001 | The system shall display office income from owner deposits and supervision fees & services where the office itself is the vendor . | Must |
| OFFC-002 | The system shall display office expenses and owner withdrawals. | Must |
| OFFC-003 | The system shall calculate and display the current office balance. | Must |
| OFFC-004 | The system shall provide an office ledger Excel export. | Should |

### 6.8 Employees // Hold for now

| ID | Requirement | Priority |
|----|-------------|----------|
| EMP-001 | Users shall be able to create, edit, and soft-delete employees. | Must |
| EMP-002 | Employee records shall include name, job title, salary, phone, email, hire date, active status, and notes. | Must |
| EMP-003 | The system shall allow uploading fingerprint attendance files (Excel/CSV). | Must |
| EMP-004 | The system shall parse attendance and record status as present, absent, late, half_day, or leave. | Must |
| EMP-005 | The system shall generate monthly payroll per employee. | Must |
| EMP-006 | Payroll shall support workflow status: draft, approved, paid. | Must |
| EMP-007 | Payroll calculations shall include attendance deductions, bonuses, and penalties. | Must |
| EMP-008 | The system shall track custody (petty cash) given to employees for office or project use. | Must |
| EMP-009 | The system shall provide a UI to record custody expenses against custody records. | Should |
| EMP-010 | Salary changes shall be logged in `employee_salary_history`. | Should |

### 6.9 Tasks

| ID | Requirement | Priority |
|----|-------------|----------|
| TASK-001 | The system shall provide a global task list across projects. | Should |
| TASK-002 | Tasks shall support status: pending, in_progress, done. | Should |
| TASK-003 | Tasks shall support priority and assignee fields. | Should |
| TASK-004 | The `updated at` column on tasks shall be maintained by a database trigger. | Should |

### 6.10 Master Data

| ID | Requirement | Priority |
|----|-------------|----------|
| MSTR-001 | Users shall be able to manage sectors (office expense categories). | Must |
| MSTR-002 | Users shall be able to manage work sections (construction phases). | Must |
| MSTR-003 | Users shall be able to manage work items under work sections. | Must |
| MSTR-004 | Work items shall support unit and price fields. | Should |
| MSTR-005 | The system shall support bulk import of work sections and items via Excel paste/upload. | Should |
| MSTR-006 | The system shall expose an items catalog (materials) in the UI. | Should |
| MSTR-007 | The system shall detect and prevent duplicate master-data entries. | Should |
| MSTR-008 | The system shall detect and warn for potential duplicate master-data entries. | Should |


### 6.11 Administration

| ID | Requirement | Priority |
|----|-------------|----------|
| ADMN-001 | Admins shall be able to list and manage users. | Must |
| ADMN-002 | Admins shall be able to configure per-user, per-screen permissions. | Must |
| ADMN-003 | The system shall log INSERT, UPDATE, and DELETE actions in an audit log. | Must |
| ADMN-004 | The audit log shall capture table name, record ID, action type, old data, new data, user, and timestamp. | Should |
| ADMN-005 | Admins shall be able to export all tables as a ZIP of JSON files. | Must |
| ADMN-006 | User creation shall not depend on a browser-stored service-role key. | Must |

### 6.12 Reports & Exports

| ID | Requirement | Priority |
|----|-------------|----------|
| RPT-001 | The system shall generate printable statements for clients, projects, vendors, and office. | Must |
| RPT-002 | The system shall export statements to Excel. | Should |
| RPT-003 | The system shall support print-to-PDF for statements. | Should |
| RPT-004 | Reports shall include all relevant data without silent truncation. | Must |
| RPT-005 | Large reports shall use server-side pagination or aggregation. | Must |

### 6.13 Security

| ID | Requirement | Priority |
|----|-------------|----------|
| SEC-001 | All user-supplied text rendered in HTML shall be escaped. | Must |
| SEC-002 | Service-role keys shall not be stored or used in the browser. | Must |
| SEC-003 | RLS policies shall enforce row-level access boundaries. | Must |
| SEC-004 | The system shall include a Content-Security-Policy header/meta tag. | Should |
| SEC-005 | The application shall not expose secrets in source control. | Must |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| ID | Requirement | Priority |
|----|-------------|----------|
| PERF-001 | All screen loads shall complete within 3 seconds under normal network conditions. | Must |
| PERF-002 | Lists with more than 15 rows shall use server-side pagination. | Must |
| PERF-003 | Dashboard KPI queries shall be bounded to avoid loading unbounded datasets. | Must |
| PERF-004 | Excel export of statements shall complete within 10 seconds for up to 1,000 rows. | Should |
| PERF-005 | Backup export shall handle large tables via chunking or server-side processing. | Should |

### 7.2 Security

| ID | Requirement | Priority |
|----|-------------|----------|
| SEC-006 | The application shall authenticate all requests using Supabase JWT. | Must |
| SEC-007 | Sensitive configuration shall be stored in environment/secrets, not source control. | Must |
| SEC-008 | User inputs shall be sanitized to prevent XSS. | Must |
| SEC-009 | The system shall gracefully handle invalid or expired tokens by redirecting to login. | Must |

### 7.3 Reliability

| ID | Requirement | Priority |
|----|-------------|----------|
| REL-001 | The system shall use soft deletes to preserve historical data. | Must |
| REL-002 | The system shall log all write operations for audit purposes. | Must |
| REL-003 | API failures shall display user-friendly error messages instead of infinite loading states. | Must |
| REL-004 | The system shall support daily automated backups. | Must |
| REL-005 | The system shall validate parsed attendance data and flag invalid rows. | Should |

### 7.4 Usability

| ID | Requirement | Priority |
|----|-------------|----------|
| UX-001 | The interface shall be in Arabic with RTL layout. | Must |
| UX-002 | The application shall be usable on desktop and mobile browsers. | Must |
| UX-003 | All lists shall include search/filter capabilities. | Should |
| UX-004 | Forms shall validate inputs and show clear error messages. | Must |
| UX-005 | The application shall support PWA installation and offline static caching. | Should |
| UX-006 | The interface shall provide empty-state guidance when lists are empty. | Should |

### 7.5 Maintainability

| ID | Requirement | Priority |
|----|-------------|----------|
| MNT-001 | Code shall be modular and organized by feature. | Should |
| MNT-002 | Database migrations shall be versioned and reproducible. | Must |
| MNT-003 | Documentation shall be kept in sync with code changes. | Should |
| MNT-004 | Dead code and unused schema objects shall be removed or documented. | Should |

### 7.6 Compatibility

| ID | Requirement | Priority |
|----|-------------|----------|
| COMP-001 | The application shall run in the latest versions of Chrome, Edge, Firefox, and Safari. | Must |
| COMP-002 | The application shall be deployable to GitHub Pages without a build step. | Must |

---

## 8. Database Requirements

### 8.1 Database Platform

- The system shall use **Supabase PostgreSQL** as the primary datastore.
- The system shall expose tables through **PostgREST**.
- The system shall use **Supabase Auth** for identity management.

### 8.2 Required Tables

The database shall contain the following tables:

1. `clients`
2. `projects`
3. `employees`
4. `vendors`
5. `items`
6. `sectors`
7. `transactions`
8. `procurements`
9. `employee_transactions`
10. `employee_salary_history`
11. `custody_records`
12. `custody_expenses`
13. `attendance_records`
14. `payroll_records`
15. `work_sections`
16. `work_items`
17. `profiles`
18. `audit_logs`
19. `user_permissions`
20. `project_tasks`

### 8.3 Data Integrity Requirements

| ID | Requirement |
|----|-------------|
| DB-001 | All transactional tables shall support soft deletes via `deleted_at`. |
| DB-002 | Major tables shall include `created_by` and `updated_by` audit columns. |
| DB-003 | `updated_at` shall be automatically maintained via triggers. |
| DB-004 | Foreign keys shall be defined where relationships exist. |
| DB-005 | Unique constraints shall prevent duplicate permission entries per user/screen. |
| DB-006 | Payroll records shall be unique per employee/month/year. |
| DB-007 | `procurements.total_price` shall be a generated column or computed consistently. |
| DB-008 | The schema baseline and migrations shall produce a single consistent effective schema. |

### 8.4 Security Requirements

| ID | Requirement |
|----|-------------|
| DB-009 | RLS shall be enabled on all tables. |
| DB-010 | RLS policies shall restrict users to data they own or are authorized to access. |
| DB-011 | Service-role keys shall only be used in secure server-side contexts. |

### 8.5 Backup Requirements

| ID | Requirement |
|----|-------------|
| DB-012 | The database shall support daily automated JSON exports via GitHub Actions. |
| DB-013 | Supabase native daily backups shall be enabled. |
| DB-014 | The application shall provide a manual backup export function. |

---

## 9. Future Modules

### 9.1 Invoicing
- Create and manage client invoices.
- Auto-numbering and status workflow (draft, sent, paid, cancelled).
- Link invoices to projects and deposits.
- PDF export and print.

### 9.2 Inventory / Stock Management
- Track stock quantities for merchandise items.
- Update stock on procurement.
- Reorder alerts.

### 9.3 Quotations & Purchase Orders
- Create project quotations/estimates.
- Convert quotations to projects or invoices.
- Create purchase orders with approval workflow.

### 9.4 Document Attachments
- Upload files to Supabase Storage.
- Link attachments to clients, projects, transactions, and employees.

### 9.5 Retention / Holdback Tracking
- Track retention amounts per project.
- Release retention upon project completion.

### 9.6 Advanced Reporting
- Profit & Loss (P&L) report.
- Accounts receivable/payable aging.
- Cash flow statement.
- Project profitability dashboard.

### 9.7 Notifications
- Alerts for overdue payments.
- Low stock alerts.
- Task deadline reminders.

### 9.8 Restore from Backup
- Import previously exported JSON/ZIP backups.
- Validation and conflict resolution.

---

## 10. Acceptance Criteria

### 10.1 Authentication & Access Control

**AC-AUTH-001:** Given a registered user, when they enter a valid username and password, then they are logged in and redirected to the dashboard.

**AC-AUTH-002:** Given a non-admin user, when they try to access the Settings screen via URL, then they are redirected to the dashboard or shown an access-denied message.

**AC-AUTH-003:** Given a user without view permission for Vendors, when the navigation loads, then the Vendors menu item is not displayed.

**AC-AUTH-004:** Given a newly created non-admin user with no permission rows, when they log in, then they cannot access any restricted screen.

### 10.2 Dashboard

**AC-DASH-001:** Given the dashboard loads, when data is available, then KPI cards display the correct counts and totals.

**AC-DASH-002:** Given monthly transactions exist, when the dashboard renders, then the revenue/expense bar chart shows data for the current year.

### 10.3 Clients & Projects

**AC-CLNT-001:** Given a user clicks "Add Client", when they fill and save the form, then a new client appears in the client list.

**AC-CLNT-002:** Given a client has projects, when the user views the client detail, then all projects are listed with their current balance.

**AC-CLNT-003:** Given a project with deposits and expenses, when the project statement is generated, then supervision is calculated as `(construction_expenses × supervision_percentage / 100)`.

**AC-CLNT-004:** Given a project statement, when the user clicks Excel export, then a correctly formatted Excel file is downloaded containing a client summary and project details.

**AC-CLNT-005:** Given a project statement, when the user clicks print/PDF, then a print-optimized layout is generated.

**AC-CLNT-006:** Given a duplicate client name is entered, when the user saves, then the system warns or prevents the duplicate.

### 10.4 Transactions

**AC-TXN-001:** Given a project expense is recorded as `design`, when supervision is calculated, then the design expense is excluded from the supervision base.

**AC-TXN-002:** Given a transaction with payment term `immediate`, when saved, then `paid_amount` equals the full amount.

**AC-TXN-003:** Given a transaction with payment term `credit`, when saved, then the user can enter a partial `paid_amount` and the balance is calculated correctly.

**AC-TXN-004:** Given more than 100 project transactions exist, when the "All" tab loads, then all transactions are accessible via pagination without silent truncation.

### 10.5 Vendors & Procurements

**AC-VEND-001:** Given a vendor of type `merchandise`, when procurements are recorded, then the vendor balance includes the unpaid procurement amounts.

**AC-VEND-002:** Given a vendor statement, when exported to Excel, then all service expenses and procurements are included with correct paid/owed columns.

**AC-PROC-001:** Given a procurement with quantity 5 and unit price 100, when saved, then total price is 500 and no generated-column conflict occurs.

**AC-PROC-002:** Given the user is on the vendor detail screen, when they click "Add Purchase", then a procurement form opens and saves correctly.

### 10.6 Office Cash Flow

**AC-OFFC-001:** Given owner deposits of 10,000 and office expenses of 3,000, when the Office screen loads, then the office balance displays 7,000 plus any supervision income.

### 10.7 Employees

**AC-EMP-001:** Given an employee with base salary 3,000 and 2 absent days, when payroll is generated, then deduction equals `(3000 / 30) × 2`.

**AC-EMP-002:** Given an employee with bonuses totaling 500 and penalties totaling 200, when payroll is generated, then net salary equals `base − deductions + 500 − 200`.

**AC-EMP-003:** Given a fingerprint attendance file, when uploaded, then attendance records are created for the parsed employees and days.

**AC-EMP-004:** Given a second attendance file for the same month is uploaded, when saved, then existing records for the same employee/date are updated rather than the entire month being deleted.

### 10.8 Tasks

**AC-TASK-001:** Given a project task is created with status `pending`, when the user marks it `done`, then the task list reflects the updated status.

### 10.9 Master Data

**AC-MSTR-001:** Given a user imports work sections and items from Excel, when the import completes, then sections and items are created and correctly linked.

**AC-MSTR-002:** Given a duplicate sector name is entered, when the user saves, then the system warns or prevents the duplicate.

### 10.10 Administration

**AC-ADMN-001:** Given an admin creates a new user, when the user logs in, then they can access only the screens granted by permissions.

**AC-ADMN-002:** Given a record is updated, when the audit log is viewed, then the update action is recorded with the previous and new data.

**AC-ADMN-003:** Given an admin clicks backup, when the export completes, then a ZIP file containing JSON exports is downloaded.

**AC-ADMN-004:** Given an admin creates a user, when the operation completes, then no browser-stored service-role key is required.

### 10.11 Reports

**AC-RPT-001:** Given a client statement, when the user clicks print, then a print-optimized layout is generated.

**AC-RPT-002:** Given a vendor statement, when the user clicks Excel, then the downloaded file matches the on-screen data without truncation.

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **عربون مشروع** | Project deposit / advance from a client. |
| **مصروف مشروع** | Project expense, categorized as construction or design. |
| **مصروف مكتبي** | Office operating expense. |
| **توريد صاحب المكتب** | Owner deposit / capital injection. |
| **سحب صاحب المكتب** | Owner withdrawal. |
| **أتعاب supervision** | Supervision fee calculated as a percentage of construction expenses. |
| **عهد نقدية** | Custody / petty cash given to an employee. |
| **مستخلص** | Procurement / purchase record from a vendor. |
| **بند** | Work item / line item under a work section. |
| **قسم** | Work section / construction phase. |
| **RLS** | Row-Level Security in PostgreSQL/Supabase. |
| **PWA** | Progressive Web App. |

---

## Appendix A: Related Documents

- `README.md` — Setup and deployment guide.
- `DOCUMENTATION.md` — Detailed system description and workflows.
- `DATABASE_SCHEMA.md` — Full database schema reference.
- `FEATURES.md` — Existing, planned, and missing features.
- `ROADMAP.md` — Development roadmap and priorities.
- `CHANGELOG.md` — Version history.
- `SUGGESTIONS.md` — Prioritized improvement suggestions and quick wins.
