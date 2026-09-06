import { test, expect } from '../../fixtures/base.js';
import { loginAsAdmin } from '../../helpers/login.js';

test.describe('offline sync', () => {
  test('queues a mutation while offline and replays it when online', async ({ page, adminUser, api }) => {
    const prefix = `e2e-sync-${Date.now()}`;
    const clientName = prefix;

    await loginAsAdmin(page, adminUser.username, adminUser.password);

    // Go offline and try to create a client through the sync-aware API wrapper.
    await page.setOfflineMode(true);
    const queued = await page.evaluate(async (name) => {
      try {
        await SyncManager.api('clients', 'POST', { name });
        return { queued: false, reason: 'no error' };
      } catch (e) {
        return {
          queued: true,
          reason: e.message,
          pendingCount: await SyncManager.pendingCount()
        };
      }
    }, clientName);

    expect(queued.queued).toBe(true);
    expect(queued.pendingCount).toBe(1);

    // The sync indicator should reflect the pending mutation.
    await expect(page.locator('#sync-text')).toHaveText(/1 عملية معلقة/);

    // Restore connectivity and replay the queue.
    await page.setOfflineMode(false);
    const replay = await page.evaluate(() => SyncManager.replay());
    expect(replay.succeeded).toBe(1);
    expect(replay.failed).toBe(0);

    // The indicator should switch back to the synced state.
    await expect(page.locator('#sync-text')).toHaveText(/تمت المزامنة/);

    // Verify the client was actually created on the server.
    const client = await api.getClientByName(clientName);
    expect(client).not.toBeNull();
    expect(client.name).toBe(clientName);

    await api.cleanupByPrefix(prefix);
  });

  test('updates last sync timestamp after successful replay', async ({ page, adminUser, api }) => {
    const prefix = `e2e-sync-ls-${Date.now()}`;
    const clientName = prefix;

    await loginAsAdmin(page, adminUser.username, adminUser.password);

    await page.setOfflineMode(true);
    await page.evaluate(async (name) => {
      try { await SyncManager.api('clients', 'POST', { name }); } catch (e) { /* expected */ }
    }, clientName);

    const before = await page.evaluate(() => SyncManager.getLastSync());

    await page.setOfflineMode(false);
    await page.evaluate(() => SyncManager.replay());

    const after = await page.evaluate(() => SyncManager.getLastSync());
    expect(after).toBeGreaterThan(before || 0);

    await api.cleanupByPrefix(prefix);
  });

  test.afterEach(async ({ page }) => {
    // Leave the page online for subsequent tests.
    await page.setOfflineMode(false);
  });
});
