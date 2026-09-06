export async function goTo(page, screen) {
  await page.goto(`/#/${screen}`);
  await Promise.race([
    page.locator('.main-content').waitFor().catch(() => null),
    page.locator('#app').waitFor().catch(() => null)
  ]);
  await page.waitForTimeout(300);
}
