# Sara Arch — Database Schema

## 1. Supabase Project Structure

| Property | Value |
|----------|-------|
| **Project name** | Sara Arch — النظام المالي |
| **URL** | `https://tvjkctttcijymqvaetsv.supabase.co` |
| **Region** | `eu-north-1` |
| **Frontend hosting** | GitHub Pages |
| **Auth provider** | Supabase Auth (email/password mapped from username) |
| **Storage buckets** | None currently used |
| **Backup strategy** | GitHub Actions daily JSON export + Supabase native backups |

All data is stored in the public PostgreSQL schema exposed through PostgREST.

---

## 2. Entity Relationship Summary

```text
clients ||--o{ projects         : owns
clients ||--o{ transactions     : involved in
clients ||--o{ custody_records  : has custody for

projects ||--o{ transactions    : generates
projects ||--o{ procurements    : procures
projects ||--o{ custody_records : has project custody
projects ||--o{ project_tasks   : contains

employees ||--o{ transactions            : related to
employees ||--o{ employee_transactions   : advance/penalty/bonus
employees ||--o{ employee_salary_history : salary changes
employees ||--o{ custody_records         : holds custody
employees ||--o{ attendance_records      : attends
employees ||--o{ payroll_records         : paid monthly

vendors ||--o{ transactions   : paid/received
vendors ||--o{ procurements   : supplies

items ||--o{ procurements : procured as

sectors ||--o{ transactions    : categorizes
sectors ||--o{ custody_records : categorizes

work_sections ||--o{ work_items : contains
work_sections ||--o{ transactions : categorized by section
work_items    ||--o{ transactions : categorized by item

custody_records ||--o{ custody_expenses : spent via

auth.users ||--|| profiles : extended by
profiles   ||--o{ user_permissions : has per-screen rights
```

---

## 3. Tables

### 3.1 `clients` — العملاء

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `name` | `TEXT` | NO | — | Client name |
| `phone` | `TEXT` | YES | — | |
| `email` | `TEXT` | YES | — | |
| `address` | `TEXT` | YES | — | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated by trigger |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | Soft-delete marker |
| `created_by` | `UUID` | YES | — | Audit |
| `updated_by` | `UUID` | YES | — | Audit |

**Relationships:**
- Parent of `projects`, `transactions`, `custody_records`.

---

### 3.2 `projects` — المشاريع

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `name` | `TEXT` | NO | — | Project name |
| `client_id` | `UUID` | NO* | — | Foreign key → `clients(id)` |
| `client_name` | `TEXT` | YES | — | Denormalized |
| `address` | `TEXT` | YES | — | |
| `value` | `NUMERIC` | YES | `0` | Contract value |
| `supervision_percentage` | `NUMERIC` | YES | `0` | |
| `design_percentage` | `NUMERIC` | YES | `0` | |
| `status` | `TEXT` | YES | `'active'` | CHECK: `active`, `completed`, `cancelled`, `on_hold` |
| `start_date` | `DATE` | YES | — | |
| `end_date` | `DATE` | YES | — | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | Soft-delete |
| `created_by` | `UUID` | YES | — | |
| `updated_by` | `UUID` | YES | — | |

**Relationships:**
- Child of `clients`.
- Parent of `transactions`, `procurements`, `custody_records`, `project_tasks`.

---

### 3.3 `employees` — الموظفين

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `name` | `TEXT` | NO | — | |
| `job_title` | `TEXT` | YES | — | |
| `salary` | `NUMERIC` | YES | `0` | |
| `phone` | `TEXT` | YES | — | |
| `email` | `TEXT` | YES | — | |
| `hire_date` | `DATE` | YES | — | |
| `is_active` | `BOOLEAN` | YES | `true` | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |
| `created_by` | `UUID` | YES | — | |
| `updated_by` | `UUID` | YES | — | |

**Relationships:**
- Parent of `transactions`, `employee_transactions`, `employee_salary_history`, `custody_records`, `attendance_records`, `payroll_records`.

---

