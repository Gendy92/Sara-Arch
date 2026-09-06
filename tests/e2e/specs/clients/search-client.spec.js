import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { ClientsPage } from '../../pages/clients.page.js';

test.describe('clients', () => {
  const prefix = `e2e-search-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('searches for a client by name', async ({ page }) => {
    const clientsPage = new ClientsPage(page);
    await clientsPage.goto();
    await clientsPage.addClient([
      { name: `${prefix}-مستهدف`, phone: '01002222222' },
      { name: `${prefix}-آخر`, phone: '01003333333' }
    ]);

    await clientsPage.search('مستهدف');

    await expect(page.locator('.client-card', { hasText: `${prefix}-مستهدف` })).toBeVisible();
    await expect(page.locator('.client-card', { hasText: `${prefix}-آخر` })).toHaveCount(0);
  });
});
