// Offline mutation queue + sync manager
// Queues failed API mutations in IndexedDB and replays them when connectivity returns.

// eslint-disable-next-line no-unused-vars
const SyncManager = {
  DB_NAME: 'sara-sync',
  DB_VERSION: 1,
  STORE_QUEUE: 'queue',
  STORE_META: 'meta',
  _db: null,

  async init() {
    if (this._db) return this._db;
    if (typeof window === 'undefined' || !window.indexedDB) {
      this._db = null;
      return null;
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_QUEUE)) {
          const store = db.createObjectStore(this.STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(this.STORE_META)) {
          db.createObjectStore(this.STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = (event) => { this._db = event.target.result; resolve(this._db); };
      req.onerror = () => { reject(new Error('Failed to open sync DB')); };
    });
  },

  async _transaction(storeName, mode) {
    const db = await this.init();
    if (!db) throw new Error('IndexedDB unavailable');
    return db.transaction(storeName, mode).objectStore(storeName);
  },

  async enqueue(request) {
    const store = await this._transaction(this.STORE_QUEUE, 'readwrite');
    const item = {
      url: request.url,
      method: request.method,
      headers: request.headers || {},
      body: request.body,
      table: request.table || '',
      description: request.description || 'عملية غير معروفة',
      createdAt: Date.now(),
      attempts: 0,
      lastError: null
    };
    return new Promise((resolve, reject) => {
      const req = store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async list() {
    const store = await this._transaction(this.STORE_QUEUE, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.index('createdAt').openCursor();
      const items = [];
      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) { items.push(cursor.value); cursor.continue(); }
        else resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async remove(id) {
    const store = await this._transaction(this.STORE_QUEUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async update(item) {
    const store = await this._transaction(this.STORE_QUEUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async setLastSync() {
    const store = await this._transaction(this.STORE_META, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ key: 'lastSync', value: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getLastSync() {
    const store = await this._transaction(this.STORE_META, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get('lastSync');
      req.onsuccess = () => resolve(req.result?.value || null);
      req.onerror = () => reject(req.error);
    });
  },

  async pendingCount() {
    const items = await this.list();
    return items.length;
  },

  async clearAll() {
    const store = await this._transaction(this.STORE_QUEUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // Wrap an API.request-style call. On network failure, queue it instead of throwing.
  async api(table, method = 'GET', body = null, query = '', options = {}) {
    const url = `${API.base}/${table}${API._sanitizeQuery(query)}`;
    const headers = API.getHeaders();
    const desc = options.description || this._defaultDescription(table, method);
    try {
      const result = await API.request(table, method, body, query);
      await this.setLastSync();
      return result;
    } catch (e) {
      const isNetworkError = /network|اتصال|reach server/i.test(e.message);
      if (isNetworkError && method !== 'GET') {
        await this.enqueue({ url, method, headers, body, table, description: desc });
        this._updateIndicator();
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('سيتم المزامنة عند استعادة الاتصال', 'warning');
        }
        throw new Error('تم حفظ العملية للمزامنة لاحقًا');
      }
      throw e;
    }
  },

  _defaultDescription(table, method) {
    const labels = { POST: 'إضافة', PATCH: 'تعديل', DELETE: 'حذف' };
    return `${labels[method] || method} ${table}`;
  },

  // Replay queued mutations in order. Returns summary { succeeded, failed, errors }.
  async replay() {
    const items = await this.list();
    if (!items.length) return { succeeded: 0, failed: 0, errors: [] };
    const errors = [];
    let succeeded = 0;
    let failed = 0;
    for (const item of items) {
      try {
        item.attempts += 1;
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body ? JSON.stringify(item.body) : undefined
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        await this.remove(item.id);
        succeeded += 1;
      } catch (e) {
        item.lastError = e.message;
        await this.update(item);
        failed += 1;
        errors.push({ item, error: e.message });
        if (item.attempts >= 3) {
          if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(`فشلت المزامنة: ${item.description}`, 'error');
          }
        }
      }
    }
    if (succeeded) await this.setLastSync();
    this._updateIndicator();
    return { succeeded, failed, errors };
  },

  _updateIndicator() {
    if (typeof App !== 'undefined' && App.updateSyncIndicator) {
      App.updateSyncIndicator();
    }
  },

  async startListening() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('تم استعادة الاتصال — جاري المزامنة', 'success');
      this.replay().catch(() => {});
    });
    // Initial indicator refresh
    this._updateIndicator();
  }
};

if (typeof window !== 'undefined') {
  window.SyncManager = SyncManager;
}
