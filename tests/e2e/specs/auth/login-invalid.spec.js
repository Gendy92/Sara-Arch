import { test, expect } from '../../fixtures/base.js';
import { LoginPage } from '../../pages/login.page.js';

test('invalid login shows error toast', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login('e2e-admin', 'wrong-password-12345');
  await login.expectError();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});
