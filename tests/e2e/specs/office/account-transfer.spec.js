import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { OfficePage } from '../../pages/office.page.js';

test.describe('office', () => {
  const prefix = `e2e-trf-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('records a cash to bank transfer', async ({ page }) => {
    const officePage = new OfficePage(page);
    await officePage.goto();

    const today = new Date().toISOString().slice(0, 10);
    await officePage.addTransfer({
      from_account: 'cash',
      to_account: 'bank',
      amount: '20000',
      date: today,
      description: `${prefix}-تحويل`
    });

    await expect(page.locator('text=تم التحويل')).toBeVisible();
  });
});
