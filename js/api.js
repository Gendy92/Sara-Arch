// Direct Supabase REST API (no external dependencies)

const API = {
  base: SUPABASE_URL + '/rest/v1',

  getHeaders() {
    const token = (typeof Auth !== 'undefined' && Auth.token) ? Auth.token : SUPABASE_ANON_KEY;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    const tenant = (typeof localStorage !== 'undefined') ? localStorage.getItem('sara_tenant_id') : null;
    if (tenant) headers['X-App-Tenant'] = tenant;
    return headers;
  },

  _parseError(text, status) {
    try {
      const parsed = JSON.parse(text);
      return parsed.message || parsed.error || parsed.msg || JSON.stringify(parsed);
    } catch (e) {
      return text || `HTTP ${status}`;
    }
  },

  _safeEncode(value) {
    try { return encodeURIComponent(decodeURIComponent(value)); }
    catch (e) { return encodeURIComponent(value); }
  },

  _sanitizeQuery(query) {
    if (!query || query.indexOf('?') !== 0) return query;
    const ops = 'eq|neq|gt|gte|lt|lte|like|ilike|fts|plfts|phfts|wfts|cs|cd|ov|sl|sr|nxr|nxl|adj|match';
    return '?' + query.slice(1).split('&').map(part => {
      const idx = part.indexOf('=');
      if (idx === -1) return part;
      const key = part.slice(0, idx);
      let val = part.slice(idx + 1);
      const m = val.match(new RegExp(`^(${ops})\\.(.+)$|^is\\.(null)$|^not\\.is\\.(null)$|^in\\.\\((.*)\\)$`));
      if (!m) return part;
      if (m[1]) return `${key}=${m[1]}.${this._safeEncode(m[2])}`;
      if (m[3] !== undefined) return `${key}=is.null`;
      if (m[4] !== undefined) return `${key}=not.is.null`;
      if (m[5] !== undefined) {
        const encoded = m[5].split(',').map(v => this._safeEncode(v)).join(',');
        return `${key}=in.(${encoded})`;
      }
      return part;
    }).join('&');
  },

  async request(table, method = 'GET', body = null, query = '') {
    const url = `${this.base}/${table}${this._sanitizeQuery(query)}`;
    const opts = { method, headers: this.getHeaders() };
    if (body) opts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch(url, opts);
    } catch (networkErr) {
      throw new Error('تعذر الاتصال بالخادم — Network error: ' + (networkErr.message || 'Unable to reach server'));
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
    const safeBase = this._sanitizeQuery(baseQuery);
    const sep = safeBase.includes('?') ? '&' : '?';
    while (true) {
      const chunk = await this.request(table, 'GET', null, `${safeBase}${sep}limit=${pageSize}&offset=${offset}`);
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

  // Upsert rows into a table (used by restore-from-backup).
  // `onConflict` should be the primary-key column(s), e.g. 'id'.
  async upsert(table, rows, onConflict = 'id') {
    if (!rows || !rows.length) return [];
    const url = `${this.base}/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
    const headers = this.getHeaders();
    headers['Prefer'] = 'resolution=merge-duplicates';
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(rows) });
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

  async authResetPassword(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.msg || 'فشل إرسال رابط استعادة كلمة المرور');
    }
    return data;
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
      const url = `${this.base}/${table}${this._sanitizeQuery(query)}`;
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
      return 0;
    }
  },

  // Query-string helpers that URL-encode values to prevent PostgREST injection.
  q: {
    _op(col, op, val) { return `${encodeURIComponent(col)}=${op}.${encodeURIComponent(val)}`; },
    eq(col, val) { return this._op(col, 'eq', val); },
    neq(col, val) { return this._op(col, 'neq', val); },
    gt(col, val) { return this._op(col, 'gt', val); },
    gte(col, val) { return this._op(col, 'gte', val); },
    lt(col, val) { return this._op(col, 'lt', val); },
    lte(col, val) { return this._op(col, 'lte', val); },
    like(col, val) { return this._op(col, 'like', val); },
    ilike(col, val) { return this._op(col, 'ilike', val); },
    isNull(col) { return `${encodeURIComponent(col)}=is.null`; },
    notNull(col) { return `${encodeURIComponent(col)}=not.is.null`; },
    in(col, vals) { return `${encodeURIComponent(col)}=in.(${vals.map(v => encodeURIComponent(v)).join(',')})`; },
    order(col, asc = false) { return `order=${encodeURIComponent(col)}.${asc ? 'asc' : 'desc'}`; },
    select(cols) { return `select=${encodeURIComponent(cols)}`; }
  }
};
