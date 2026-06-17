// Auth Module - Username + Password

const Auth = {
  user: null,
  // Store the JWT in sessionStorage instead of localStorage so it is scoped
  // to the tab and cleared when the tab closes. This reduces (but does not
  // eliminate) XSS exposure; full protection requires httpOnly cookies.
  token: sessionStorage.getItem('sara_token') || null,

  toEmail(username) {
    // Convert username to a syntactically-valid email using the project's Pages domain.
    // If the user typed an email, keep only the local part.
    const local = username.trim().toLowerCase().split('@')[0];
    // Spaces become dots; only ASCII letters/digits, dots, underscores and hyphens are kept.
    const safe = local.replace(/\s+/g, '.').replace(/[^a-z0-9_.-]/g, '');
    return (safe || 'user') + '@gendy92.github.io';
  },

  fromEmail(email) {
    return email.replace('@gendy92.github.io', '').replace('@sara-arch.local', '').replace('@local', '');
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
        await this.loadPermissions();
      } else {
        this.logout();
      }
    }
  },

  async login(username, password) {
    console.log('[Auth] Logging in:', username);
    let data;
    const primaryEmail = this.toEmail(username);
    try {
      data = await API.authSignIn(primaryEmail, password);
    } catch (e) {
      // Fallback chain for accounts created with earlier email domains.
      const local = username.trim().toLowerCase().split('@')[0].replace(/\s+/g, '.');
      const fallbacks = [
        local + '@sara-arch.local',
        local.replace(/\./g, '') + '@local'
      ].filter(em => em !== primaryEmail);
      for (const email of fallbacks) {
        try {
          console.log('[Auth] Retrying with legacy email:', email);
          data = await API.authSignIn(email, password);
          break;
        } catch (e2) { /* continue to next fallback */ }
      }
      if (!data) throw e;
    }
    console.log('[Auth] Got token:', data.access_token ? data.access_token.substring(0, 20) + '...' : 'NONE');
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
    console.log('[Auth] Saved to sessionStorage');
    await this.loadPermissions();
    return data;
  },

  async register(username, password, name) {
    const data = await API.authSignUp(this.toEmail(username), password, { name, username });
    // Insert into profiles table for reliable name/role storage
    try {
      if (data.user?.id) {
        await API.request('profiles', 'POST', { id: data.user.id, name: name || username, role: 'user' });
      }
    } catch (e) {
      console.log('[Auth] profile insert skipped:', e.message);
    }
    return data;
  },

  logout() {
    this.user = null;
    this.token = null;
    sessionStorage.removeItem('sara_token');
    localStorage.removeItem('sara_token');
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
      console.log('[Auth] Permissions not loaded:', e.message);
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
