import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  // Provide the globals that the browser normally loads from config.js.
  globalThis.SUPABASE_URL = 'https://example.supabase.co';
  globalThis.SUPABASE_ANON_KEY = 'test-anon-key';
  globalThis.SARA_EMAIL_DOMAIN = 'example.com';
  globalThis.PERF_LOG = false;
  globalThis.SARA_MODE = 'production';

  await import('../../js/utils.js');
  await import('../../js/api.js');
  await import('../../js/auth.js');
  await import('../../js/ui.js');
  await import('../../js/app-core.js');
  await import('../../js/crud.js');
  // Prime a minimal auth user so Crud._currentUserName() does not fail.
  globalThis.Auth.user = { email: 'admin@example.com', displayName: 'Admin', role: 'admin' };
});

describe('Crud._assertNonNegative', () => {
  it('allows zero and positive financial values', () => {
    const { Crud } = globalThis;
    expect(() => Crud._assertNonNegative({ amount: 0, paid_amount: 100 })).not.toThrow();
    expect(() => Crud._assertNonNegative({ quantity: 5, unit_price: 12.5 })).not.toThrow();
  });

  it('throws on negative financial values', () => {
    const { Crud } = globalThis;
    expect(() => Crud._assertNonNegative({ amount: -1 })).toThrow('لا يمكن أن تكون القيمة سالبة');
    expect(() => Crud._assertNonNegative([{ paid_amount: -50 }])).toThrow('لا يمكن أن تكون القيمة سالبة');
  });

  it('ignores non-financial keys', () => {
    const { Crud } = globalThis;
    expect(() => Crud._assertNonNegative({ description: 'test', name: -5 })).not.toThrow();
  });
});

describe('Crud.save paid-amount guard', () => {
  it('blocks transactions where paid_amount exceeds amount', async () => {
    const { Crud } = globalThis;
    await expect(Crud.save('transactions', { type: 'project_deposit', amount: 1000, paid_amount: 1200 }))
      .rejects.toThrow('المبلغ المدفوع أكبر من إجمالي المبلغ');
  });

  it('allows vendor_settlement even though amount is zero', async () => {
    const { Crud } = globalThis;
    // This will fail at the network layer because we have no real session,
    // but it must NOT fail with the paid>amount guard.
    await expect(Crud.save('transactions', { type: 'vendor_settlement', amount: 0, paid_amount: 500 }))
      .rejects.not.toThrow('المبلغ المدفوع أكبر من إجمالي المبلغ');
  });

  it('blocks procurements where paid_amount exceeds total', async () => {
    const { Crud } = globalThis;
    await expect(Crud.save('procurements', { quantity: 2, unit_price: 100, paid_amount: 250 }))
      .rejects.toThrow('المبلغ المدفوع أكبر من إجمالي المشتريات');
  });
});

describe('Crud.emailNewPassword', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.UI.toast = vi.fn();
    globalThis.UI.confirm = vi.fn((_msg, onYes) => { if (onYes) onYes(); });
  });

  it('rejects an invalid email with an error toast', async () => {
    const { Crud } = globalThis;
    await Crud.emailNewPassword('user-id', 'not-an-email');
    expect(globalThis.UI.toast).toHaveBeenCalledWith('لا يوجد بريد إلكتروني صالح لهذا المستخدم', 'error');
  });

  it('shows success toast when the RPC returns success', async () => {
    const { Crud } = globalThis;
    globalThis.API.rpc = vi.fn().mockResolvedValue({ success: true, request_id: 123 });
    await Crud.emailNewPassword('user-id', 'user@example.com');
    expect(globalThis.API.rpc).toHaveBeenCalledWith('admin_reset_password_email', { p_user_id: 'user-id', p_email: 'user@example.com' });
    expect(globalThis.UI.toast).toHaveBeenCalledWith('تم إرسال كلمة المرور الجديدة إلى البريد الإلكتروني');
  });

  it('shows the RPC error when the call fails', async () => {
    const { Crud } = globalThis;
    globalThis.API.rpc = vi.fn().mockResolvedValue({ success: false, error: 'Domain not verified' });
    await Crud.emailNewPassword('user-id', 'user@example.com');
    expect(globalThis.UI.toast).toHaveBeenCalledWith('Domain not verified', 'error');
  });

  it('shows a generic error toast when the RPC throws', async () => {
    const { Crud } = globalThis;
    globalThis.API.rpc = vi.fn().mockRejectedValue(new Error('Network failure'));
    await Crud.emailNewPassword('user-id', 'user@example.com');
    expect(globalThis.UI.toast).toHaveBeenCalledWith('Network failure', 'error');
  });
});
