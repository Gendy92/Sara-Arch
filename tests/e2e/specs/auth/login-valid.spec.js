import { test, expect } from '../../fixtures/base.js';
import { LoginPage } from '../../pages/login.page.js';
import { DashboardPage } from '../../pages/dashboard.page.js';

test('valid admin login reaches dashboard', async ({ page, adminUser }) => {
  const login = new LoginPage(page);
  const dashboard = new DashboardPage(page);

  await login.goto();
  await login.login(adminUser.username, adminUser.password);
  await dashboard.waitForLoaded();

  await expect(page.locator('text=لوحة التحكم')).toBeVisible();
});
