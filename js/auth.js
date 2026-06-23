// Auth Module - Username + Password

const Auth = {
  user: null,
  // Store the JWT in sessionStorage instead of localStorage so it is scoped
  // to the tab and cleared when the tab closes. This reduces (but does not
  // eliminate) XSS exposure; full protection requires httpOnly cookies.
  token: sessionStorage.getItem('sara_token') || null,

  _hashUsername(username) {
    // Deterministic 32-bit hash for non-ASCII usernames (e.g. Arabic names).
    let h = 0;
    for (let i = 0; i < username.length; i++) {
      h = ((h << 5) - h) + username.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(16).padStart(8, '0');
  },

  toEmail(username) {
    // Convert username to a syntactically-valid email using the project's Pages domain.
    // If the user typed an email, keep only the local part.
    const raw = (username || '').toString().trim();
    const local = raw.toLowerCase().split('@')[0];
    // Spaces become dots; only ASCII letters/digits, dots, underscores and hyphens are kept.
    let safe = local.replace(/\s+/g, '.').replace(/[^a-z0-9_.-]/g, '');
    // For Arabic / Unicode usernames, fall back to a hashed local part so every user gets a unique email.
    if (!safe) safe = 'u' + this._hashUsername(raw);
    safe = safe.replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '') || 'user';
    return safe + '@' + SARA_EMAIL_DOMAIN;
  },

  // Legacy mapping used before Arabic support; kept only for fallback logins.
  toEmailLegacy(username) {
    const local = (username || '').toString().trim().toLowerCase().split('@')[0];
    const safe = local.replace(/\s+/g, '.').replace(/[^a-z0-9_.-]/g, '');
    return (safe || 'user') + '@' + SARA_EMAIL_DOMAIN;
  },

  fromEmail(email) {
    return email.replace('@' + SARA_EMAIL_DOMAIN, '').replace('@sara-arch.local', '').replace('@local', '');
  },

  safeName(name, fallback) {
    if (!name || name.includes('?')) return fallback;
    return name;
  },

  async init() {
    // One-time migration of legacy localStorage token to sessionStorage
    if (!this.token && localStorage.getItem('sara_token')) {
      this.token = localStorage.getItem('sara_token');
      sessionStorage.setItem('sara_token', this.token);
      localStorage.removeItem('sara_token');
    }
    if (this.token) {
      const user = await API.authGetUser(this.token);
      if (user) {
        this.user = user;
        // Load profile from profiles table (Arabic names stored reliably here)
        try {
          const profiles = await API.request('profiles', 'GET', null, `?id=eq.${user.id}`);
          const profile = profiles[0];
          this.user.displayName = this.safeName(profile?.name, this.safeName(user.user_metadata?.name, this.fromEmail(user.email)));
          this.user.role = profile?.role || user.user_metadata?.role || 'user';
        } catch (e) {
          this.user.displayName = this.safeName(user.user_metadata?.name, this.fromEmail(user.email));
          this.user.role = user.user_metadata?.role || 'user';
        }
        await this._loadDefaultTenant();
        await this.loadPermissions();
      } else {
        this.logout();
      }
    }
  },

  async _loadDefaultTenant() {
    if (!this.user) return;
    try {
      const rows = await API.request('user_tenants', 'GET', null, `?user_id=eq.${this.user.id}&is_default=eq.true&select=tenant_id&limit=1`);
      if (rows && rows.length) {
        localStorage.setItem('sara_tenant_id', rows[0].tenant_id);
      } else {
        localStorage.removeItem('sara_tenant_id');
      }
    } catch (e) {
      // user_tenants may not exist yet (pre-migration)
      localStorage.removeItem('sara_tenant_id');
    }
  },

  resolveEmail(input) {
    const raw = (input || '').toString().trim();
    if (raw.includes('@')) return raw.toLowerCase();
    return this.toEmail(raw);
  },

  async login(username, password) {
    let data;
    const primaryEmail = this.resolveEmail(username);
    try {
      data = await API.authSignIn(primaryEmail, password);
    } catch (e) {
      // Fallback chain for accounts created with earlier email domains or Arabic usernames.
      const local = username.trim().toLowerCase().split('@')[0].replace(/\s+/g, '.');
      const fallbacks = [
        this.toEmailLegacy(username),
        local + '@sara-arch.local',
        local.replace(/\./g, '') + '@local'
      ].filter(em => em !== primaryEmail);
      for (const email of fallbacks) {
        try {
          data = await API.authSignIn(email, password);
          break;
        } catch (e2) { /* continue to next fallback */ }
      }
      if (!data) throw e;
    }
    this.token = data.access_token;
    this.user = data.user;
    // Try to load profile for correct Arabic name
    try {
      const profiles = await API.request('profiles', 'GET', null, `?id=eq.${data.user.id}`);
      const profile = profiles[0];
      this.user.displayName = this.safeName(profile?.name, this.safeName(data.user?.user_metadata?.name, username));
      this.user.role = profile?.role || data.user?.user_metadata?.role || 'user';
    } catch (e) {
      this.user.displayName = this.safeName(data.user?.user_metadata?.name, username);
      this.user.role = data.user?.user_metadata?.role || 'user';
    }
    sessionStorage.setItem('sara_token', this.token);
    localStorage.removeItem('sara_token');
    await this._loadDefaultTenant();
    await this.loadPermissions();
    return data;
  },

  async forgotPassword(input) {
    const email = this.resolveEmail(input);
    if (!email) throw new Error('أدخل اسم المستخدم أو البريد الإلكتروني');
    await API.authResetPassword(email);
  },

  async register(username, password, name) {
    const data = await API.authSignUp(this.resolveEmail(username), password, { name, username });
    // Insert into profiles table for reliable name/role storage
    try {
      if (data.user?.id) {
        await API.request('profiles', 'POST', { id: data.user.id, name: name || username, role: 'user' });
      }
    } catch (e) { /* profile may already exist or permissions restrict insert */ }
    return data;
  },

  logout() {
    this.user = null;
    this.token = null;
    sessionStorage.removeItem('sara_token');
    localStorage.removeItem('sara_token');
    localStorage.removeItem('sara_tenant_id');
  },

  isLoggedIn() {
    return !!this.user;
  },

  isAdmin() {
    return this.user?.role === 'admin';
  },

  permissions: {},

  async loadPermissions() {
    if (!this.user) return;
    // Admin always has full access
    if (this.isAdmin()) {
      this.permissions = { _admin: true };
      return;
    }
    try {
      const perms = await API.request('user_permissions', 'GET', null, `?user_id=eq.${this.user.id}`);
      this.permissions = {};
      perms.forEach(p => {
        this.permissions[p.screen] = {
          view: p.can_view,
          add: p.can_add,
          edit: p.can_edit,
          delete: p.can_delete,
          print: p.can_print
        };
      });
    } catch (e) {
      this.permissions = {};
    }
  },

  can(screen, action = 'view') {
    if (this.isAdmin()) return true;
    const p = this.permissions[screen];
    // Default-deny: if no permission row exists, the user cannot access the screen.
    if (!p) return false;
    return !!p[action];
  }
};
