import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { ClientsPage } from '../../pages/clients.page.js';
import { ProjectsPage } from '../../pages/projects.page.js';

test.describe('projects', () => {
  const prefix = `e2e-proj-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('adds a new project for a client', async ({ page }) => {
    const clientsPage = new ClientsPage(page);
    const projectsPage = new ProjectsPage(page);

    await clientsPage.goto();
    await clientsPage.addClient([{ name: `${prefix}-عميل`, phone: '01000000000' }]);

    await projectsPage.gotoClient(`${prefix}-عميل`);
    await projectsPage.addProject(`${prefix}-عميل`, [
      { name: `${prefix}-مشروع`, value: '100000', status: 'active' }
    ]);

    await expect(page.locator(`a:has-text("${prefix}-مشروع")`).first()).toBeVisible();
  });
});
