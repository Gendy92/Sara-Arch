export async function loginAsAdmin(page, username, password) {
  await page.goto('/#/login');
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form[data-form="login"] button[type="submit"]').click();
  await page.locator('.kpi-grid').waitFor();
}