### 3.4 `vendors` — الموردين

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `name` | `TEXT` | NO | — | |
| `contact_person` | `TEXT` | YES | — | |
| `phone` | `TEXT` | YES | — | |
| `email` | `TEXT` | YES | — | |
| `address` | `TEXT` | YES | — | |
| `sector` | `TEXT` | YES | — | |
| `vendor_type` | `TEXT` | YES | `'service'` | CHECK: `service`, `merchandise` |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |
| `created_by` | `UUID` | YES | — | |
| `updated_by` | `UUID` | YES | — | |

**Relationships:**
- Parent of `transactions` (`vendor_id`), `procurements` (`vendor_id`).

---

### 3.5 `items` — الأصناف / المواد

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `name` | `TEXT` | NO | — | |
| `specification` | `TEXT` | YES | — | |
| `brand` | `TEXT` | YES | — | |
| `unit` | `TEXT` | YES | `'قطعة'` | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |
| `created_by` | `UUID` | YES | — | |
| `updated_by` | `UUID` | YES | — | |

**Relationships:**
- Parent of `procurements` (`item_id`).

---

### 3.6 `sectors` — التصنيفات

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `name` | `TEXT` | NO | — | |
| `description` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |

**Relationships:**
- Parent of `transactions` (`sector_id`), `custody_records` (`sector_id`).

**Default seed data:**
- رواتب، إيجارات، مرافق، صيانة، تسويق، نثرية

---

### 3.7 `transactions` — الحركات المالية

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `type` | `TEXT` | NO | — | CHECK: `project_deposit`, `project_expense`, `office_expense`, `owner_deposit`, `income`, `expense`, `deposit`, `withdrawal`, `supervision`, `client_return`, `vendor_settlement`, `custody_return` |
| `amount` | `NUMERIC` | NO | `0` | |
| `description` | `TEXT` | YES | — | |
| `client_id` | `UUID` | YES | — | FK → `clients(id)` |
| `party_id` | `UUID` | YES | — | Generic party reference |
| `party_name` | `TEXT` | YES | — | |
| `party_type` | `TEXT` | YES | — | |
| `project_id` | `UUID` | YES | — | FK → `projects(id)` |
| `project_name` | `TEXT` | YES | — | Denormalized |
| `employee_id` | `UUID` | YES | — | FK → `employees(id)` |
| `employee_name` | `TEXT` | YES | — | Denormalized |
| `sector_id` | `UUID` | YES | — | FK → `sectors(id)` |
| `sector_name` | `TEXT` | YES | — | Denormalized |
| `vendor_id` | `UUID` | YES | — | FK → `vendors(id)` |
| `vendor_name` | `TEXT` | YES | — | Denormalized |
| `payment_method` | `TEXT` | YES | — | |
| `date` | `DATE` | YES | `CURRENT_DATE` | |
| `created_by` | `UUID` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |
| `expense_category` | `TEXT` | YES | `'construction'` | CHECK: `construction`, `design` |
| `section_id` | `UUID` | YES | — | FK → `work_sections(id)` |
| `section_name` | `TEXT` | YES | — | |
| `item_id` | `UUID` | YES | — | FK → `work_items(id)` |
| `item_name` | `TEXT` | YES | — | |
| `payment_term` | `TEXT` | YES | `'immediate'` | |
| `paid_amount` | `NUMERIC` | YES | `0` | |
| `updated_by` | `UUID` | YES | — | |

**Indexes:**
- `idx_transactions_project_type` on `(project_id, type)`
- `idx_transactions_date` on `(date)`

---

