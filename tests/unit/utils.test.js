import { describe, it, expect } from 'vitest';

// js/utils.js assigns to window.Utils when window is present.
await import('../../js/utils.js');
const { Utils } = globalThis;

describe('Utils.esc', () => {
  it('escapes HTML special characters', () => {
    expect(Utils.esc('<script>alert("x")\'s</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&#39;s&lt;/script&gt;');
  });

  it('handles null/undefined as empty string', () => {
    expect(Utils.esc(null)).toBe('');
    expect(Utils.esc(undefined)).toBe('');
  });
});

describe('Utils.fmtMoney', () => {
  it('formats numbers with Arabic locale and currency', () => {
    expect(Utils.fmtMoney(1234.5)).toMatch(/١٬٢٣٤٫٥/);
    expect(Utils.fmtMoney(1234.5, 'EGP')).toMatch(/EGP$/);
  });

  it('falls back to 0 for invalid input', () => {
    expect(Utils.fmtMoney(null)).toMatch(/^٠/);
    expect(Utils.fmtMoney('abc')).toMatch(/^٠/);
  });
});

describe('Utils.clamp', () => {
  it('clamps values inside a range', () => {
    expect(Utils.clamp(5, 0, 10)).toBe(5);
    expect(Utils.clamp(-5, 0, 10)).toBe(0);
    expect(Utils.clamp(15, 0, 10)).toBe(10);
  });

  it('treats non-numeric input as 0', () => {
    expect(Utils.clamp('abc', 0, 10)).toBe(0);
  });
});

describe('Utils.isNonEmptyString', () => {
  it('identifies non-empty strings', () => {
    expect(Utils.isNonEmptyString('hello')).toBe(true);
    expect(Utils.isNonEmptyString('')).toBe(false);
    expect(Utils.isNonEmptyString('   ')).toBe(false);
    expect(Utils.isNonEmptyString(123)).toBe(false);
  });
});

describe('Utils.ilikeOr', () => {
  it('builds an OR ilike query', () => {
    const q = Utils.ilikeOr(['name', 'email'], 'sara');
    expect(q).toContain('name.ilike');
    expect(q).toContain('email.ilike');
    expect(q).toContain('*sara*');
  });

  it('returns empty string when term is missing', () => {
    expect(Utils.ilikeOr(['name'], '')).toBe('');
    expect(Utils.ilikeOr(['name'], null)).toBe('');
  });
});

describe('Utils.sleep', () => {
  it('waits the requested milliseconds', async () => {
    const start = Date.now();
    await Utils.sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });
});

describe('Utils.fmtDate', () => {
  it('formats ISO dates to Arabic locale', () => {
    expect(Utils.fmtDate('2024-05-15')).not.toBe('-');
  });

  it('returns dash for missing dates', () => {
    expect(Utils.fmtDate(null)).toBe('-');
    expect(Utils.fmtDate('')).toBe('-');
  });
});

describe('Utils.fmtTxType', () => {
  it('translates known transaction types', () => {
    expect(Utils.fmtTxType('project_deposit')).toBe('عربون مشروع');
    expect(Utils.fmtTxType('office_expense')).toBe('مصروف مكتبي');
  });

  it('returns the raw type for unknown values', () => {
    expect(Utils.fmtTxType('unknown_type')).toBe('unknown_type');
  });
});

describe('Utils.ilikeOr', () => {
  it('builds an or-ilike query for multiple fields', () => {
    const q = Utils.ilikeOr(['name', 'email'], 'sara');
    expect(q).toContain('or=');
    expect(q).toContain('name.ilike.');
    expect(q).toContain('email.ilike.');
  });

  it('returns empty string when term is empty', () => {
    expect(Utils.ilikeOr(['name'], '')).toBe('');
    expect(Utils.ilikeOr(['name'], null)).toBe('');
  });
});
