import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { EmployeeTransactionsPage } from '../../pages/employee-transactions.page.js';

test.describe('employee-transactions-screen', () => {
  const prefix = `e2e-emptx-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('adds a bonus and filters by type', async ({ page, api }) => {
    const empName = `${prefix}-موظف`;
    const { data: emp, error } = await api.client
      .from('employees')
      .insert({ name: empName, job_title: '_tester', salary: 5000, is_active: true })
      .select('id')
      .single();
    if (error) throw error;

    const txPage = new EmployeeTransactionsPage(page);
    await txPage.goto();
    await txPage.addTransaction({
      employee_id: emp.id,
      type: 'bonus',
      amount: '1500',
      date: new Date().toISOString().slice(0, 10),
      notes: `${prefix} bonus`
    });

    await expect(page.locator('#emp-tx-standalone-tbl')).toContainText(empName);
    await expect(page.locator('#emp-tx-standalone-tbl')).toContainText('مكافأة');

    await txPage.filterByType('penalty');
    await expect(page.locator('#emp-tx-standalone-tbl')).not.toContainText('مكافأة');
  });
});