### 3.8 `procurements` — المشتريات / المستخلصات

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `project_id` | `UUID` | YES | — | FK → `projects(id)` |
| `project_name` | `TEXT` | YES | — | |
| `vendor_id` | `UUID` | YES | — | FK → `vendors(id)` |
| `vendor_name` | `TEXT` | YES | — | |
| `item_id` | `UUID` | YES | — | FK → `items(id)` |
| `item_name` | `TEXT` | YES | — | |
| `quantity` | `NUMERIC` | YES | `1` | |
| `unit_price` | `NUMERIC` | YES | `0` | |
| `total_price` | `NUMERIC` | YES | — | Generated: `quantity * unit_price` |
| `expense_type` | `TEXT` | YES | `'أخرى'` | |
| `date` | `DATE` | YES | `CURRENT_DATE` | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |
| `payment_term` | `TEXT` | YES | `'immediate'` | |
| `paid_amount` | `NUMERIC` | YES | `0` | |
| `created_by` | `UUID` | YES | — | |
| `updated_by` | `UUID` | YES | — | |

**Index:** `idx_procurements_vendor` on `(vendor_id)`.

---

### 3.9 `employee_transactions` — حركات الموظفين

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `employee_id` | `UUID` | YES | — | FK → `employees(id)` |
| `employee_name` | `TEXT` | YES | — | |
| `type` | `TEXT` | NO | — | CHECK: `advance`, `penalty`, `bonus`, `other` |
| `amount` | `NUMERIC` | NO | `0` | |
| `date` | `DATE` | YES | `CURRENT_DATE` | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |

---

### 3.10 `employee_salary_history` — تاريخ رواتب الموظفين

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `employee_id` | `UUID` | YES | — | FK → `employees(id)` |
| `employee_name` | `TEXT` | YES | — | |
| `old_salary` | `NUMERIC` | YES | — | |
| `new_salary` | `NUMERIC` | YES | — | |
| `effective_date` | `DATE` | YES | — | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |

---

### 3.11 `custody_records` — سجلات العهدات

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `employee_id` | `UUID` | YES | — | FK → `employees(id)` |
| `employee_name` | `TEXT` | YES | — | |
| `client_id` | `UUID` | YES | — | FK → `clients(id)` |
| `client_name` | `TEXT` | YES | — | |
| `project_id` | `UUID` | YES | — | FK → `projects(id)` |
| `project_name` | `TEXT` | YES | — | |
| `amount` | `NUMERIC` | YES | `0` | |
| `returned_amount` | `NUMERIC` | YES | `0` | Σ of linked `custody_expenses` |
| `returned_cash_amount` | `NUMERIC` | YES | `0` | Cash returned by the employee |
| `status` | `TEXT` | YES | `'active'` | CHECK: `active`, `settled`, `partial` |
| `date` | `DATE` | YES | `CURRENT_DATE` | |
| `notes` | `TEXT` | YES | — | |
| `advance_transaction_id` | `UUID` | YES | — | FK → `transactions(id)` — temporary office expense for the advance |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |
| `sector_id` | `UUID` | YES | — | FK → `sectors(id)` |
| `sector_name` | `TEXT` | YES | — | |
| `custody_type` | `TEXT` | YES | `'office'` | CHECK: `office`, `project` |

---

### 3.12 `custody_expenses` — مصروفات العهدات

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `custody_id` | `UUID` | YES | — | FK → `custody_records(id)` |
| `amount` | `NUMERIC` | NO | `0` | |
| `description` | `TEXT` | YES | — | |
| `date` | `DATE` | YES | `CURRENT_DATE` | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |

---

### 3.13 `attendance_records` — سجلات الحضور والانصراف

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `employee_id` | `UUID` | YES | — | FK → `employees(id)` |
| `employee_name` | `TEXT` | YES | — | |
| `date` | `DATE` | NO | — | |
| `status` | `TEXT` | YES | `'present'` | CHECK: `present`, `absent`, `late`, `half_day`, `leave` |
| `check_in` | `TIME` | YES | — | |
| `check_out` | `TIME` | YES | — | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |
| `created_by` | `UUID` | YES | — | |
| `updated_by` | `UUID` | YES | — | |

**Index:** `idx_attendance_date` on `(date)`.

---

