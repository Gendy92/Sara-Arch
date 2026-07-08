import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  globalThis.SARA_EMAIL_DOMAIN = 'gendy92.github.io';
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

  it('strips the configured email domain from usernames', () => {
    const { Auth } = globalThis;
    expect(Auth.fromEmail('ahmed@gendy92.github.io')).toBe('ahmed');
    expect(Auth.fromEmail('ahmed@sara-arch.local')).toBe('ahmed');
    expect(Auth.fromEmail('ahmed@local')).toBe('ahmed');
  });

  it('falls back to the raw email when no known domain suffix is present', () => {
    const { Auth } = globalThis;
    expect(Auth.fromEmail('ahmed@example.com')).toBe('ahmed@example.com');
  });

  it('returns safe names, falling back when empty or suspicious', () => {
    const { Auth } = globalThis;
    expect(Auth.safeName('', 'fallback')).toBe('fallback');
    expect(Auth.safeName('bad?name', 'fallback')).toBe('fallback');
    expect(Auth.safeName('Good Name', 'fallback')).toBe('Good Name');
  });
});
