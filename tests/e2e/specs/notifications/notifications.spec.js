import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';
import { NotificationsPage } from '../../pages/notifications.page.js';

test.describe('notifications', () => {
  const prefix = `e2e-notif-${Date.now()}`;
  let notificationIds = [];

  test.beforeEach(async ({ page, adminUser }) => {
    await loginAsAdmin(page, adminUser.username, adminUser.password);
  });

  test.afterEach(async ({ api }) => {
    if (notificationIds.length) {
      await api.client.from('notifications').delete().in('id', notificationIds);
      notificationIds = [];
    }
  });

  test('bell badge shows unread notification and mark read clears it', async ({ page, adminUser, api, tenantId }) => {
    const notifications = new NotificationsPage(page);

    // Seed an unread system notification via the API.
    const { data, error } = await api.client
      .from('notifications')
      .insert({
        user_id: adminUser.userId,
        tenant_id: tenantId,
        type: 'system',
        title: `${prefix} test title`,
        message: 'E2E notification message',
        severity: 'info'
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    notificationIds.push(data.id);

    // Reload so the app re-fetches the notification count.
    await page.reload();
    await page.locator('.kpi-grid').waitFor();

    const badge = notifications.getBellBadge();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');

    await notifications.openBellDropdown();
    await expect(page.locator('#notification-dropdown', { hasText: `${prefix} test title` })).toBeVisible();

    await notifications.markFirstReadInDropdown();
    await expect(badge).toBeHidden();
  });

  test('notifications screen supports archive filter', async ({ page, adminUser, api, tenantId }) => {
    const notifications = new NotificationsPage(page);

    const { data, error } = await api.client
      .from('notifications')
      .insert({
        user_id: adminUser.userId,
        tenant_id: tenantId,
        type: 'system',
        title: `${prefix} archive test`,
        message: 'archive me',
        severity: 'info'
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    notificationIds.push(data.id);

    await notifications.goto();
    await expect(page.locator('#notifications-tbl', { hasText: `${prefix} archive test` })).toBeVisible();

    await notifications.archiveFirst();
    await expect(page.locator('#notifications-tbl', { hasText: `${prefix} archive test` })).toBeHidden();

    await notifications.setFilter('archived');
    await expect(page.locator('#notifications-tbl', { hasText: `${prefix} archive test` })).toBeVisible();
  });
});
