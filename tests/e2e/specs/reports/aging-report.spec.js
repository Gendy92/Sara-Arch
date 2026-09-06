import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { ReportsPage } from '../../pages/reports.page.js';

test.describe('aging-report', () => {
  const prefix = `e2e-aging-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('shows client A/R and vendor A/P buckets', async ({ page, api }) => {
    const clientName = `${prefix}-عميل`;
    const projectName = `${prefix}-مشروع`;
    const vendorName = `${prefix}-مورد`;
    const today = new Date().toISOString().slice(0, 10);

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

    // Client owes: expense exceeds deposit
    await api.client.from('transactions').insert({
      type: 'project_expense',
      amount: 15000,
      paid_amount: 15000,
      payment_method: 'cash',
      client_id: client.id,
      project_id: project.id,
      project_name: projectName,
      party_id: client.id,
      party_name: clientName,
      party_type: 'client',
      date: today,
      description: `${prefix} expense`
    });

    const { data: vendor, error: vendorErr } = await api.client
      .from('vendors')
      .insert({ name: vendorName, vendor_type: 'service', is_office: false })
      .select('id')
      .single();
    if (vendorErr) throw vendorErr;

    await api.client.from('procurements').insert({
      project_id: project.id,
      project_name: projectName,
      vendor_id: vendor.id,
      vendor_name: vendorName,
      quantity: 1,
      unit_price: 5000,
      payment_term: 'credit',
      paid_amount: 0,
      date: today,
      notes: `${prefix} procurement`
    });

    const reports = new ReportsPage(page);
    await reports.goto();
    await reports.switchTab('aging');

    await expect(page.locator('#reports-content')).toContainText('مستحقات العملاء (A/R)');
    await expect(page.locator('#reports-content')).toContainText(clientName);
    await expect(page.locator('#reports-content')).toContainText('مستحقات الموردين (A/P)');
    await expect(page.locator('#reports-content')).toContainText(vendorName);
  });
});
