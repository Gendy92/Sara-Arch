import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';

test.describe('custody-return', () => {
  const prefix = `e2e-custret-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('records a cash return and shows it in the custody ledger', async ({ page, api }) => {
    const empName = `${prefix}-موظف`;
    const { data: emp, error: empErr } = await api.client
      .from('employees')
      .insert({ name: empName, job_title: '_tester', salary: 5000, is_active: true })
      .select('id')
      .single();
    if (empErr) throw empErr;

    const today = new Date().toISOString().slice(0, 10);
    const { error: custodyErr } = await api.client
      .from('custody_records')
      .insert({
        custody_type: 'office',
        employee_id: emp.id,
        employee_name: empName,
        amount: 3000,
        date: today,
        status: 'active'
      });
    if (custodyErr) throw custodyErr;

    await page.goto('/#/office');
    await page.locator('#office-custody-tbl').waitFor();
    const row = page.locator('#office-custody-tbl tr', { hasText: empName });
    await row.locator('button:has-text("مصروفات")').click();

    // Record a spent expense first so there is remaining balance.
    await page.locator('button:has-text("➕ إضافة مصروف")').click();
    await page.locator('.modal-overlay input[name="amount"]').fill('1000');
    await page.locator('.modal-overlay input[name="date"]').fill(today);
    await page.locator('.modal-overlay button[type="submit"]:has-text("حفظ")').click();
    await page.locator('.modal-overlay').waitFor({ state: 'detached' });

    // Reopen the custody ledger and record a cash return.
    await row.locator('button:has-text("مصروفات")').click();
    await page.locator('button:has-text("💵 سداد باقي")').click();
    await page.locator('.modal-overlay input[name="amount"]').fill('500');
    await page.locator('.modal-overlay input[name="date"]').fill(today);
    await page.locator('.modal-overlay button[type="submit"]:has-text("حفظ")').click();

    // The modal should now contain both a spent row and a returned row.
    await expect(page.locator('.modal-overlay')).toContainText('مرتجع نقدي');
    await expect(page.locator('.modal-overlay')).toContainText('مصروف');
  });
});
