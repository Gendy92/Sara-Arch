# Sara Arch — Improvement Roadmap

> Generated after full codebase audit (v105). Prioritized by business impact and implementation effort.

---

## Phase 1: Critical Fixes — Do First 🚨
*Goal: Fix broken calculations, data loss risks, and security holes.*

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 1.1 | **Fix procurement `total_price` save** | `addProcurement` / `editProcurement` never compute `total_price`. Vendor balances & purchase reports show `null`. | 30 min |
| 1.2 | **Fix old-schema procurement paid amount** | Legacy procurements (no `payment_term`) assumed **fully unpaid** (`paid=0`), inflating vendor balances. Should default to `total_price` if immediate/cash. | 20 min |
| 1.3 | **Add `min="0"` to all financial inputs** | Negative deposits, expenses, salaries currently allowed → corrupts all balances. | 30 min |
| 1.4 | **Fix audit trail `old_data`** | Every UPDATE/DELETE logs `old_data: null`. You can't see what changed. Fetch record before PATCH/DELETE and pass it. | 1 hr |
| 1.5 | **Remove exposed `SUPABASE_SERVICE_KEY`** | Hardcoded service role key in `js/config.js` = anyone can be admin. Move to backend function or env var. | 2 hrs |
| 1.6 | **Fix payroll regeneration bug** | Regenerating an already `paid` payroll keeps `paid` status with new numbers. Reset to `draft` on regeneration. | 20 min |
| 1.7 | **Add duplicate detection** | Same client name, project name, vendor name can be created infinitely. Add DB unique constraints or client-side checks. | 1 hr |
| 1.8 | **Fix silent API failures** | 15+ `catch(e) { console.error(e) }` patterns show "جاري التحميل..." forever. Show error + retry button. | 2 hrs |

---

## Phase 2: Core Business Features — High Value 💼
*Goal: Add the missing ERP features that construction offices actually need.*

| # | Feature | Business Value | Effort |
|---|---------|----------------|--------|
| 2.1 | **Invoicing (فواتير)** | Generate formal invoices from deposits/expenses. PDF print + numbering + status (draft/sent/paid). | 4 hrs |
| 2.2 | **Inventory / Stock Management** | Track item quantities, stock-in (procurement), stock-out (project consumption), reorder alerts. | 6 hrs |
| 2.3 | **Quotations / Estimates (عروض أسعار)** | Pre-project cost estimates with line items (section → item → qty → unit price → total). Convert quotation → project in one click. | 5 hrs |
| 2.4 | **Purchase Orders (أوامر شراء)** | PO header + lines, approval workflow, PO-to-procurement matching, status tracking. | 5 hrs |
| 2.5 | **Project Tasks / Scheduling** | Simple task list per project with start/end dates, assignee, status (pending/in-progress/done). Gantt chart optional. | 4 hrs |
| 2.6 | **Document Attachments** | Upload contracts, invoices, receipts, photos per project/client/vendor. Store in Supabase Storage. | 3 hrs |
| 2.7 | ~~Taxes / VAT (ضريبة القيمة المضافة)~~ | ~~Removed — app does not calculate tax~~ | — |
| 2.8 | **Retention / Holdback (ضمان الأعمال)** | Per-project retention % (e.g., 5%). Track retained amount, release on completion. | 3 hrs |

---

## Phase 3: Scale & UX — Quality of Life 📱
*Goal: Make the app feel professional and handle real data volume.*

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 3.1 | **Pagination on Transactions, Clients, Vendors** | Currently loads **ALL** records. Will break at 1000+ rows. Add server-side pagination. | 3 hrs |
| 3.2 | **PWA (Add to Home Screen)** | Web App Manifest + Service Worker + icons + theme color. Makes it feel like a native app. | 2 hrs |
| 3.3 | **Skeleton Loaders** | Replace "جاري التحميل..." text with animated skeleton placeholders. Much better perceived performance. | 2 hrs |
| 3.4 | **Form Validation UX** | Red borders, inline errors, shake animation. Currently only HTML5 `required` with browser defaults. | 2 hrs |
| 3.5 | **Empty State CTAs** | Show "+ إضافة أول عميل" button inside empty lists instead of plain text. | 1 hr |
| 3.6 | **Fix iOS Input Zoom** | Search inputs & report date filters use `font-size:13px` → iOS zooms in. Change to `16px` on mobile. | 15 min |
| 3.7 | **Quick Date Filters** | "Today", "This Month", "Last Month" buttons in all report date filters. | 1 hr |
| 3.8 | **Keyboard Shortcuts** | Escape = close modal, Ctrl+Enter = submit form, Ctrl+S = save spreadsheet. | 1 hr |
| 3.9 | **Restore from Backup** | Upload the ZIP backup and re-import all tables. Currently backup is export-only. | 3 hrs |
| 3.10 | **Notifications / Alerts** | In-app notification bell for: overdue payments, pending approvals, low stock, upcoming deadlines. | 4 hrs |

---

## Phase 4: Reporting & Analytics — Insights 📊
*Goal: Give the business owner visibility into profitability and cash flow.*