### 3.14 `payroll_records` — سجلات الرواتب الشهرية

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `employee_id` | `UUID` | YES | — | FK → `employees(id)` |
| `employee_name` | `TEXT` | YES | — | |
| `month` | `INTEGER` | NO | — | |
| `year` | `INTEGER` | NO | — | |
| `base_salary` | `NUMERIC` | YES | `0` | |
| `days_present` | `INTEGER` | YES | `0` | |
| `days_absent` | `INTEGER` | YES | `0` | |
| `days_late` | `INTEGER` | YES | `0` | |
| `days_half` | `INTEGER` | YES | `0` | |
| `days_leave` | `INTEGER` | YES | `0` | |
| `deductions` | `NUMERIC` | YES | `0` | |
| `bonuses` | `NUMERIC` | YES | `0` | |
| `penalties` | `NUMERIC` | YES | `0` | |
| `net_salary` | `NUMERIC` | YES | `0` | |
| `status` | `TEXT` | YES | `'draft'` | Workflow status |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |
| `created_by` | `UUID` | YES | — | |
| `updated_by` | `UUID` | YES | — | |

**Constraint:** `UNIQUE(employee_id, month, year)`.

---

### 3.15 `work_sections` — أقسام الأعمال

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `name` | `TEXT` | NO | — | |
| `description` | `TEXT` | YES | — | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |

---

### 3.16 `work_items` — بنود الأعمال

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `section_id` | `UUID` | YES | — | FK → `work_sections(id)` |
| `section_name` | `TEXT` | YES | — | Denormalized |
| `name` | `TEXT` | NO | — | |
| `unit` | `TEXT` | YES | `'م²'` | |
| `price` | `NUMERIC` | YES | `0` | |
| `description` | `TEXT` | YES | — | |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |

---

### 3.17 `profiles` — الملفات الشخصية

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | — | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `name` | `TEXT` | YES | — | Arabic display name |
| `username` | `TEXT` | YES | — | Present in `schema.sql`; used by app code |
| `role` | `TEXT` | YES | `'user'` | `admin` or `user` |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |

---

### 3.18 `audit_logs` — سجل المراجعة

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `table_name` | `TEXT` | NO | — | |
| `record_id` | `UUID` / `TEXT` | YES | — | Type differs by migration file |
| `action` | `TEXT` | NO | — | `INSERT`, `UPDATE`, `DELETE` |
| `old_data` | `JSONB` | YES | — | |
| `new_data` | `JSONB` | YES | — | |
| `user_id` | `UUID` | YES | — | |
| `user_name` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |

---

