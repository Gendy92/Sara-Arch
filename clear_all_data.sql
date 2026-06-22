-- Factory Reset: Delete all operational/test data while preserving master data, users, and settings.
-- Run this in the Supabase SQL Editor when you want to start fresh.
-- WARNING: This cannot be undone. Make a backup first if you need the old data.

BEGIN;

-- Tasks linked to projects
DELETE FROM project_tasks;

-- Child transaction/expense tables
DELETE FROM procurements;
DELETE FROM transactions;
DELETE FROM custody_expenses;
DELETE FROM custody_records;

-- Employee/payroll tables
DELETE FROM payroll_records;
DELETE FROM attendance_records;
DELETE FROM employee_transactions;
DELETE FROM employee_salary_history;

-- Core operational entities
DELETE FROM projects;
DELETE FROM clients;
DELETE FROM vendors;
DELETE FROM employees;

COMMIT;

SELECT 'Operational data cleared. Master data, users, and settings are preserved.' AS status;
