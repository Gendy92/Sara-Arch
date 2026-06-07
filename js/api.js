// Direct Supabase REST API (no external dependencies)

const API = {
  base: SUPABASE_URL + '/rest/v1',

  getHeaders() {
    const token = (typeof Auth !== 'undefined' && Auth.token) ? Auth.token : SUPABASE_ANON_KEY;
    console.log('[API] Using token:', token ? token.substring(0, 20) + '...' : 'ANON');
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  async request(table, method = 'GET', body = null, query = '') {
    const url = `${this.base}/${table}${query}`;
    const opts = { method, headers: this.getHeaders() };
    if (body) opts.body = JSON.stringify(body);
    console.log('[API]', method, url);
    const res = await fetch(url, opts);
    console.log('[API] Response:', res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error('[API] Error:', text);
      throw new Error(text || `HTTP ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  // Auth endpoints (use anon key)
  async authSignIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Invalid login');
    return res.json();
  },

  async authSignUp(email, password, data = {}) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data })
    });
    if (!res.ok) throw new Error('Registration failed');
    return res.json();
  },

  async authGetUser(token) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return null;
    return res.json();
  },

  // Admin endpoints (require service_role key)
  async authListUsers() {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY }
    });
    if (!res.ok) throw new Error('Failed to list users');
    return res.json();
  },

  async authCreateUser(email, password, metadata) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata })
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  }
};
