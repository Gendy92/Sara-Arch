import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { ClientsPage } from '../../pages/clients.page.js';
import { ProjectsPage } from '../../pages/projects.page.js';

test.describe('projects', () => {
  const prefix = `e2e-stmt-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('opens project statement', async ({ page, api }) => {
    const clientsPage = new ClientsPage(page);
    const projectsPage = new ProjectsPage(page);

    await clientsPage.goto();
    await clientsPage.addClient([{ name: `${prefix}-عميل`, phone: '01000000000' }]);

    await projectsPage.gotoClient(`${prefix}-عميل`);
    await projectsPage.addProject(`${prefix}-عميل`, [
      { name: `${prefix}-مشروع`, value: '500000', status: 'active' }
    ]);

    const client = await api.getClientByName(`${prefix}-عميل`);
    const project = await api.getProjectByName(`${prefix}-مشروع`);
    const today = new Date().toISOString().slice(0, 10);

    await projectsPage.addDeposit([
      { client_id: client.id, project_id: project.id, amount: '50000', payment_method: 'cash', date: today }
    ]);

    await projectsPage.openProject(`${prefix}-مشروع`);
    await projectsPage.openStatement();

    await expect(page.locator('.modal-overlay', { hasText: 'كشف حساب' })).toBeVisible();
  });
});
