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

  async init() {
    if (this.token) {
      const user = await API.authGetUser(this.token);
      if (user) {
        this.user = user;
        this.user.displayName = user.user_metadata?.name || this.fromEmail(user.email);
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
    this.user.displayName = data.user?.user_metadata?.name || username;
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
