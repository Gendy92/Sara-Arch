// Authentication Module

const Auth = {
  user: null,
  session: null,

  async init() {
    // Check existing session
    const { data: { session } } = await sb.auth.getSession();
    this.session = session;
    this.user = session?.user || null;

    // Listen for auth changes
    sb.auth.onAuthStateChange((event, session) => {
      this.session = session;
      this.user = session?.user || null;
      if (event === 'SIGNED_IN') {
        App.goTo('dashboard');
      } else if (event === 'SIGNED_OUT') {
        App.goTo('login');
      }
    });

    return this.user;
  },

  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    this.session = data.session;
    return data;
  },

  async register(email, password, metadata = {}) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    this.user = null;
    this.session = null;
  },

  async resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password.html'
    });
    if (error) throw error;
  },

  async updateProfile(updates) {
    const { data, error } = await sb.auth.updateUser({
      data: updates
    });
    if (error) throw error;
    this.user = data.user;
    return data;
  },

  isLoggedIn() {
    return !!this.user;
  },

  getUser() {
    return this.user;
  },

  getToken() {
    return this.session?.access_token;
  }
};

window.Auth = Auth;
