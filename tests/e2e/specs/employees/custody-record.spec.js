import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { EmployeesPage } from '../../pages/employees.page.js';
import { OfficePage } from '../../pages/office.page.js';

test.describe('employees', () => {
  const prefix = `e2e-cust-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('creates a custody record for an employee', async ({ page, api }) => {
    const employeesPage = new EmployeesPage(page);
    await employeesPage.goto();

    const today = new Date().toISOString().slice(0, 10);
    await employeesPage.addEmployee([
      { name: `${prefix}-موظف`, job_title: 'مهندس', hire_date: today }
    ]);

    const employee = await api.getEmployeeByName(`${prefix}-موظف`);

    const officePage = new OfficePage(page);
    await officePage.goto();
    await officePage.addCustody([
      { employee_id: employee.id, amount: '10000', payment_method: 'cash', date: today, notes: `${prefix}-عهدة` }
    ]);

    await expect(page.locator('text=تم حفظ 1 عهدة')).toBeVisible();
  });
});
