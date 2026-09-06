import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { VendorsPage } from '../../pages/vendors.page.js';

test.describe('vendors', () => {
  const prefix = `e2e-vbal-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('vendor balance shows payment', async ({ page }) => {
    const vendorsPage = new VendorsPage(page);
    await vendorsPage.goto();
    await vendorsPage.addVendor([
      { name: `${prefix}-مورد`, vendor_type: 'service', sector: 'نجارة' }
    ]);

    await vendorsPage.openVendor(`${prefix}-مورد`);
    await vendorsPage.addPayment('12000');

    await vendorsPage.openVendor(`${prefix}-مورد`);
    await expect(page.locator('.kpi-card', { hasText: 'إجمالي المدفوع' }).locator('.kpi-value')).toContainText('12,000');
  });
});
