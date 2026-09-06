import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { VendorsPage } from '../../pages/vendors.page.js';

test.describe('vendors', () => {
  const prefix = `e2e-vpay-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('records a vendor payment', async ({ page }) => {
    const vendorsPage = new VendorsPage(page);
    await vendorsPage.goto();
    await vendorsPage.addVendor([
      { name: `${prefix}-مورد`, vendor_type: 'service', sector: 'سباكة' }
    ]);

    await vendorsPage.openVendor(`${prefix}-مورد`);
    await vendorsPage.addPayment('5000');

    await expect(page.locator('text=تم تسجيل الدفع للمورد')).toBeVisible();
  });
});
