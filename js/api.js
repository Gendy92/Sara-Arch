// Direct Supabase REST API (no external dependencies)

const API = {
  base: SUPABASE_URL + '/rest/v1',

  getHeaders() {
    const token = (typeof Auth !== 'undefined' && Auth.token) ? Auth.token : SUPABASE_ANON_KEY;
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  _parseError(text, status) {
    try {
      const parsed = JSON.parse(text);
      return parsed.message || parsed.error || parsed.msg || JSON.stringify(parsed);
    } catch (e) {
      return text || `HTTP ${status}`;
    }
  },

  async request(table, method = 'GET', body = null, query = '') {
    const url = `${this.base}/${table}${query}`;
    const opts = { method, headers: this.getHeaders() };
    if (body) opts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch(url, opts);
    } catch (networkErr) {
      throw new Error('Network error: ' + (networkErr.message || 'Unable to reach server'));
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(this._parseError(text, res.status));
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  // Fetch all rows for a query by paginating automatically. Use for statements/exports.
  async fetchAll(table, baseQuery = '', pageSize = 1000) {
    let offset = 0;
    let all = [];
    const sep = baseQuery.includes('?') ? '&' : '?';
    while (true) {
      const chunk = await this.request(table, 'GET', null, `${baseQuery}${sep}limit=${pageSize}&offset=${offset}`);
      if (!Array.isArray(chunk)) throw new Error('Unexpected response while fetching data');
      all = all.concat(chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
      // Safety cap to avoid infinite loops
      if (offset > 1000000) break;
    }
    return all;
  },

  // Call a PostgreSQL function exposed via PostgREST RPC.
  async rpc(name, args = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(args)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(this._parseError(text, res.status));
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  // Auth endpoints (use anon key)
  async authSignIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(this._parseError(text, res.status) || 'Invalid login');
    }
    return res.json();
  },

  async authSignUp(email, password, data = {}) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ email, password, data })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(this._parseError(text, res.status) || 'Registration failed');
    }
    return res.json();
  },

  async authGetUser(token) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Accept-Charset': 'utf-8' }
    });
    if (!res.ok) return null;
    return res.json();
  },

  // Admin endpoints historically required a service_role key.
  // Service-role keys are no longer stored or used in the browser.
  async authListUsers() {
    throw new Error('Admin user listing is disabled in the browser. Use the profiles table or a secure Edge Function.');
  },

  async authCreateUser(email, password, metadata) {
    throw new Error('Admin user creation is disabled in the browser. Use public signup or a secure Edge Function.');
  },

  async authUpdateUser(id, metadata) {
    throw new Error('Admin user update is disabled in the browser. Use a secure Edge Function.');
  },

  async count(table, query = '') {
    try {
      const url = `${this.base}/${table}${query}`;
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + ((typeof Auth !== 'undefined' && Auth.token) ? Auth.token : SUPABASE_ANON_KEY), 'Prefer': 'count=exact' }
      });
      const range = res.headers.get('content-range');
      if (range) {
        const total = parseInt(range.split('/')[1]);
        return isNaN(total) ? 0 : total;
      }
      return 0;
    } catch (e) {
      console.error('[API.count] Error:', e.message);
      return 0;
    }
  }
};
