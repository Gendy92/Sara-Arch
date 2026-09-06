import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { fillModal, submitModal } from '../../helpers/forms.js';
import { ClientsPage } from '../../pages/clients.page.js';

test.describe('clients', () => {
  const prefix = `e2e-edit-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('edits an existing client', async ({ page }) => {
    const clientsPage = new ClientsPage(page);
    await clientsPage.goto();
    await clientsPage.addClient([{ name: `${prefix}-old`, phone: '01000000000' }]);

    await clientsPage.openEditForClient(`${prefix}-old`);
    await fillModal(page, { name: `${prefix}-new`, phone: '01001111111' });
    await submitModal(page);

    await expect(page.locator('.client-card', { hasText: `${prefix}-new` })).toBeVisible();
  });
});
