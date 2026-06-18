// Main App

const App = {
  screen: 'login',
  txTab: 'all',
  txTypeFilter: 'all',
  taskStatusFilter: 'all',
  loading: false,
  pageState: { clients: 1, vendors: 1, employees: 1, users: 1, master: 1, transactions: 1, txExpenses: 1, officeTransactions: 1, officeCustody: 1, masterSectors: 1, masterWorkSections: 1, masterWorkItems: 1, masterItems: 1, empTransactions: 1, empSalaryHistory: 1 },
  searchState: {},
  settings: { currency_label: 'ج.م', default_supervision: 10, company_name: 'سارة أبو العلا' },
  PAGE_SIZE: 50,

  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  setDateRange(fromId, toId, preset) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    let from, to;
    switch (preset) {
      case 'today': from = to = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; break;
      case 'this_month': from = `${y}-${String(m+1).padStart(2,'0')}-01`; to = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; break;
      case 'last_month': from = `${y}-${String(m).padStart(2,'0')}-01`; to = `${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`; break;
      case 'this_quarter': const qm = Math.floor(m / 3) * 3; from = `${y}-${String(qm+1).padStart(2,'0')}-01`; to = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; break;
      case 'this_year': from = `${y}-01-01`; to = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; break;
    }
    if (from) document.getElementById(fromId).value = from;
    if (to) document.getElementById(toId).value = to;
  },

  async start() {
    // Surface silent API/runtime failures instead of letting them disappear.
    window.addEventListener('unhandledrejection', (ev) => {
      console.error('Unhandled rejection:', ev.reason);
      const msg = ev.reason?.message || 'حدث خطأ غير متوقع';
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('خطأ: ' + msg, 'error');
    });
    window.addEventListener('error', (ev) => {
      console.error('Global error:', ev.error);
      const msg = ev.error?.message || 'حدث خطأ غير متوقع';
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('خطأ: ' + msg, 'error');
    });
    window.addEventListener('hashchange', () => {
      const { screen, opts } = this._routeFromHash();
      if (screen !== this.screen) this.go(screen, opts);
    });
    // Fail fast if Supabase keys are still placeholders.
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined' ||
        SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')) {
      this.showError('مفاتيح Supabase غير مكونة.<br>يرجى تحديث <code>js/config.local.js</code> بقيم المشروع الصحيحة.');
      return;
    }
    try {
      await Auth.init();
      this.loadLocalSettings();
      this.bindNav();
      if (Auth.isLoggedIn()) {
        this.startIdleTimer();
        const { screen, opts } = this._routeFromHash();
        await this.go(screen, opts);
      } else {
        this.renderLogin();
      }
    } catch (e) {
      this.showError('فشل تحميل التطبيق: ' + e.message);
    }
  },

  startIdleTimer() {
    const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    this.stopIdleTimer();
    this._idleEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];
    this._idleResetHandler = () => this.resetIdleTimer(IDLE_TIMEOUT);
    this._idleEvents.forEach(e => document.addEventListener(e, this._idleResetHandler, { passive: true }));
    this._idleTimer = setTimeout(() => this.onIdleTimeout(), IDLE_TIMEOUT);
  },

  resetIdleTimer(timeout) {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => this.onIdleTimeout(), timeout);
  },

  stopIdleTimer() {
    if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null; }
    if (this._idleEvents && this._idleResetHandler) {
      this._idleEvents.forEach(e => document.removeEventListener(e, this._idleResetHandler, { passive: true }));
    }
    this._idleEvents = null;
    this._idleResetHandler = null;
  },

  onIdleTimeout() {
    if (!Auth.isLoggedIn()) return;
    this.stopIdleTimer();
    Auth.logout();
    UI.toast('تم تسجيل الخروج تلقائيًا بسبب عدم النشاط لمدة 10 دقائق', 'error');
  },

  printReport(title) {
    const origTitle = document.title;
    const date = new Date().toISOString().slice(0, 10);
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    document.title = `${safe(title)}-${date}`;
    window.print();
    setTimeout(() => { document.title = origTitle; }, 1000);
  },

  bindNav() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { this.go(nav.dataset.nav); this.closeSidebar(); }
      if (e.target.closest('[data-action="logout"]')) this.doLogout();
    });
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.dataset.form === 'login') { e.preventDefault(); this.doLogin(form); }
      if (form.dataset.form === 'register') { e.preventDefault(); this.doRegister(form); }
    });
  },

  toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
  },
  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
  },

  async go(screen, opts = {}) {
    const isAdmin = Auth.isAdmin();
    if (screen !== 'login' && !Auth.isLoggedIn()) { screen = 'login'; }
    if ((screen === 'register' || screen === 'settings' || screen === 'users' || screen === 'permissions' || screen === 'audit' || screen === 'backup') && !isAdmin) { screen = 'dashboard'; }
    if (!Auth.can(screen, 'view')) { screen = 'dashboard'; }
    this.screen = screen;
    const app = document.getElementById('app');
    if (!app) return;

    if (screen === 'login') this.renderLogin();
    else if (screen === 'register') this.renderRegister();
    else app.innerHTML = this.layout(this.pageContent(screen));

    if (screen === 'dashboard') await this.loadDashboard();
    if (screen === 'clients') await this.loadClients();
    if (screen === 'vendors') await this.loadVendors();
    if (screen === 'transactions') { if (opts.tab) this.txTab = opts.tab; await this.loadTransactions(); }
    if (screen === 'office') await this.loadOffice();
    if (screen === 'employees') await this.loadEmployees();
    if (screen === 'tasks') await this.loadTasks();
    if (screen === 'settings') await this.loadSettings();
    if (screen === 'users') await this.loadUsers();
    if (screen === 'permissions') await this.loadPermissionsScreen();
    if (screen === 'audit') await this.loadAuditLog();
    if (screen === 'backup') await this.loadBackup();
    if (screen === 'master') await this.loadMasterData();
    if (screen === 'client' && opts.clientId) { this.clientId = opts.clientId; await this.loadClient(opts.clientId); }
    if (screen === 'project' && opts.projectId) { this.projectId = opts.projectId; await this.loadProject(opts.projectId); }
    if (screen === 'vendor' && opts.vendorId) { this.vendorId = opts.vendorId; await this.loadVendor(opts.vendorId); }



    // Update URL hash without triggering hashchange
    const hash = opts.tab ? `#/${screen}?tab=${opts.tab}` : `#/${screen}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
  },

  _routeFromHash() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) return { screen: 'dashboard', opts: {} };
    const [path, query] = hash.split('?');
    const opts = {};
    if (query) {
      query.split('&').forEach(p => {
        const [k, v] = p.split('=');
        if (k && v) opts[k] = decodeURIComponent(v);
      });
    }
    return { screen: path || 'dashboard', opts };
  },

  setTxTab(tab) {
    this.txTab = tab;
    this.go('transactions', { tab });
  },

  setTxTypeFilter(filter) {
    this.txTypeFilter = filter;
    this.loadTransactions();
  },

  setTaskStatusFilter(filter) {
    this.taskStatusFilter = filter;
    this.loadTasks();
  },

  layout(content) {
    const user = Auth.user || {};
    const name = user.displayName || user.user_metadata?.name || 'المستخدم';
    const isAdmin = Auth.isAdmin();
    const navItem = (screen, icon, label) => Auth.can(screen, 'view') ? `<button data-nav="${screen}" class="nav-item ${this.screen === screen ? 'active' : ''}"><span>${icon}</span> ${label}</button>` : '';
    const bnavItem = (screen, icon, label) => Auth.can(screen, 'view') ? `<button class="bottom-nav-item ${this.screen === screen ? 'active' : ''}" onclick="App.go('${screen}')"><span class="bottom-nav-icon">${icon}</span><span class="bottom-nav-label">${label}</span></button>` : '';
    const bottomNav = `<div class="bottom-nav"><div class="bottom-nav-inner">
      ${bnavItem('dashboard', '📊', 'الرئيسية')}
      ${bnavItem('clients', '👥', 'العملاء')}
      ${bnavItem('transactions', '💰', 'المالية')}
      ${bnavItem('vendors', '🚚', 'الموردين')}
      ${bnavItem('tasks', '📋', 'المهام')}
      <button class="bottom-nav-item" onclick="App.toggleSidebar()"><span class="bottom-nav-icon">⚙️</span><span class="bottom-nav-label">المزيد</span></button>
    </div></div>`;
    return `<div class="app-layout"><aside class="sidebar" id="sidebar"><div class="sidebar-logo"><img src="logo.png" alt="Sara Abo Elelaa"><h2>سارة أبو العلا</h2><p>النظام المالي والمحاسبي</p></div><nav class="sidebar-nav">
      ${navItem('dashboard', '📊', 'الرئيسية')}
      ${navItem('clients', '👥', 'العملاء والمشاريع')}
      ${navItem('vendors', '🚚', 'الموردين')}
      ${navItem('transactions', '💰', 'معاملات المشاريع')}
      ${navItem('office', '🏢', 'المكتب')}
      ${navItem('employees', '🧑‍💼', 'الموظفين')}
      ${navItem('tasks', '📋', 'المهام')}
      ${navItem('master', '📋', 'البيانات الأساسية')}


      ${isAdmin ? navItem('settings', '⚙️', 'الإعدادات') : ''}
    </nav><div class="sidebar-footer"><div class="user-info">${name}</div><div style="font-size:10px;color:var(--text3);text-align:center;margin-bottom:4px">${isAdmin ? '👑 مدير' : '👤 موظف'}</div><button data-action="logout" class="btn-logout">🚪 خروج</button></div></aside><div class="sidebar-backdrop" id="sidebar-backdrop" onclick="App.closeSidebar()"></div><button class="hamburger" id="hamburger-btn" onclick="App.toggleSidebar()"><span></span><span></span><span></span></button><main class="main-content">${content}</main>${bottomNav}</div>`;
  },

  pageContent(screen) {
    if (screen === 'dashboard') return `<div class="page-header"><h1>📊 لوحة التحكم</h1></div><div class="kpi-grid" id="kpis"><div class="kpi-card skeleton skeleton-kpi"></div><div class="kpi-card skeleton skeleton-kpi"></div><div class="kpi-card skeleton skeleton-kpi"></div><div class="kpi-card skeleton skeleton-kpi"></div></div><div class="content-grid"><div class="card"><h3>📊 إيرادات vs مصروفات</h3><div id="income-expense-total-chart"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div></div></div><div class="content-grid" style="margin-top:16px"><div class="card"><h3>🏆 أرصدة الموردين المستحقة</h3><div id="dash-vendors"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div><div class="card"><h3>👥 أرصدة العملاء النشطين</h3><div id="dash-clients"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div></div>`;
    if (screen === 'clients') return `<div class="page-header"><h1>👥 العملاء والمشاريع</h1>${Auth.can('clients', 'add') ? `<button class="btn btn-primary" onclick="Crud.addClient()">+ إضافة عميل</button>` : ''}</div><div id="clients-list"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>`;
    if (screen === 'projects') { this.go('clients'); return ''; }
    if (screen === 'transactions') return `<div class="page-header"><h1>💰 معاملات المشاريع</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="Crud.addProjectDeposit()">💰 عربون مشروع</button><button class="btn btn-primary" onclick="Crud.addProjectExpense()">🔨 مصروف مشروع</button></div></div><div class="kpi-grid" id="tx-kpis"><div class="kpi-card skeleton skeleton-kpi"></div><div class="kpi-card skeleton skeleton-kpi"></div><div class="kpi-card skeleton skeleton-kpi"></div><div class="kpi-card skeleton skeleton-kpi"></div></div><div class="tab-bar"><button class="tab-btn ${App.txTab==='all'?'active':''}" onclick="App.setTxTab('all')">الكل</button><button class="tab-btn ${App.txTab==='expenses'?'active':''}" onclick="App.setTxTab('expenses')">المصروفات</button></div><div id="tx-all" style="display:${App.txTab==='all'?'block':'none'}"><div class="card"><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-sm ${App.txTypeFilter==='all'?'btn-primary':'btn-secondary'}" onclick="App.setTxTypeFilter('all')">🏠 الكل</button><button class="btn btn-sm ${App.txTypeFilter==='deposit'?'btn-primary':'btn-secondary'}" onclick="App.setTxTypeFilter('deposit')">💰 الإيداعات</button><button class="btn btn-sm ${App.txTypeFilter==='expense'?'btn-primary':'btn-secondary'}" onclick="App.setTxTypeFilter('expense')">🔨 المصروفات</button></div><div id="tx-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div></div><div id="tx-expenses" style="display:${App.txTab==='expenses'?'block':'none'}"><div class="card"><div id="tx-expenses-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div></div>`;
    if (screen === 'office') return `<div class="page-header"><h1>🏢 حساب المكتب</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="Crud.addOfficeExpense()">🏢 مصروف مكتبي</button><button class="btn btn-primary" onclick="Crud.addOwnerDeposit()">👤 توريد صاحب المكتب</button><button class="btn btn-primary" onclick="Crud.addOwnerWithdrawal()">🏃 سحب صاحب المكتب</button><button class="btn btn-primary" onclick="Crud.addOfficeCustody()">💼 عهد نقدية</button><button class="btn btn-secondary" onclick="App.exportOfficeExcel()">📥 تحميل Excel</button></div></div><div class="kpi-grid" id="office-kpis"><div class="kpi-card skeleton skeleton-kpi"></div><div class="kpi-card skeleton skeleton-kpi"></div><div class="kpi-card skeleton skeleton-kpi"></div></div><div class="card" style="margin-top:16px"><h3>تفاصيل المعاملات</h3><div id="office-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div><div class="card" style="margin-top:16px"><h3>💼 العهد النقدية</h3><div id="office-custody-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div>`;
    if (screen === 'vendors') return `<div class="page-header"><h1>🚚 الموردين</h1>${Auth.can('vendors', 'add') ? `<button class="btn btn-primary" onclick="Crud.addVendor()">+ إضافة مورد</button>` : ''}</div><div class="card"><div id="vendors-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div>`;
    if (screen === 'employees') return `<div class="page-header"><h1>🧑‍💼 الموظفين</h1><button class="btn btn-primary" onclick="Crud.addEmp()">+ إضافة موظفين</button></div><div class="card"><div id="emp-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div><div class="card" style="margin-top:16px"><h3>📤 رفع ملف البصمة</h3><div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap"><input type="file" id="fingerprint-file" accept=".xlsx,.xls,.csv" onchange="App.parseFingerprintFile(this)" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit;font-size:13px;max-width:280px"><span style="font-size:12px;color:var(--text3)">الشهر:</span><select id="fp-month" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${m === new Date().getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}</select><span style="font-size:12px;color:var(--text3)">السنة:</span><select id="fp-year" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('')}</select></div><div id="fingerprint-preview">لم يتم اختيار ملف</div></div><div class="card" style="margin-top:16px"><h3>💰 الرواتب الشهرية</h3><div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap"><label style="font-size:13px">الشهر:</label><select id="emp-payroll-month" onchange="App.loadEmpPayroll()" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${m === new Date().getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}</select><label style="font-size:13px">السنة:</label><select id="emp-payroll-year" onchange="App.loadEmpPayroll()" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('')}</select><button class="btn btn-primary" onclick="App.generateEmpPayroll()">🔄 توليد الرواتب</button></div><div id="emp-payroll-tbl">جاري التحميل...</div></div>`;
    if (screen === 'settings') return `<div class="page-header"><h1>⚙️ الإعدادات</h1></div><div class="content-grid"><div class="card" style="grid-column:1/-1"><h3>🏢 بيانات الشركة / المكتب</h3><form id="settings-form" style="max-width:720px"><div class="form-grid"><div class="form-group"><label>اسم الشركة / المكتب</label><input type="text" name="company_name" id="setting-company-name" value="سارة أبو العلا" /></div><div class="form-group"><label>العنوان</label><input type="text" name="company_address" id="setting-company-address" /></div><div class="form-group"><label>الهاتف</label><input type="text" name="company_phone" id="setting-company-phone" /></div><div class="form-group"><label>الرقم الضريبي</label><input type="text" name="company_tax" id="setting-company-tax" /></div><div class="form-group"><label>نسبة الإشراف الافتراضية (%)</label><input type="number" name="default_supervision" id="setting-default-supervision" value="10" min="0" max="100" step="0.01" /></div><div class="form-group"><label>تسمية العملة</label><input type="text" name="currency_label" id="setting-currency-label" value="ج.م" /></div></div><div style="margin-top:12px"><button type="button" class="btn btn-primary" onclick="App.saveSettings()">💾 حفظ الإعدادات</button></div><p id="settings-msg" style="font-size:12px;color:var(--green);margin-top:8px;min-height:18px"></p></form><div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--text3)">الإصدار المحلي: <strong id="settings-version">-</strong> &nbsp;|&nbsp; آخر نسخة احتياطية: <strong id="settings-last-backup">-</strong></div></div></div><div class="content-grid"><div class="card"><h3>🔐 المستخدمين والصلاحيات</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">إدارة حسابات المستخدمين وصلاحيات الوصول للشاشات.</p><button class="btn btn-primary" onclick="App.go('users')">فتح المستخدمين</button></div><div class="card"><h3>📋 البيانات الأساسية</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">إدارة التصنيفات، الأصناف، أقسام المشاريع وبنود الأعمال.</p><button class="btn btn-primary" onclick="App.go('master')">فتح البيانات الأساسية</button></div><div class="card"><h3>💾 النسخ الاحتياطي</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">تحميل نسخة احتياطية ومراجعة حالة الجداول.</p><button class="btn btn-primary" onclick="App.go('backup')">فتح النسخ الاحتياطي</button></div><div class="card"><h3>📜 سجل العمليات</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">متابعة التعديلات والإضافات على قاعدة البيانات.</p><button class="btn btn-primary" onclick="App.go('audit')">فتح السجل</button></div></div>`;
    if (screen === 'users') return `<div class="page-header"><h1>🔐 إدارة المستخدمين</h1><div style="display:flex;gap:8px;flex-wrap:wrap">${Auth.can('users', 'add') ? `<button class="btn btn-primary" onclick="Crud.addUser()">+ إضافة مستخدمين</button>` : ''}<button class="btn btn-secondary" onclick="App.go('permissions')">🔑 صلاحيات المستخدمين</button></div></div><div class="card"><div id="users-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div>`;
    if (screen === 'audit') return `<div class="page-header"><h1>📜 سجل العمليات</h1></div><div class="card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap"><label style="font-size:13px">الجدول:</label><select id="audit-table" onchange="App.loadAuditLog()" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit"><option value="">الكل</option><option value="clients">العملاء</option><option value="projects">المشاريع</option><option value="employees">الموظفين</option><option value="vendors">الموردين</option><option value="transactions">معاملات المشاريع</option><option value="procurements">المشتريات</option><option value="payroll_records">الرواتب</option></select><button class="btn btn-secondary" onclick="App.loadAuditLog()">🔄 تحديث</button></div><div id="audit-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div>`;
    if (screen === 'backup') return `<div class="page-header"><h1>💾 النسخ الاحتياطي</h1></div><div class="content-grid"><div class="card"><h3>📥 نسخ احتياطي محلي</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">حمّل نسخة كاملة من قاعدة البيانات على جهازك كملف ZIP.</p><div id="backup-progress" style="margin-bottom:12px"></div><button class="btn btn-primary" onclick="App.downloadLocalBackup()">📥 تحميل النسخة الاحتياطية</button><div id="backup-last" style="margin-top:12px;font-size:12px;color:var(--text3)"></div></div><div class="card"><h3>☁️ حالة النسخ الاحتياطي</h3><div id="backup-status">جاري التحميل...</div></div></div><div class="content-grid" style="margin-top:16px"><div class="card"><h3>🧹 مسح الكاش</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">إذا واجهت مشاكل في تحميل التحديثات الجديدة، اضغط لمسح الكاش وإعادة تحميل التطبيق.</p><div id="cache-clear-msg" style="margin-bottom:12px;font-size:12px;color:var(--text3)">الإصدار المحلي: <strong>${localStorage.getItem('sara_app_version') || '-'}</strong></div><button class="btn btn-secondary" onclick="App.clearAppCache()">🧹 مسح الكاش وإعادة التحميل</button></div></div>`;
    if (screen === 'permissions') return `<div class="page-header"><h1>🔑 صلاحيات المستخدمين</h1><button class="btn btn-secondary" onclick="App.go('users')">← العودة إلى المستخدمين</button></div><div class="card"><div id="permissions-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div>`;
    if (screen === 'tasks') return `<div class="page-header"><h1>📋 المهام</h1></div><div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-sm ${App.taskStatusFilter==='all'?'btn-primary':'btn-secondary'}" onclick="App.setTaskStatusFilter('all')">الكل</button><button class="btn btn-sm ${App.taskStatusFilter==='pending'?'btn-primary':'btn-secondary'}" onclick="App.setTaskStatusFilter('pending')">معلق</button><button class="btn btn-sm ${App.taskStatusFilter==='in_progress'?'btn-primary':'btn-secondary'}" onclick="App.setTaskStatusFilter('in_progress')">قيد التنفيذ</button><button class="btn btn-sm ${App.taskStatusFilter==='done'?'btn-primary':'btn-secondary'}" onclick="App.setTaskStatusFilter('done')">منتهي</button></div><div id="tasks-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div>`;
    if (screen === 'client') return `<div class="page-header"><h1 id="client-detail-name">👤 تفاصيل العميل</h1><button class="btn btn-secondary" onclick="App.go('clients')">← العودة للعملاء</button></div><div id="client-detail"><div class="skeleton skeleton-card"></div></div>`;
    if (screen === 'project') return `<div class="page-header"><h1 id="project-detail-name">🏗️ تفاصيل المشروع</h1><button class="btn btn-secondary" onclick="App.go('clients')">← العودة للعملاء</button></div><div id="project-detail"><div class="skeleton skeleton-card"></div></div>`;
    if (screen === 'vendor') return `<div class="page-header"><h1 id="vendor-detail-name">🚚 تفاصيل المورد</h1><button class="btn btn-secondary" onclick="App.go('vendors')">← العودة للموردين</button></div><div id="vendor-detail"><div class="skeleton skeleton-card"></div></div>`;
    if (screen === 'master') return `<div class="page-header"><h1>📋 البيانات الأساسية</h1></div><div class="content-grid"><div class="card"><h3>📂 التصنيفات</h3>${Auth.can('master', 'add') ? `<button class="btn btn-primary" style="margin-bottom:12px" onclick="Crud.addSector()">+ إضافة تصنيفات</button>` : ''}<div id="sectors-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div><div class="card"><h3>📦 الأصناف / المواد</h3>${Auth.can('master', 'add') ? `<button class="btn btn-primary" style="margin-bottom:12px" onclick="Crud.addItem()">+ إضافة صنف</button>` : ''}<div id="items-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div></div><div class="content-grid" style="margin-top:16px"><div class="card"><h3>🏗️ أقسام المشاريع</h3>${Auth.can('master', 'add') ? `<button class="btn btn-primary" style="margin-bottom:12px" onclick="Crud.addWorkSection()">+ إضافة قسم</button>` : ''}<div id="work-sections-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div><div class="card"><h3>📋 بنود الأعمال</h3>${Auth.can('master', 'add') ? `<button class="btn btn-primary" style="margin-bottom:12px" onclick="Crud.addWorkItem()">+ إضافة بند</button>` : ''}<div id="work-items-tbl"><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div></div></div>`;


    return '';
    return '';
  },

  renderLogin() {
    document.getElementById('app').innerHTML = `<div class="auth-page"><div class="auth-card"><div class="auth-logo"><img src="logo.png" alt="Sara Abo Elelaa"><h1>سارة أبو العلا</h1><p>النظام المالي والمحاسبي</p></div><form data-form="login" class="auth-form"><div class="form-group"><label>اسم المستخدم</label><input type="text" name="username" required placeholder="admin" dir="ltr"></div><div class="form-group"><label>كلمة المرور</label><input type="password" name="password" required placeholder="••••••••" dir="ltr"></div><button type="submit" class="btn btn-primary btn-block">دخول</button></form></div></div>`;
  },

  renderRegister() {
    document.getElementById('app').innerHTML = `<div class="auth-page"><div class="auth-card"><div class="auth-logo"><img src="logo.png" alt="Sara Abo Elelaa"><h1>إضافة مستخدم جديد</h1></div><form data-form="register" class="auth-form"><div class="form-group"><label>اسم المستخدم</label><input type="text" name="username" required dir="ltr"></div><div class="form-group"><label>الاسم الكامل</label><input type="text" name="name" required></div><div class="form-group"><label>كلمة المرور</label><input type="password" name="password" required minlength="6" dir="ltr"></div><button type="submit" class="btn btn-primary btn-block">إنشاء</button></form></div></div>`;
  },

  async doLogin(form) {
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'جاري الدخول...';
    try {
      await Auth.login(fd.get('username'), fd.get('password'));
      this.startIdleTimer();
      await this.go('dashboard');
    } catch (e) {
      UI.toast('خطأ في الدخول: ' + e.message, 'error');
      btn.disabled = false; btn.textContent = 'دخول';
    }
  },

  async doRegister(form) {
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'جاري التسجيل...';
    try {
      await Auth.register(fd.get('username'), fd.get('password'), fd.get('name'));
      UI.toast('تم إنشاء الحساب');
      if (Auth.isAdmin()) this.go('users');
      else this.renderLogin();
    } catch (e) {
      UI.toast('خطأ: ' + e.message, 'error');
      btn.disabled = false; btn.textContent = 'تسجيل';
    }
  },

  doLogout() {
    if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
    this.stopIdleTimer();
    Auth.logout();
    this.renderLogin();
  },

  showError(msg) {
    document.getElementById('app').innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;text-align:center"><div style="font-size:48px">⚠️</div><h2 style="color:var(--red)">حدث خطأ</h2><p style="color:var(--text2);max-width:400px">${this.esc(msg)}</p><button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button></div>`;
  },


  // ─── UTILITIES ───
  table(headers, rows) {
    const cell = (c) => {
      if (c && typeof c === 'object' && c.html !== undefined) return String(c.html);
      return App.esc(c == null ? '' : String(c));
    };
    return `<div class="table-responsive"><table class="data-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },

  ilikeOr(fields, term) {
    if (!term) return '';
    const t = encodeURIComponent(`*${term}*`);
    return `&or=(${fields.map(f => `${f}.ilike.${t}`).join(',')})`;
  },

  attachSearch(containerId, placeholder = '🔍 بحث...', onSearch) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container.dataset.searchAttached) return;
    container.dataset.searchAttached = 'true';
    const searchId = containerId + '-search';
    const searchHtml = `<div class="table-search" style="margin-bottom:12px"><input type="text" id="${searchId}" placeholder="${placeholder}" style="width:100%;max-width:320px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:inherit;outline:none" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'" /></div>`;
    container.insertAdjacentHTML('beforebegin', searchHtml);
    const input = document.getElementById(searchId);
    if (typeof onSearch === 'function') {
      let debounceTimer;
      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => onSearch(e.target.value.trim()), 300);
      });
    } else {
      input.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        const table = container.querySelector('.data-table');
        if (table) {
          table.querySelectorAll('tbody tr').forEach(tr => { tr.style.display = tr.textContent.toLowerCase().includes(term) ? '' : 'none'; });
        }
        const cards = container.querySelectorAll('.card');
        if (cards.length) {
          cards.forEach(card => { card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none'; });
        }
      });
    }
  },

  loadLocalSettings() {
    try {
      const raw = localStorage.getItem('sara_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(this.settings, parsed);
      }
    } catch (e) { console.warn('[Settings] load failed', e); }
  },

  saveLocalSettings() {
    localStorage.setItem('sara_settings', JSON.stringify(this.settings));
  },

  fmtMoney(n) { return (+n || 0).toLocaleString('ar-EG') + ' ' + (this.settings?.currency_label || 'ج.م'); },
  fmtDate(d) { return d ? new Date(d).toLocaleDateString('ar-EG') : '-'; },
  fmtTxType(type) { const map = { project_deposit: 'عربون مشروع', project_expense: 'مصروف مشروع', office_expense: 'مصروف مكتبي', owner_deposit: 'توريد صاحب المكتب', owner_withdrawal: 'سحب صاحب المكتب', supervision: 'إشراف مشروع', design: 'تصميم مشروع', income: 'إيراد', expense: 'مصروف', deposit: 'عربون', withdrawal: 'سحب' }; return map[type] || type; },
};
