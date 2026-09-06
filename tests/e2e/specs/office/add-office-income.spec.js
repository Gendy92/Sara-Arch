import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { OfficePage } from '../../pages/office.page.js';

test.describe('office', () => {
  const prefix = `e2e-inc-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('records office income', async ({ page }) => {
    const officePage = new OfficePage(page);
    await officePage.goto();

    const today = new Date().toISOString().slice(0, 10);
    await officePage.addIncome([
      { amount: '15000', payment_method: 'cash', date: today, description: `${prefix}-إيراد` }
    ]);

    await expect(page.locator('text=تم حفظ 1 إيراد مكتبي')).toBeVisible();
  });
});