### 3.19 `user_permissions` — صلاحيات المستخدمين

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` | Primary key |
| `user_id` | `UUID` | NO | — | |
| `screen` | `TEXT` | NO | — | e.g. `clients`, `vendors`, `transactions` |
| `can_view` | `BOOLEAN` | YES | `false` | |
| `can_add` | `BOOLEAN` | YES | `false` | |
| `can_edit` | `BOOLEAN` | YES | `false` | |
| `can_delete` | `BOOLEAN` | YES | `false` | |
| `can_print` | `BOOLEAN` | YES | `false` | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | Auto-updated |

**Constraint:** `UNIQUE(user_id, screen)`.

---

### 3.20 `project_tasks` — مهام المشروع

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `uuid_generate_v4()` / `gen_random_uuid()` | Primary key |
| `project_id` | `UUID` | NO | — | FK → `projects(id)` ON DELETE CASCADE |
| `name` | `TEXT` | NO | — | |
| `assignee` | `TEXT` | YES | — | |
| `start_date` | `DATE` | YES | — | |
| `due_date` / `end_date` | `DATE` | YES | — | Column name varies by migration execution order |
| `status` | `TEXT` | YES | `'pending'` | CHECK: `pending`, `in_progress`, `done` |
| `priority` | `TEXT` | YES | `'medium'` | CHECK: `low`, `medium`, `high` |
| `notes` | `TEXT` | YES | — | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `deleted_at` | `TIMESTAMPTZ` | YES | — | |

**Index:** `idx_project_tasks_project` on `(project_id)`.

---

## 4. Functions & Triggers

### 4.1 Function

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 BEFORE UPDATE Triggers

| Trigger | Table |
|---------|-------|
| `clients_u` | `clients` |
| `projects_u` | `projects` |
| `employees_u` | `employees` |
| `vendors_u` | `vendors` |
| `items_u` | `items` |
| `sectors_u` | `sectors` |
| `transactions_u` | `transactions` |
| `procurements_u` | `procurements` |
| `employee_transactions_u` | `employee_transactions` |
| `custody_records_u` | `custody_records` |
| `custody_expenses_u` | `custody_expenses` |
| `attendance_records_u` | `attendance_records` |
| `payroll_records_u` | `payroll_records` |
| `work_sections_u` | `work_sections` |
| `work_items_u` | `work_items` |
| `profiles_u` | `profiles` |
| `user_permissions_u` | `user_permissions` |

**Notably missing triggers:** `project_tasks`, `audit_logs`, `employee_salary_history`.

---

## 5. Indexes

| Index Name | Table | Columns |
|------------|-------|---------|
| `idx_project_tasks_project` | `project_tasks` | `project_id` |
| `idx_transactions_project_type` | `transactions` | `project_id, type` |
| `idx_transactions_date` | `transactions` | `date` |
| `idx_procurements_vendor` | `procurements` | `vendor_id` |
| `idx_attendance_date` | `attendance_records` | `date` |
| *(unique constraint)* | `payroll_records` | `employee_id, month, year` |
| *(unique constraint)* | `user_permissions` | `user_id, screen` |

---

## 6. Row-Level Security (RLS)

All 20 tables have RLS enabled. Every table uses a single permissive policy:

```sql
CREATE POLICY "authenticated_all"
ON <table> FOR ALL TO authenticated
USING (true) WITH CHECK (true);
```

> **Note:** This policy allows any authenticated user full read/write access to all rows. Authorization is intended to be enforced in the application layer through `user_permissions`.

---

## 7. Schema Drift & Known Discrepancies

| Area | Observation |
|------|-------------|
| `profiles.username` | Present in `schema.sql`, absent in `schema_full_fix.sql`; app code posts it. |
| `transactions.section_id/item_id` | Plain UUID in some migrations, proper FK in `schema_full_fix.sql`. |
| `payroll_records.status` | CHECK defined in `schema.sql` but not in `schema_full_fix.sql`. |
| `audit_logs.record_id` | `TEXT` in `schema.sql`, `UUID` in `schema_full_fix.sql`. |
| `project_tasks.due_date` vs `end_date` | Final column depends on which migration executed first. |
| `project_tasks.id` default | `uuid_generate_v4()` vs `gen_random_uuid()` by file. |
| `project_tasks` trigger | No `updated_at` trigger defined. |
| Tax columns | Removed by `migration_v119_drop_tax.sql`. |

For new deployments, run migrations in the order listed in `README.md` and verify column presence after each step.

---

## 8. Seed Data

### Default Sectors

- رواتب — مصروفات الرواتب الشهرية
- إيجارات — إيجارات المكاتب والمستودعات
- مرافق — كهرباء، مياه، إنترنت، تليفون
- صيانة — صيانة المعدات والأجهزة
- تسويق — إعلانات وتسويق
- نثرية — مصروفات نثرية ومتنوعة

### Work Sections & Items

`import_work_sections_items.sql` seeds:

- Sections: `اعمال التراخيص`, `اعمال التصميم`, `اعمال الخرسانات`, `التشطيبات`, `اخرى`.
- ~50 work items such as `اعمال الحديد`, `اعمال الكهرباء(خ)`, `curtain wall`, `اعمال الرخام`, etc.

---

## 9. Backup Export Tables

The GitHub Actions backup and in-app backup export the following tables:

`clients`, `projects`, `employees`, `vendors`, `items`, `sectors`, `transactions`, `procurements`, `employee_transactions`, `employee_salary_history`, `custody_records`, `custody_expenses`, `attendance_records`, `payroll_records`, `work_sections`, `work_items`, `profiles`, `audit_logs`, `user_permissions`, `project_tasks`.
