// Auth Module - Username + Password

const Auth = {
  user: null,
  token: localStorage.getItem('sara_token') || null,

  toEmail(username) {
    return username.trim().toLowerCase() + '@local';
  },

  fromEmail(email) {
    return email.replace('@local', '');
  },

  safeName(name, fallback) {
    if (!name || name.includes('?')) return fallback;
    return name;
  },

  async init() {
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
      } else {
        this.logout();
      }
    }
  },

  async login(username, password) {
    console.log('[Auth] Logging in:', username);
    const data = await API.authSignIn(this.toEmail(username), password);
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
    localStorage.setItem('sara_token', this.token);
    console.log('[Auth] Saved to localStorage');
    return data;
  },

  async register(username, password, name) {
    const data = await API.authSignUp(this.toEmail(username), password, { name, username });
    return data;
  },

  logout() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('sara_token');
  },

  isLoggedIn() {
    return !!this.user;
  }
};
