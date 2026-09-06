import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

beforeAll(async () => {
  globalThis.SUPABASE_URL = 'https://example.supabase.co';
  globalThis.SUPABASE_ANON_KEY = 'test-anon-key';
  globalThis.SARA_EMAIL_DOMAIN = 'example.com';
  globalThis.PERF_LOG = false;
  globalThis.SARA_MODE = 'production';

  await import('../../js/utils.js');
  await import('../../js/ui.js');
});

async function getService() {
  vi.resetModules();
  await import('../../js/notification-service.js');
  return globalThis.NotificationService;
}

describe('NotificationService.requestPermission', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete globalThis.Notification;
  });

  it('returns granted when permission is already granted', async () => {
    globalThis.Notification = { permission: 'granted' };
    const svc = await getService();
    await expect(svc.requestPermission()).resolves.toBe('granted');
  });

  it('returns denied when permission is already denied', async () => {
    globalThis.Notification = { permission: 'denied' };
    const svc = await getService();
    await expect(svc.requestPermission()).resolves.toBe('denied');
  });

  it('returns unsupported when Notification API is missing', async () => {
    const svc = await getService();
    await expect(svc.requestPermission()).resolves.toBe('unsupported');
  });

  it('delegates to Notification.requestPermission for default state', async () => {
    globalThis.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted')
    };
    const svc = await getService();
    await expect(svc.requestPermission()).resolves.toBe('granted');
    expect(globalThis.Notification.requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationService.show', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete globalThis.Notification;
    globalThis.UI.toast = vi.fn();
  });

  it('shows a native notification when permission is granted', async () => {
    const mockNotification = vi.fn();
    globalThis.Notification = function (title, opts) {
      mockNotification(title, opts);
      return { title, opts };
    };
    globalThis.Notification.permission = 'granted';

    const svc = await getService();
    const result = await svc.show('Reminder', { body: 'deadline soon' });
    expect(mockNotification).toHaveBeenCalledWith('Reminder', expect.objectContaining({ body: 'deadline soon' }));
    expect(result).toBeTruthy();
    expect(globalThis.UI.toast).not.toHaveBeenCalled();
  });

  it('falls back to UI.toast when permission is denied', async () => {
    globalThis.Notification = { permission: 'denied' };
    const svc = await getService();
    await svc.show('Reminder', { body: 'deadline soon' });
    expect(globalThis.UI.toast).toHaveBeenCalledWith('Reminder — deadline soon', 'info');
  });

  it('falls back to UI.toast when Notification API is unsupported', async () => {
    const svc = await getService();
    await svc.show('Reminder');
    expect(globalThis.UI.toast).toHaveBeenCalledWith('Reminder', 'info');
  });

  it('uses severity option in toast fallback', async () => {
    globalThis.Notification = { permission: 'denied' };
    const svc = await getService();
    await svc.show('Alert', { body: 'low balance', severity: 'warning' });
    expect(globalThis.UI.toast).toHaveBeenCalledWith('Alert — low balance', 'warning');
  });
});

describe('NotificationService.schedule and cancel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    delete globalThis.Notification;
    globalThis.UI.toast = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast after the scheduled delay', async () => {
    const svc = await getService();
    svc.schedule({ tag: 't1', title: 'Due', body: 'pay vendor', delay: 5000 });
    expect(globalThis.UI.toast).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(globalThis.UI.toast).toHaveBeenCalledWith('Due — pay vendor', 'info');
  });

  it('cancelling a scheduled notification prevents it from showing', async () => {
    const svc = await getService();
    svc.schedule({ tag: 't2', title: 'Due', delay: 1000 });
    svc.cancel('t2');
    vi.advanceTimersByTime(1000);
    expect(globalThis.UI.toast).not.toHaveBeenCalled();
  });

  it('rescheduling with the same tag replaces the previous timer', async () => {
    const svc = await getService();
    svc.schedule({ tag: 't3', title: 'First', delay: 1000 });
    svc.schedule({ tag: 't3', title: 'Second', delay: 2000 });
    vi.advanceTimersByTime(1000);
    expect(globalThis.UI.toast).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(globalThis.UI.toast).toHaveBeenCalledWith('Second', 'info');
  });

  it('cancelAll clears every scheduled notification', async () => {
    const svc = await getService();
    svc.schedule({ tag: 'a', title: 'A', delay: 1000 });
    svc.schedule({ tag: 'b', title: 'B', delay: 2000 });
    svc.cancelAll();
    vi.advanceTimersByTime(2000);
    expect(globalThis.UI.toast).not.toHaveBeenCalled();
  });
});
