import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { VendorsPage } from '../../pages/vendors.page.js';

test.describe('vendors', () => {
  const prefix = `e2e-vend-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('adds a new vendor', async ({ page }) => {
    const vendorsPage = new VendorsPage(page);
    await vendorsPage.goto();
    await vendorsPage.addVendor([
      { name: `${prefix}-مورد`, vendor_type: 'service', sector: 'كهرباء', phone: '01005555555' }
    ]);

    await expect(page.locator('#vendors-tbl', { hasText: `${prefix}-مورد` })).toBeVisible();
  });
});
