// ─── AUTOMATIC LOCAL BACKUP MANAGER ───
// Backs up all Supabase data to a local ZIP once per day while the app is open,
// and records each backup event (user + device details) to the backup_logs table.

const BackupManager = {
  CHECK_INTERVAL_MS: 60 * 60 * 1000, // check every hour
  DAY_MS: 24 * 60 * 60 * 1000,
  STORAGE_KEY: 'sara_last_backup',

  init() {
    if (typeof window === 'undefined') return;
    // Only run for logged-in users.
    if (!Auth.isLoggedIn || !Auth.isLoggedIn()) return;
    this._schedule();
  },

  _schedule() {
    // Run an immediate check, then check hourly.
    this.check();
    setInterval(() => this.check(), this.CHECK_INTERVAL_MS);
  },

  _isDue() {
    const last = localStorage.getItem(this.STORAGE_KEY);
    if (!last) return true;
    return Date.now() >= new Date(last).getTime() + this.DAY_MS;
  },

  async check() {
    if (!this._isDue()) return;
    try {
      await this.runAutoBackup();
    } catch (e) {
      console.error('[BackupManager] auto backup failed', e);
      this.logBackup({ status: 'error', error: e.message || 'unknown' });
    }
  },

  async runAutoBackup() {
    if (typeof App === 'undefined' || !App._backupToZip) {
      throw new Error('Backup core not loaded');
    }
    const fileName = `Sara_AutoBackup_${new Date().toISOString().slice(0,10)}_${Date.now()}.zip`;
    const { blob, manifest, ok, skip, fail } = await App._backupToZip({ auto: true });

    // Trigger download. Most browsers allow this for file downloads even without a user gesture.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem(this.STORAGE_KEY, new Date().toISOString());

    await this.logBackup({
      manifest,
      status: fail ? 'partial' : 'success',
      fileName
    });

    console.log('[BackupManager] auto backup completed', { ok, skip, fail });
  },

  _deviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      vendor: navigator.vendor || null,
      cores: navigator.hardwareConcurrency || null,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null
    };
  },

  async logBackup({ manifest = {}, status = 'unknown', fileName = null, error = null } = {}) {
    try {
      const user = Auth.user || {};
      const payload = {
        user_id: user.id || null,
        user_name: user.user_metadata?.name || user.user_metadata?.username || user.email || user.username || null,
        tenant_id: (typeof localStorage !== 'undefined') ? localStorage.getItem('sara_tenant_id') : null,
        device_info: this._deviceInfo(),
        status,
        counts: manifest.counts || {},
        file_name: fileName
      };
      if (error) payload.counts = { ...(manifest.counts || {}), _error: String(error) };
      await API.request('backup_logs', 'POST', [payload]);
    } catch (e) {
      // Never crash the app because logging failed.
      console.error('[BackupManager] failed to log backup', e);
    }
  }
};

if (typeof window !== 'undefined') {
  window.BackupManager = BackupManager;
}
