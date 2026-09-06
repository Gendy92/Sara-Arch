import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { ReportsPage } from '../../pages/reports.page.js';

test.describe('reports-screen', () => {
  const prefix = `e2e-rep-${Date.now()}`;

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    await api.cleanupByPrefix(prefix);
  });

  test('loads P&L and office tabs with data', async ({ page, api }) => {
    const clientName = `${prefix}-عميل`;
    const projectName = `${prefix}-مشروع`;
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

    await api.client.from('transactions').insert({
      type: 'project_deposit',
      amount: 20000,
      paid_amount: 20000,
      payment_method: 'cash',
      client_id: client.id,
      project_id: project.id,
      project_name: projectName,
      party_id: client.id,
      party_name: clientName,
      party_type: 'client',
      date: today,
      description: `${prefix} deposit`
    });

    const reports = new ReportsPage(page);
    await reports.goto();

    // P&L tab is default
    await expect(page.locator('#reports-content')).toContainText(projectName);
    await expect(page.locator('#reports-content')).toContainText('إجمالي الربح الصافي');

    await reports.switchTab('office');
    await expect(page.locator('#reports-content')).toContainText('الرصيد النقدي');

    await reports.switchTab('cashflow');
    await expect(page.locator('#reports-content')).toContainText('إجمالي الإيرادات');
  });
});
