-- v293: Add commonly-used indexes to speed up list/filter queries.
-- These cover the hot paths used by the dashboard, vendor/client/project lists,
-- and pagination screens. All statements are idempotent.

-- Clients / Projects
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;

-- Transactions (the busiest table)
CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON public.transactions(type, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON public.transactions(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON public.transactions(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_id ON public.transactions(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_type_vendor ON public.transactions(type, vendor_id) WHERE deleted_at IS NULL;

-- Procurements
CREATE INDEX IF NOT EXISTS idx_procurements_vendor_id ON public.procurements(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_procurements_project_id ON public.procurements(project_id) WHERE deleted_at IS NULL;

-- Employee module
CREATE INDEX IF NOT EXISTS idx_employee_transactions_employee_id ON public.employee_transactions(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_salary_history_employee_id ON public.employee_salary_history(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON public.payroll_records(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id ON public.attendance_records(employee_id) WHERE deleted_at IS NULL;

-- Custody
CREATE INDEX IF NOT EXISTS idx_custody_records_employee_id ON public.custody_records(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_custody_expenses_custody_id ON public.custody_expenses(custody_id) WHERE deleted_at IS NULL;

-- Audit / app errors
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_created ON public.audit_logs(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_created_at ON public.app_errors(created_at DESC);