| # | Feature | Business Value | Effort |
|---|---------|----------------|--------|
| 4.1 | **Profit & Loss (P&L) Report** | Income (deposits + supervision) vs Costs (expenses + office). Monthly / quarterly / yearly. | 3 hrs |
| 4.2 | **Aging Report (A/R & A/P)** | How old are client balances and vendor payables? 0-30, 31-60, 61-90, 90+ days. Critical for credit control. | 2 hrs |
| 4.3 | **Cash Flow Statement** | Operating / Investing / Financing flows over time. Bar chart by month. | 3 hrs |
| 4.4 | **Project Profitability Card** | Per project: `Profit = Value - Total Expenses`. Show margin % in project budget page. | 1 hr |
| 4.5 | **Dashboard Charts** | Replace KPI text with Chart.js: revenue trend, expense breakdown by category, top vendors, top clients. | 4 hrs |
| 4.6 | **Site Diary / Daily Reports** | Daily log per project: weather, manpower count, equipment, progress notes, photos. | 3 hrs |

---

## Phase 5: Technical Excellence — Foundation 🔧
*Goal: Clean up technical debt for long-term maintainability.*

| # | Task | Why | Effort |
|---|------|-----|--------|
| 5.1 | **Modularize `app.js`** | Split into `screens/`, `utils/`, `api/` modules. Currently 3,175 lines in one file. | 6 hrs |
| 5.2 | **Add URL Routing** | `/clients`, `/projects/123`, `/transactions?tab=expenses`. Enables bookmarks, back button, refresh persistence. | 4 hrs |
| 5.3 | **DB Triggers for Business Logic** | Move supervision calc, payment_term auto-compute, expense_category auto-detect to PostgreSQL triggers. Ensures consistency even if data is modified outside the app. | 3 hrs |
| 5.4 | **Add DB Indexes** | Index `transactions(project_id, type, date)`, `procurements(vendor_id, date)`, `attendance_records(date)` for query speed. | 1 hr |
| 5.5 | **Cascade Soft Deletes** | When client is soft-deleted, cascade to projects + transactions. Or enforce FK checks. | 2 hrs |
| 5.6 | **Input Sanitization** | Escape all user data in HTML beyond just `App.table()`. Prevent XSS in modals, summaries, dropdowns. | 3 hrs |
| 5.7 | **Unit Tests** | Add Jest tests for calculation functions: dashboard balances, supervision, payroll, date filters. | 4 hrs |

---

## Recommended Execution Order

### Week 1 — Critical Fixes (Phase 1)
Fix everything that can corrupt data or mislead the user. This is non-negotiable.

### Week 2 — Core Features (Phase 2)
Pick 2-3 features based on your daily pain points:
- If you issue invoices manually → **Invoicing**
- If you lose track of materials → **Inventory**
- If clients ask for estimates first → **Quotations**

### Week 3 — Scale & UX (Phase 3)
Pagination + PWA + Skeleton loaders will make the app feel 10x more professional.

### Week 4 — Reporting (Phase 4)
P&L + Aging + Cash Flow give you the numbers to run the business confidently.

---

## Quick Wins (Under 30 Minutes Each)

These can be done immediately for instant improvement:

1. ✅ Fix `total_price` in procurement save
2. ✅ Add `min="0"` to amount inputs
3. ✅ Fix iOS zoom (`font-size: 16px` on mobile inputs)
4. ✅ Add `theme-color` meta tag + Arabic title
5. ✅ Fix `doLogout()` to use `UI.confirm()` instead of native `confirm()`
6. ✅ Add Web App Manifest + `apple-touch-icon`
7. ✅ Add project profit margin to budget page
8. ✅ Fix payroll regeneration status reset

---

## Schema Changes Needed

Some features require new DB tables/columns:

```sql
-- Invoicing
CREATE TABLE invoices (id UUID, number TEXT, client_id UUID, project_id UUID, date DATE, due_date DATE, subtotal NUMERIC, total NUMERIC, status TEXT, notes TEXT);
CREATE TABLE invoice_lines (id UUID, invoice_id UUID, description TEXT, quantity NUMERIC, unit_price NUMERIC, total NUMERIC);

-- Inventory
CREATE TABLE inventory_transactions (id UUID, item_id UUID, type TEXT, quantity NUMERIC, project_id UUID, procurement_id UUID, date DATE, notes TEXT);
ALTER TABLE items ADD COLUMN reorder_level NUMERIC DEFAULT 0;

-- Quotations
CREATE TABLE quotations (id UUID, client_id UUID, project_id UUID, date DATE, expiry_date DATE, subtotal NUMERIC, total NUMERIC, status TEXT);
CREATE TABLE quotation_lines (id UUID, quotation_id UUID, section_id UUID, item_id UUID, description TEXT, quantity NUMERIC, unit_price NUMERIC, total NUMERIC);


-- Retention
ALTER TABLE projects ADD COLUMN retention_percent NUMERIC DEFAULT 5;
ALTER TABLE projects ADD COLUMN retention_amount NUMERIC DEFAULT 0;
ALTER TABLE projects ADD COLUMN retention_released_at TIMESTAMP;

-- Tasks
CREATE TABLE project_tasks (id UUID, project_id UUID, name TEXT, assignee_id UUID, start_date DATE, end_date DATE, status TEXT, priority TEXT, notes TEXT);

-- Documents
CREATE TABLE documents (id UUID, entity_type TEXT, entity_id UUID, file_name TEXT, file_path TEXT, file_size NUMERIC, uploaded_by UUID, uploaded_at TIMESTAMP);

-- Notifications
CREATE TABLE notifications (id UUID, user_id UUID, type TEXT, title TEXT, message TEXT, read BOOLEAN DEFAULT false, created_at TIMESTAMP);
```

---

*Last updated: v105 audit*
