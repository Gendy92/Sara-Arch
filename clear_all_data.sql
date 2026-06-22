-- Factory Reset: Delete all business data while preserving schema, admin users, and tenants.
-- Run this in the Supabase SQL Editor when you want to clear test data and start fresh.
-- WARNING: This cannot be undone. Make sure you have a backup first if you need the old data.

BEGIN;

-- Child / transaction tables first
DELETE FROM audit_logs;
DELETE FROM custody_expenses;
DELETE FROM custody_records;
DELETE FROM payroll_records;
DELETE FROM attendance_records;
DELETE FROM employee_transactions;
DELETE FROM employee_salary_history;
DELETE FROM procurements;
DELETE FROM transactions;
DELETE FROM project_tasks;

-- Core entity tables
DELETE FROM projects;
DELETE FROM clients;
DELETE FROM employees;
DELETE FROM vendors;
DELETE FROM work_items;
DELETE FROM work_sections;
DELETE FROM items;
DELETE FROM sectors;

-- Permissions (keeps admin access via profiles.role = 'admin')
DELETE FROM user_permissions;

-- Optional: reset app settings to defaults (uncomment if you want a completely clean start)
-- DELETE FROM app_settings;

COMMIT;

-- Recompute any remaining custody state (should be empty after delete)
SELECT 'All business data cleared. You can now start entering real data.' AS status;
