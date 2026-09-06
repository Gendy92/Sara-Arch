import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { OfficePage } from '../../pages/office.page.js';

test.describe('office', () => {
  const prefix = `e2e-offexp-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser, api }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
    await api.ensureSector(`${prefix}-تصنيف`);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('records office expense', async ({ page, api }) => {
    const officePage = new OfficePage(page);
    await officePage.goto();

    const sectorId = await api.ensureSector(`${prefix}-تصنيف`);
    const today = new Date().toISOString().slice(0, 10);

    await officePage.addExpense([
      { sector_id: sectorId, amount: '8000', payment_method: 'cash', date: today, description: `${prefix}-مصروف` }
    ]);

    await expect(page.locator('text=تم حفظ 1 مصروف مكتبي')).toBeVisible();
  });
});
