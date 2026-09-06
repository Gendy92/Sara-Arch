import { describe, it, expect } from 'vitest';

// Ensure WebCrypto is available in the jsdom test environment.
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}

// jsdom ships an older Blob without arrayBuffer() — polyfill for tests only
// (Electron/Chromium and Node ≥18 provide it natively).
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// js/crypto-vault.js assigns to window.CryptoVault when window is present.
await import('../../js/crypto-vault.js');
const { CryptoVault } = globalThis;

describe('CryptoVault roundtrip', () => {
  it('encrypts and decrypts a blob with the correct password', async () => {
    const original = new Blob(['{"clients":[{"id":1,"name":"سارة"}]}'], { type: 'application/zip' });
    const encrypted = await CryptoVault.encryptBlob(original, 'secret-password');
    expect(encrypted.size).toBeGreaterThan(original.size);

    const decrypted = await CryptoVault.decryptFile(encrypted, 'secret-password');
    const asText = async b => new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()));
    expect(await asText(decrypted)).toBe(await asText(original));
  });

  it('rejects a wrong password', async () => {
    const encrypted = await CryptoVault.encryptBlob(new Blob(['data']), 'right-password');
    await expect(CryptoVault.decryptFile(encrypted, 'wrong-password'))
      .rejects.toThrow('كلمة المرور غير صحيحة أو الملف تالف');
  });

  it('rejects a file without the SARAENC1 magic header', async () => {
    // Longer than the minimum-length guard so it reaches the magic check.
    const notEncrypted = new Blob(['x'.repeat(80)]);
    await expect(CryptoVault.decryptFile(notEncrypted, 'any'))
      .rejects.toThrow('هذا ليس ملف نسخة مشفرة صالح');
  });

  it('rejects a truncated/corrupted file', async () => {
    const encrypted = await CryptoVault.encryptBlob(new Blob(['data']), 'pw123456');
    const buf = new Uint8Array(await encrypted.arrayBuffer());
    const corrupted = new Blob([buf.slice(0, buf.length - 5)]);
    await expect(CryptoVault.decryptFile(corrupted, 'pw123456')).rejects.toThrow();
  });

  it('produces different ciphertext for the same input (random salt+iv)', async () => {
    const blob = new Blob(['same data']);
    const a = new Uint8Array(await (await CryptoVault.encryptBlob(blob, 'pw123456')).arrayBuffer());
    const b = new Uint8Array(await (await CryptoVault.encryptBlob(blob, 'pw123456')).arrayBuffer());
    expect(Buffer.from(a.slice(36)).equals(Buffer.from(b.slice(36)))).toBe(false);
  });
});

describe('CryptoVault.isEncryptedFile', () => {
  it('detects .saraenc files by name', () => {
    expect(CryptoVault.isEncryptedFile({ name: 'backup.saraenc' })).toBe(true);
    expect(CryptoVault.isEncryptedFile({ name: 'BACKUP.SARAENC' })).toBe(true);
    expect(CryptoVault.isEncryptedFile({ name: 'backup.zip' })).toBe(false);
    expect(CryptoVault.isEncryptedFile(null)).toBe(false);
  });
});
