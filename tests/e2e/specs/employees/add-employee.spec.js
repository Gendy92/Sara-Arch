import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { EmployeesPage } from '../../pages/employees.page.js';

test.describe('employees', () => {
  const prefix = `e2e-emp-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('adds a new employee', async ({ page }) => {
    const employeesPage = new EmployeesPage(page);
    await employeesPage.goto();

    const today = new Date().toISOString().slice(0, 10);
    await employeesPage.addEmployee([
      { name: `${prefix}-موظف`, job_title: 'محاسب', hire_date: today }
    ]);

    await expect(page.locator('#emp-tbl', { hasText: `${prefix}-موظف` })).toBeVisible();
  });
});
