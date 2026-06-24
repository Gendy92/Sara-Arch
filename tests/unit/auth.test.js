import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../js/auth.js');
});

describe('Auth.can', () => {
  it('allows admin every action', () => {
    const { Auth } = globalThis;
    Auth.user = { role: 'admin' };
    Auth.permissions = {};
    expect(Auth.can('clients', 'delete')).toBe(true);
    expect(Auth.can('settings', 'edit')).toBe(true);
  });

  it('denies non-admin when no permissions exist', () => {
    const { Auth } = globalThis;
    Auth.user = { role: 'user' };
    Auth.permissions = {};
    expect(Auth.can('clients', 'view')).toBe(false);
  });

  it('respects explicit permissions for non-admin', () => {
    const { Auth } = globalThis;
    Auth.user = { role: 'user' };
    Auth.permissions = {
      clients: { view: true, add: true, edit: false, delete: false }
    };
    expect(Auth.can('clients', 'view')).toBe(true);
    expect(Auth.can('clients', 'add')).toBe(true);
    expect(Auth.can('clients', 'delete')).toBe(false);
  });

  it('treats missing action as false', () => {
    const { Auth } = globalThis;
    Auth.user = { role: 'user' };
    Auth.permissions = { clients: { view: true } };
    expect(Auth.can('clients', 'edit')).toBe(false);
  });
});
