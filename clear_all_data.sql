-- Factory Reset: Delete all operational/test data while preserving master data, users, and settings.
-- Run this in the Supabase SQL Editor when you want to start fresh.
-- WARNING: This cannot be undone. Make a backup first if you need the old data.

BEGIN;

-- Tasks linked to projects
DELETE FROM project_tasks;

-- Employee/payroll tables (must be before transactions because payroll_records.office_expense_id references transactions.id)
DELETE FROM payroll_records;
DELETE FROM attendance_records;
DELETE FROM employee_transactions;
DELETE FROM employee_salary_history;

-- Child transaction/expense tables
DELETE FROM procurements;
DELETE FROM custody_expenses;
DELETE FROM custody_records;
DELETE FROM transactions;

-- Core operational entities
DELETE FROM projects;
DELETE FROM clients;
DELETE FROM vendors;
DELETE FROM employees;

COMMIT;

SELECT 'Operational data cleared. Master data, users, and settings are preserved.' AS status;
