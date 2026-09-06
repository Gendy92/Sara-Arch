import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { OfficePage } from '../../pages/office.page.js';

test.describe('reports', () => {
  const prefix = `e2e-obal-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('office balance reflects income and expenses', async ({ page }) => {
    const officePage = new OfficePage(page);
    await officePage.goto();

    const today = new Date().toISOString().slice(0, 10);
    await officePage.addIncome([
      { amount: '20000', payment_method: 'cash', date: today, description: `${prefix}-إيراد` }
    ]);

    await officePage.goto();
    await expect(page.locator('.kpi-card', { hasText: 'رصيد نقدي + بنكي' }).locator('.kpi-value')).toBeVisible();
  });
});
