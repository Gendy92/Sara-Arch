import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';

test.describe('invoices', () => {
  const prefix = `e2e-inv-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('creates an invoice and records payment', async ({ page, api }) => {
    const clientName = `${prefix}-عميل`;
    const projectName = `${prefix}-مشروع`;

    const { data: client, error: clientErr } = await api.client
      .from('clients')
      .insert({ name: clientName })
      .select('id')
      .single();
    if (clientErr) throw clientErr;

    const { data: project, error: projectErr } = await api.client
      .from('projects')
      .insert({ name: projectName, client_id: client.id, client_name: clientName, value: 100000, status: 'active' })
      .select('id')
      .single();
    if (projectErr) throw projectErr;

    await page.goto('/#/invoices');
    await page.locator('#invoices-tbl').waitFor();

    await page.locator('button:has-text("+ إنشاء فاتورة")').click();
    await page.locator('.modal-overlay').waitFor();

    const invoiceNumber = `${prefix}-001`;
    await page.locator('[name="invoice_number"]').fill(invoiceNumber);
    await page.locator('[name="client_id"]').selectOption(client.id);
    // Wait for project cascade to populate
    await page.waitForTimeout(200);
    await page.locator('[name="project_id"]').selectOption(project.id);
    await page.locator('[name="issue_date"]').fill('2026-07-01');
    await page.locator('[name="due_date"]').fill('2026-07-15');
    await page.locator('[name="status"]').selectOption('sent');

    // Fill first item
    await page.locator('[name="item_desc[]"]').first().fill('بند أعمال تشطيب');
    await page.locator('[name="item_qty[]"]').first().fill('2');
    await page.locator('[name="item_price[]"]').first().fill('5000');

    await page.locator('.modal-overlay button[type="submit"]').click();
    await expect(page.locator('#invoices-tbl')).toContainText(invoiceNumber);
    await expect(page.locator('#invoices-tbl')).toContainText('10,000');

    // Mark as paid
    await page.locator('#invoices-tbl button:has-text("دفع")').first().click();
    await page.locator('.modal-overlay').waitFor();
    await page.locator('.modal-overlay button[type="submit"]').click();
    await expect(page.locator('#invoices-tbl')).toContainText('مدفوعة');
  });
});
