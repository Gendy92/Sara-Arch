import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { ClientsPage } from '../../pages/clients.page.js';

test.describe('clients', () => {
  const prefix = `e2e-client-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('adds a new client via spreadsheet', async ({ page }) => {
    const clientsPage = new ClientsPage(page);
    await clientsPage.goto();
    await clientsPage.addClient([
      { name: `${prefix}-أحمد`, phone: '01001234567', address: 'القاهرة' }
    ]);

    await expect(page.locator('.client-card', { hasText: `${prefix}-أحمد` })).toBeVisible();
  });
});
