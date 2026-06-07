// Auth Module (direct REST API)

const Auth = {
  user: null,
  token: localStorage.getItem('sara_token') || null,

  async init() {
    if (this.token) {
      const user = await API.authGetUser(this.token);
      if (user) {
        this.user = user;
      } else {
        this.logout();
      }
    }
  },

  async login(email, password) {
    const data = await API.authSignIn(email, password);
    this.token = data.access_token;
    this.user = data.user;
    localStorage.setItem('sara_token', this.token);
    return data;
  },

  async register(email, password, name) {
    const data = await API.authSignUp(email, password, { name });
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
