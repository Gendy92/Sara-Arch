import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { EmployeesPage } from '../../pages/employees.page.js';
import { OfficePage } from '../../pages/office.page.js';

test.describe('employees', () => {
  const prefix = `e2e-cexp-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('records an office custody expense', async ({ page, api }) => {
    const employeesPage = new EmployeesPage(page);
    await employeesPage.goto();

    const today = new Date().toISOString().slice(0, 10);
    await employeesPage.addEmployee([
      { name: `${prefix}-موظف`, job_title: 'فني', hire_date: today }
    ]);

    const employee = await api.getEmployeeByName(`${prefix}-موظف`);
    const sectorId = await api.ensureSector(`${prefix}-تصنيف`);

    const officePage = new OfficePage(page);
    await officePage.goto();
    await officePage.addCustody([
      { employee_id: employee.id, amount: '10000', payment_method: 'cash', date: today }
    ]);

    const custody = await api.getCustodyByEmployee(employee.id);
    await officePage.addCustodyExpense(custody.id, sectorId, '3000');
    await expect(page.locator('text=تم حفظ 1 مصروف عهدة مكتبي')).toBeVisible();
  });
});
