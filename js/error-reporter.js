// ─── RUNTIME ERROR REPORTER ───
// Catches unhandled JS errors and rejected promises and sends them to the
// app_errors table via the log_app_error RPC. Disabled when the Supabase anon
// key is missing so the app does not fail fast during local development.

const ErrorReporter = {
  enabled: true,
  _reporting: false,
  _endpoint: (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/rest/v1/rpc/log_app_error',

  init() {
    if (typeof window === 'undefined') return;
    if (typeof SUPABASE_ANON_KEY === 'undefined' || SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')) {
      this.enabled = false;
      return;
    }
    window.addEventListener('error', (e) => this._onError(e.error || e.message, e.error && e.error.stack));
    window.addEventListener('unhandledrejection', (e) => this._onError(e.reason, e.reason && e.reason.stack));
  },

  _onError(error, stack) {
    if (!this.enabled || this._reporting) return;
    const message = (error && error.message) ? error.message : String(error);
    this.report(message, stack);
  },

  report(message, stack = '') {
    if (!this.enabled || this._reporting) return;
    const payload = {
      message: String(message).slice(0, 2000),
      stack: String(stack).slice(0, 8000),
      url: (typeof location !== 'undefined' ? location.href : ''),
      user_id: (typeof Auth !== 'undefined' && Auth.user && Auth.user.id) ? Auth.user.id : null,
      tenant_id: (typeof localStorage !== 'undefined') ? localStorage.getItem('sara_tenant_id') : null,
      user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : '')
    };

    this._reporting = true;
    fetch(this._endpoint, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Swallow reporting failures to avoid recursive error loops.
    }).finally(() => {
      this._reporting = false;
    });
  }
};

if (typeof window !== 'undefined') {
  window.ErrorReporter = ErrorReporter;
  ErrorReporter.init();
}
