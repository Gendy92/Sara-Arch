// ─── ENCRYPTED VAULT — portable, password-protected transfers ───
// Exports a full backup as a .saraenc file: AES-256-GCM with a key derived
// via PBKDF2-SHA256 (310k iterations) from a user-chosen password.
// Without the password the file is unrecoverable. Standard WebCrypto only —
// the same code decrypts on any PC in any modern browser/Electron.
//
// File format (.saraenc):
//   magic "SARAENC1" (8 bytes) | salt (16) | iv (12) | AES-GCM ciphertext

const CryptoVault = {
  MAGIC: 'SARAENC1',
  PBKDF2_ITERATIONS: 310000,
  SALT_LEN: 16,
  IV_LEN: 12,

  isEncryptedFile(file) {
    return !!file && /\.saraenc$/i.test(file.name || '');
  },

  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: this.PBKDF2_ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encryptBlob(blob, password) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LEN));
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LEN));
    const key = await this.deriveKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const out = new Uint8Array(8 + salt.length + iv.length + ct.byteLength);
    out.set(new TextEncoder().encode(this.MAGIC), 0);
    out.set(salt, 8);
    out.set(iv, 8 + salt.length);
    out.set(new Uint8Array(ct), 8 + salt.length + iv.length);
    return new Blob([out], { type: 'application/octet-stream' });
  },

  // Returns a Blob (the inner ZIP). Throws with an Arabic message on wrong
  // password or corrupted file.
  async decryptFile(file, password) {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 8 + this.SALT_LEN + this.IV_LEN + 16) {
      throw new Error('ملف غير صالح أو غير مكتمل');
    }
    const magic = new TextDecoder().decode(buf.slice(0, 8));
    if (magic !== this.MAGIC) {
      throw new Error('هذا ليس ملف نسخة مشفرة صالح');
    }
    const salt = buf.slice(8, 8 + this.SALT_LEN);
    const iv = buf.slice(8 + this.SALT_LEN, 8 + this.SALT_LEN + this.IV_LEN);
    const ct = buf.slice(8 + this.SALT_LEN + this.IV_LEN);
    const key = await this.deriveKey(password, salt);
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return new Blob([plain], { type: 'application/zip' });
    } catch (e) {
      throw new Error('كلمة المرور غير صحيحة أو الملف تالف');
    }
  },

  // ─── Password prompts (promise-based modals) ───

  // Ask for an existing password. Resolves to the password, or null on cancel.
  askPassword(title) {
    return new Promise(resolve => {
      const id = 'vault-pw-' + Date.now();
      UI.openModal(title, `
        <div class="form-group">
          <label>كلمة المرور</label>
          <input type="password" id="${id}" dir="ltr" autocomplete="off" style="width:100%">
          <p id="${id}-err" style="color:var(--red);font-size:12px;margin-top:6px;min-height:14px"></p>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" id="${id}-cancel">إلغاء</button>
          <button class="btn btn-primary" id="${id}-ok">فك التشفير</button>
        </div>`);
      const input = document.getElementById(id);
      const finish = val => { UI.closeModal(); resolve(val); };
      document.getElementById(id + '-ok').addEventListener('click', () => {
        const v = input.value;
        if (!v) { document.getElementById(id + '-err').textContent = 'أدخل كلمة المرور'; return; }
        finish(v);
      });
      document.getElementById(id + '-cancel').addEventListener('click', () => finish(null));
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById(id + '-ok').click(); }
      });
      setTimeout(() => input.focus(), 60);
    });
  },

  // Ask for a NEW password (with confirmation). Resolves to the password,
  // or null on cancel. Minimum 6 characters.
  askNewPassword(title) {
    return new Promise(resolve => {
      const id = 'vault-npw-' + Date.now();
      UI.openModal(title, `
        <div class="form-group">
          <label>كلمة مرور جديدة (6 أحرف على الأقل)</label>
          <input type="password" id="${id}-1" dir="ltr" autocomplete="off" style="width:100%">
        </div>
        <div class="form-group">
          <label>تأكيد كلمة المرور</label>
          <input type="password" id="${id}-2" dir="ltr" autocomplete="off" style="width:100%">
          <p id="${id}-err" style="color:var(--red);font-size:12px;margin-top:6px;min-height:14px"></p>
        </div>
        <p style="font-size:12px;color:var(--text3);margin-bottom:12px">🔐 احفظ كلمة المرور في مكان آمن — بدونها لا يمكن استرجاع البيانات نهائيًا.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" id="${id}-cancel">إلغاء</button>
          <button class="btn btn-primary" id="${id}-ok">تشفير وتصدير</button>
        </div>`);
      const p1 = document.getElementById(id + '-1');
      const p2 = document.getElementById(id + '-2');
      const err = document.getElementById(id + '-err');
      const finish = val => { UI.closeModal(); resolve(val); };
      document.getElementById(id + '-ok').addEventListener('click', () => {
        const v1 = p1.value, v2 = p2.value;
        if (v1.length < 6) { err.textContent = 'كلمة المرور يجب ألا تقل عن 6 أحرف'; return; }
        if (v1 !== v2) { err.textContent = 'كلمتا المرور غير متطابقتين'; return; }
        finish(v1);
      });
      document.getElementById(id + '-cancel').addEventListener('click', () => finish(null));
      p2.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById(id + '-ok').click(); }
      });
      setTimeout(() => p1.focus(), 60);
    });
  }
};

if (typeof window !== 'undefined') {
  window.CryptoVault = CryptoVault;
}
