import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { UsersPage } from '../../pages/users.page.js';

test.describe('admin', () => {
  const prefix = `e2e-user-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test('adds a new user from the users screen', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await usersPage.addUser([
      { username: `${prefix}-tester`, name: 'E2E Tester', password: 'Password123', role: 'user' }
    ]);

    await expect(page.locator('#users-tbl', { hasText: `${prefix}-tester` })).toBeVisible();
  });
});
