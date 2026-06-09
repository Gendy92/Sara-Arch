// Main App

const App = {
  screen: 'login',
  loading: false,

  async start() {
    try {
      await Auth.init();
      this.bindNav();
      if (Auth.isLoggedIn()) {
        this.startIdleTimer();
        await this.go('dashboard');
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

  async go(screen) {
    const isAdmin = Auth.user?.user_metadata?.role === 'admin';
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
    if (screen === 'transactions') await this.loadTransactions();
    if (screen === 'office') await this.loadOffice();
    if (screen === 'employees') await this.loadEmployees();
    if (screen === 'settings') await this.loadSettings();
    if (screen === 'users') await this.loadUsers();
    if (screen === 'permissions') await this.loadPermissionsScreen();
    if (screen === 'audit') await this.loadAuditLog();
    if (screen === 'backup') await this.loadBackup();
    if (screen === 'master') await this.loadMasterData();
  },

  layout(content) {
    const user = Auth.user || {};
    const name = user.displayName || user.user_metadata?.name || 'المستخدم';
    const isAdmin = user.user_metadata?.role === 'admin';
    const navItem = (screen, icon, label) => Auth.can(screen, 'view') ? `<button data-nav="${screen}" class="nav-item ${this.screen === screen ? 'active' : ''}"><span>${icon}</span> ${label}</button>` : '';
    const bnavItem = (screen, icon, label) => Auth.can(screen, 'view') ? `<button class="bottom-nav-item ${this.screen === screen ? 'active' : ''}" onclick="App.go('${screen}')"><span class="bottom-nav-icon">${icon}</span><span class="bottom-nav-label">${label}</span></button>` : '';
    const bottomNav = `<div class="bottom-nav"><div class="bottom-nav-inner">
      ${bnavItem('dashboard', '📊', 'الرئيسية')}
      ${bnavItem('clients', '👥', 'العملاء')}
      ${bnavItem('transactions', '💰', 'المالية')}
      ${bnavItem('vendors', '🚚', 'الموردين')}
      <button class="bottom-nav-item" onclick="App.toggleSidebar()"><span class="bottom-nav-icon">⚙️</span><span class="bottom-nav-label">المزيد</span></button>
    </div></div>`;
    return `<div class="app-layout"><aside class="sidebar" id="sidebar"><div class="sidebar-logo"><img src="logo.png" alt="Sara Abo Elelaa"><h2>سارة أبو العلا</h2><p>النظام المالي والمحاسبي</p></div><nav class="sidebar-nav">
      ${navItem('dashboard', '📊', 'الرئيسية')}
      ${navItem('clients', '👥', 'العملاء والمشاريع')}
      ${navItem('vendors', '🚚', 'الموردين')}
      ${navItem('transactions', '💰', 'معاملات المشاريع')}
      ${navItem('office', '🏢', 'المكتب')}
      ${navItem('employees', '🧑‍💼', 'الموظفين')}
      ${navItem('master', '📋', 'البيانات الأساسية')}
      ${isAdmin ? navItem('settings', '⚙️', 'الإعدادات') : ''}
    </nav><div class="sidebar-footer"><div class="user-info">${name}</div><div style="font-size:10px;color:var(--text3);text-align:center;margin-bottom:4px">${isAdmin ? '👑 مدير' : '👤 موظف'}</div><button data-action="logout" class="btn-logout">🚪 خروج</button></div></aside><div class="sidebar-backdrop" id="sidebar-backdrop" onclick="App.closeSidebar()"></div><button class="hamburger" id="hamburger-btn" onclick="App.toggleSidebar()"><span></span><span></span><span></span></button><main class="main-content">${content}</main>${bottomNav}</div>`;
  },

  pageContent(screen) {
    if (screen === 'dashboard') return `<div class="page-header"><h1>📊 لوحة التحكم</h1></div><div class="kpi-grid" id="kpis"><div class="kpi-card">جاري التحميل...</div></div><div class="card"><h3>💳 أرصدة العملاء (غير مسددين / مبالغ زائدة)</h3><div id="customer-balances">جاري التحميل...</div></div><div class="content-grid"><div class="card"><h3>🏪 الموردين النشطين</h3><div id="active-vendors">جاري التحميل...</div></div><div class="card"><h3>آخر المعاملات</h3><div id="recent-tx">جاري التحميل...</div></div></div><div class="card"><h3>المشاريع النشطة</h3><div id="active-proj">جاري التحميل...</div></div>`;
    if (screen === 'clients') return `<div class="page-header"><h1>👥 العملاء والمشاريع</h1>${Auth.can('clients', 'add') ? `<button class="btn btn-primary" onclick="Crud.addClient()">+ إضافة عميل</button>` : ''}</div><div id="clients-list">جاري التحميل...</div>`;
    if (screen === 'projects') { this.go('clients'); return ''; }
    if (screen === 'transactions') return `<div class="page-header"><h1>💰 معاملات المشاريع</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="Crud.addProjectDeposit()">💰 عربون مشروع</button><button class="btn btn-primary" onclick="Crud.addProjectExpense()">🔨 مصروف مشروع</button></div></div><div class="kpi-grid" id="tx-kpis"><div class="kpi-card">جاري التحميل...</div></div><div class="card"><div id="tx-tbl">جاري التحميل...</div></div>`;
    if (screen === 'office') return `<div class="page-header"><h1>🏢 حساب المكتب</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="Crud.addOfficeExpense()">🏢 مصروف مكتبي</button><button class="btn btn-primary" onclick="Crud.addOwnerDeposit()">👤 توريد صاحب المكتب</button><button class="btn btn-primary" onclick="Crud.addOwnerWithdrawal()">🏃 سحب صاحب المكتب</button></div></div><div class="kpi-grid" id="office-kpis"><div class="kpi-card">جاري التحميل...</div></div><div class="card" style="margin-top:16px"><h3>تفاصيل المعاملات</h3><div id="office-tbl">جاري التحميل...</div></div>`;
    if (screen === 'vendors') return `<div class="page-header"><h1>🚚 الموردين</h1>${Auth.can('vendors', 'add') ? `<button class="btn btn-primary" onclick="Crud.addVendor()">+ إضافة مورد</button>` : ''}</div><div class="card"><div id="vendors-tbl">جاري التحميل...</div></div>`;
    if (screen === 'employees') return `<div class="page-header"><h1>🧑‍💼 الموظفين</h1><button class="btn btn-primary" onclick="Crud.addEmp()">+ إضافة موظفين</button></div><div class="card"><div id="emp-tbl">جاري التحميل...</div></div><div class="card" style="margin-top:16px"><h3>📤 رفع ملف البصمة</h3><div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap"><input type="file" id="fingerprint-file" accept=".xlsx,.xls,.csv" onchange="App.parseFingerprintFile(this)" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit;font-size:13px;max-width:280px"><span style="font-size:12px;color:var(--text3)">الشهر:</span><select id="fp-month" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${m === new Date().getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}</select><span style="font-size:12px;color:var(--text3)">السنة:</span><select id="fp-year" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('')}</select></div><div id="fingerprint-preview">لم يتم اختيار ملف</div></div><div class="card" style="margin-top:16px"><h3>💰 الرواتب الشهرية</h3><div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap"><label style="font-size:13px">الشهر:</label><select id="emp-payroll-month" onchange="App.loadEmpPayroll()" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${m === new Date().getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}</select><label style="font-size:13px">السنة:</label><select id="emp-payroll-year" onchange="App.loadEmpPayroll()" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('')}</select><button class="btn btn-primary" onclick="App.generateEmpPayroll()">🔄 توليد الرواتب</button></div><div id="emp-payroll-tbl">جاري التحميل...</div></div>`;
    if (screen === 'settings') return `<div class="page-header"><h1>⚙️ الإعدادات</h1></div><div class="content-grid"><div class="card"><h3>🔐 المستخدمين والصلاحيات</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">إدارة حسابات المستخدمين وصلاحيات الوصول للشاشات.</p><button class="btn btn-primary" onclick="App.go('users')">فتح المستخدمين</button></div><div class="card"><h3>💾 النسخ الاحتياطي</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">تحميل نسخة احتياطية ومراجعة حالة الجداول.</p><button class="btn btn-primary" onclick="App.go('backup')">فتح النسخ الاحتياطي</button></div><div class="card"><h3>📜 سجل العمليات</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">متابعة التعديلات والإضافات على قاعدة البيانات.</p><button class="btn btn-primary" onclick="App.go('audit')">فتح السجل</button></div></div>`;
    if (screen === 'users') return `<div class="page-header"><h1>🔐 إدارة المستخدمين</h1><div style="display:flex;gap:8px;flex-wrap:wrap">${Auth.can('users', 'add') ? `<button class="btn btn-primary" onclick="Crud.addUser()">+ إضافة مستخدمين</button>` : ''}<button class="btn btn-secondary" onclick="App.go('permissions')">🔑 صلاحيات المستخدمين</button></div></div><div class="card"><div id="users-tbl">جاري التحميل...</div></div>`;
    if (screen === 'audit') return `<div class="page-header"><h1>📜 سجل العمليات</h1></div><div class="card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap"><label style="font-size:13px">الجدول:</label><select id="audit-table" onchange="App.loadAuditLog()" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit"><option value="">الكل</option><option value="clients">العملاء</option><option value="projects">المشاريع</option><option value="employees">الموظفين</option><option value="vendors">الموردين</option><option value="transactions">معاملات المشاريع</option><option value="procurements">المشتريات</option><option value="payroll_records">الرواتب</option></select><button class="btn btn-secondary" onclick="App.loadAuditLog()">🔄 تحديث</button></div><div id="audit-tbl">جاري التحميل...</div></div>`;
    if (screen === 'backup') return `<div class="page-header"><h1>💾 النسخ الاحتياطي</h1></div><div class="content-grid"><div class="card"><h3>📥 نسخ احتياطي محلي</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">حمّل نسخة كاملة من قاعدة البيانات على جهازك كملف ZIP.</p><div id="backup-progress" style="margin-bottom:12px"></div><button class="btn btn-primary" onclick="App.downloadLocalBackup()">📥 تحميل النسخة الاحتياطية</button><div id="backup-last" style="margin-top:12px;font-size:12px;color:var(--text3)"></div></div><div class="card"><h3>☁️ حالة النسخ الاحتياطي</h3><div id="backup-status">جاري التحميل...</div></div></div><div class="content-grid" style="margin-top:16px"><div class="card"><h3>🧹 مسح الكاش</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">إذا واجهت مشاكل في تحميل التحديثات الجديدة، اضغط لمسح الكاش وإعادة تحميل التطبيق.</p><div id="cache-clear-msg" style="margin-bottom:12px;font-size:12px;color:var(--text3)">الإصدار المحلي: <strong>${localStorage.getItem('sara_app_version') || '-'}</strong></div><button class="btn btn-secondary" onclick="App.clearAppCache()">🧹 مسح الكاش وإعادة التحميل</button></div></div>`;
    if (screen === 'permissions') return `<div class="page-header"><h1>🔑 صلاحيات المستخدمين</h1><button class="btn btn-secondary" onclick="App.go('users')">← العودة إلى المستخدمين</button></div><div class="card"><div id="permissions-tbl">جاري التحميل...</div></div>`;
    if (screen === 'master') return `<div class="page-header"><h1>📋 البيانات الأساسية</h1></div><div class="content-grid"><div class="card"><h3>📂 التصنيفات</h3>${Auth.can('master', 'add') ? `<button class="btn btn-primary" style="margin-bottom:12px" onclick="Crud.addSector()">+ إضافة تصنيفات</button>` : ''}<div id="sectors-tbl">جاري التحميل...</div></div><div class="card"><h3>📦 الأصناف / البنود</h3>${Auth.can('master', 'add') ? `<button class="btn btn-primary" style="margin-bottom:12px" onclick="Crud.addItem()">+ إضافة أصناف</button>` : ''}<div id="items-tbl">جاري التحميل...</div></div></div>${Auth.can('master', 'add') ? `<div class="card" style="margin-top:16px"><h3>📤 رفع أقسام وبنود من Excel</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px">الملف يجب أن يحتوي على عمودين على الأقل: القسم والبند. يمكن إضافة عمود ملاحظات اختياري.</p><input type="file" id="work-sections-items-file" accept=".xlsx,.xls,.csv" onchange="App.parseWorkSectionsItemsFile(this)" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit;font-size:13px;max-width:320px"><div id="work-sections-items-preview" style="margin-top:16px">لم يتم اختيار ملف</div></div>` : ''}<div class="content-grid" style="margin-top:16px"><div class="card"><h3>🏗️ أقسام المشاريع</h3>${Auth.can('master', 'add') ? `<button class="btn btn-primary" style="margin-bottom:12px" onclick="Crud.addWorkSection()">+ إضافة قسم</button>` : ''}<div id="work-sections-tbl">جاري التحميل...</div></div><div class="card"><h3>📋 بنود الأعمال</h3>${Auth.can('master', 'add') ? `<button class="btn btn-primary" style="margin-bottom:12px" onclick="Crud.addWorkItem()">+ إضافة بند</button>` : ''}<div id="work-items-tbl">جاري التحميل...</div></div></div>`;
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
      alert('خطأ في الدخول: ' + e.message);
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
      if (Auth.user?.user_metadata?.role === 'admin') this.go('users');
      else this.renderLogin();
    } catch (e) {
      alert('خطأ: ' + e.message);
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
    document.getElementById('app').innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;text-align:center"><div style="font-size:48px">⚠️</div><h2 style="color:var(--red)">حدث خطأ</h2><p style="color:var(--text2);max-width:400px">${msg}</p><button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button></div>`;
  },

  // ─── DATA LOADING ───
  async loadDashboard() {
    try {
      const [clients, projects, employees, txs] = await Promise.all([
        API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null'),
        API.request('employees', 'GET', null, '?select=id&is_active=eq.true&deleted_at=is.null'),
        API.request('transactions', 'GET', null, '?select=*&deleted_at=is.null')
      ]);
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const totalIncome = txs.filter(t => ['project_deposit','owner_deposit'].includes(t.type)).reduce((s, t) => s + (+t.amount || 0), 0);
      const totalExp = txs.filter(t => ['project_expense','office_expense'].includes(t.type)).reduce((s, t) => s + (+t.amount || 0), 0);
      document.getElementById('kpis').innerHTML = `
        <div class="kpi-card"><div class="kpi-icon">👥</div><div class="kpi-label">العملاء</div><div class="kpi-value">${clients.length}</div></div>
        <div class="kpi-card"><div class="kpi-icon">📁</div><div class="kpi-label">المشاريع</div><div class="kpi-value">${projects.length}</div></div>
        <div class="kpi-card"><div class="kpi-icon">✅</div><div class="kpi-label">النشطة</div><div class="kpi-value" style="color:var(--green)">${activeProjects}</div></div>
        <div class="kpi-card"><div class="kpi-icon">🧑‍💼</div><div class="kpi-label">الموظفين</div><div class="kpi-value">${employees.length}</div></div>
        <div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-label">إجمالي الحركة</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(totalIncome + totalExp)}</div></div>`;
      // Monthly bar chart
      const months = {};
      txs.forEach(t => {
        const m = (t.date || t.created_at || '').slice(0, 7);
        if (!m) return;
        if (!months[m]) months[m] = { inc: 0, exp: 0 };
        if (['project_deposit','owner_deposit'].includes(t.type)) months[m].inc += (+t.amount || 0);
        else if (['project_expense','office_expense'].includes(t.type)) months[m].exp += (+t.amount || 0);
      });
      const monthKeys = Object.keys(months).sort().slice(-6);
      const maxVal = Math.max(...monthKeys.map(m => Math.max(months[m].inc, months[m].exp)), 1);
      const chartHtml = monthKeys.length ? `
        <div class="card"><h3>📈 الحركة الشهرية</h3>
        <div class="chart-container">
          ${monthKeys.map(m => {
            const ih = Math.round((months[m].inc / maxVal) * 140);
            const eh = Math.round((months[m].exp / maxVal) * 140);
            return `<div class="chart-bar">
              <div class="chart-bars">
                <div style="flex:1;height:${ih}px;background:var(--green);border-radius:4px 4px 0 0;min-height:3px" title="وارد: ${this.fmtMoney(months[m].inc)}"></div>
                <div style="flex:1;height:${eh}px;background:var(--red);border-radius:4px 4px 0 0;min-height:3px" title="منصرف: ${this.fmtMoney(months[m].exp)}"></div>
              </div>
              <span class="chart-bar-label">${m.slice(5)}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="chart-legend">
          <span><i style="background:var(--green)"></i> وارد</span>
          <span><i style="background:var(--red)"></i> منصرف</span>
        </div>
        </div>` : '';
      if (chartHtml) document.getElementById('kpis').insertAdjacentHTML('afterend', chartHtml);
      // Customer balances
      const deposits = txs.filter(t => t.type === 'project_deposit');
      const expenses = txs.filter(t => t.type === 'project_expense');
      const expByProject = {};
      const designByProject = {};
      expenses.forEach(t => {
        const amt = +t.amount || 0;
        expByProject[t.project_id] = (expByProject[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') {
          designByProject[t.project_id] = (designByProject[t.project_id] || 0) + amt;
        }
      });
      const projByClient = {};
      projects.forEach(p => { if (!projByClient[p.client_id]) projByClient[p.client_id] = []; projByClient[p.client_id].push(p); });
      const depByClient = {};
      deposits.forEach(t => { depByClient[t.client_id] = (depByClient[t.client_id] || 0) + (+t.amount || 0); });
      // Show balances for all clients with active projects
      const activeClientIds = new Set(projects.filter(p => p.status === 'active').map(p => p.client_id));
      const balanceRows = clients.filter(c => activeClientIds.has(c.id)).map(c => {
        const clientProjects = projByClient[c.id] || [];
        let totalExp = 0;
        let totalSup = 0;
        clientProjects.forEach(p => {
          const exp = expByProject[p.id] || 0;
          const design = designByProject[p.id] || 0;
          const constr = exp - design;
          totalExp += exp;
          totalSup += constr * (p.supervision_percentage || 0) / 100;
        });
        const dep = depByClient[c.id] || 0;
        const balance = dep - totalExp - totalSup;
        const color = balance >= 0 ? 'var(--green)' : 'var(--red)';
        return { name: c.name, dep, totalExp, totalSup, balance, color, html: [c.name, this.fmtMoney(dep), this.fmtMoney(totalExp), this.fmtMoney(totalSup), `<span style="color:${color};font-weight:700">${this.fmtMoney(balance)}</span>`] };
      });
      const sortedBalances = balanceRows.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
      document.getElementById('customer-balances').innerHTML = sortedBalances.length ? this.table(['العميل', 'الوارد', 'المصروفات', 'الإشراف', 'الرصيد'], sortedBalances.map(r => r.html)) : '<p style="color:var(--text3)">لا يوجد عملاء نشطين</p>';
      // Unsettled vendors (balance ≠ 0)
      const [vendors, vendorTxs, procs] = await Promise.all([
        API.request('vendors', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc'),
        API.request('transactions', 'GET', null, "?select=vendor_id,amount&type=eq.project_expense&deleted_at=is.null"),
        API.request('procurements', 'GET', null, '?select=vendor_id,total_price&deleted_at=is.null')
      ]);
      const paymentsByVendor = {};
      vendorTxs.forEach(t => { paymentsByVendor[t.vendor_id] = (paymentsByVendor[t.vendor_id] || 0) + (+t.amount || 0); });
      const purchasesByVendor = {};
      procs.forEach(p => { purchasesByVendor[p.vendor_id] = (purchasesByVendor[p.vendor_id] || 0) + (+p.total_price || 0); });
      const unsettledVendors = vendors.map(v => {
        const purchases = purchasesByVendor[v.id] || 0;
        const payments = paymentsByVendor[v.id] || 0;
        const balance = purchases - payments;
        return { ...v, purchases, payments, balance };
      }).filter(v => v.balance !== 0);
      const sortedVendors = unsettledVendors.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
      const vendorRows = sortedVendors.map(v => {
        const color = v.balance > 0 ? 'var(--red)' : 'var(--green)';
        const status = v.balance > 0 ? 'علينا' : 'له';
        return [v.name, v.vendor_type === 'merchandise' ? 'بضاعة' : 'خدمات', App.fmtMoney(v.purchases), App.fmtMoney(v.payments), `<span style="color:${color};font-weight:700">${App.fmtMoney(Math.abs(v.balance))}</span>`, status, `<button class="btn btn-sm btn-primary" onclick="Crud.vendorStatement('${v.id}')">كشف حساب</button>`];
      });
      document.getElementById('active-vendors').innerHTML = vendorRows.length ? this.table(['المورد', 'النوع', 'مشتريات', 'مدفوعات', 'الرصيد', 'الحالة', 'الإجراءات'], vendorRows) : '<p style="color:var(--text3)">لا يوجد موردين غير مسددين</p>';

      const recent = await API.request('transactions', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc&limit=5');
      document.getElementById('recent-tx').innerHTML = recent.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف'], recent.map(t => [this.fmtDate(t.created_at), t.type, this.fmtMoney(t.amount), t.description || '-'])) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      const active = await API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&status=eq.active&limit=5');
      document.getElementById('active-proj').innerHTML = active.length ? this.table(['المشروع', 'العميل', 'الحالة'], active.map(p => [p.name, p.client_name || '-', '<span class="badge badge-green">نشط</span>'])) : '<p style="color:var(--text3)">لا توجد مشاريع نشطة</p>';
    } catch (e) { console.error(e); }
  },

  async loadClients() {
    try {
      const [clients, projects, expenses, deposits] = await Promise.all([
        API.request('clients', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc'),
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc'),
        API.request('transactions', 'GET', null, "?select=*&type=eq.project_expense&deleted_at=is.null"),
        API.request('transactions', 'GET', null, "?select=project_id,amount&type=eq.project_deposit&deleted_at=is.null")
      ]);
      const expByProject = {};
      const designByProject = {};
      expenses.forEach(t => {
        const amt = +t.amount || 0;
        expByProject[t.project_id] = (expByProject[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') {
          designByProject[t.project_id] = (designByProject[t.project_id] || 0) + amt;
        }
      });
      const depByProject = {};
      deposits.forEach(t => { depByProject[t.project_id] = (depByProject[t.project_id] || 0) + (+t.amount || 0); });
      const projByClient = {};
      projects.forEach(p => { projByClient[p.client_id] = projByClient[p.client_id] || []; projByClient[p.client_id].push(p); });

      if (!clients.length) {
        document.getElementById('clients-list').innerHTML = '<p style="color:var(--text3)">لا يوجد عملاء</p>';
        return;
      }

      const html = clients.map(c => {
        const cProjects = projByClient[c.id] || [];
        const clientActions = UI.actions(c.id, 'Crud.editClient', 'Crud.delClient', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.clientStatement('${c.id}')">كشف حساب</button>`;
        const projRows = cProjects.map(p => {
          const exp = expByProject[p.id] || 0;
          const design = designByProject[p.id] || 0;
          const constr = exp - design;
          const dep = depByProject[p.id] || 0;
          const supAmt = constr * (p.supervision_percentage || 0) / 100;
          const pActions = UI.actions(p.id, 'Crud.editProject', 'Crud.delProject', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${p.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.projectBudget('${p.id}')">📊 ميزانية</button>`;
          return [p.name, p.address || '-', this.fmtMoney(p.value), this.fmtMoney(exp), (p.supervision_percentage || 0) + '%', this.fmtMoney(supAmt), `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${p.status}</span>`, pActions];
        });
        const projTable = cProjects.length ? this.table(['المشروع', 'العنوان', 'القيمة', 'مصروفات', 'إشراف %', 'إشراف', 'الحالة', 'الإجراءات'], projRows) : '<p style="color:var(--text3);padding:8px 0">لا توجد مشاريع لهذا العميل</p>';
        return `<div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div>
              <h3 style="margin-bottom:4px">${c.name}</h3>
              <div style="font-size:12px;color:var(--text2)">${c.phone || '-'} · ${c.email || '-'} · ${c.address || '-'}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${clientActions}</div>
          </div>
          <div style="margin-bottom:12px"><button class="btn btn-sm btn-secondary" onclick="Crud.addProject('${c.id}')">+ إضافة مشروع</button></div>
          ${projTable}
        </div>`;
      }).join('');
      document.getElementById('clients-list').innerHTML = html;
      this.attachSearch('clients-list', '🔍 بحث في العملاء أو المشاريع...');
    } catch (e) { console.error(e); }
  },

  async loadProjects() {
    try {
      const [data, expenses] = await Promise.all([
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc'),
        API.request('transactions', 'GET', null, "?select=*&type=eq.project_expense&deleted_at=is.null")
      ]);
      const expByProject = {};
      const designByProject = {};
      expenses.forEach(t => {
        const amt = +t.amount || 0;
        expByProject[t.project_id] = (expByProject[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') {
          designByProject[t.project_id] = (designByProject[t.project_id] || 0) + amt;
        }
      });
      document.getElementById('projects-tbl').innerHTML = data.length ? this.table(['المشروع', 'العميل', 'العنوان', 'القيمة', 'مصروفات', 'إشراف %', 'إشراف', 'الحالة', 'الإجراءات'], data.map(p => {
        const exp = expByProject[p.id] || 0;
        const design = designByProject[p.id] || 0;
        const constr = exp - design;
        const supAmt = constr * (p.supervision_percentage || 0) / 100;
        const actions = UI.actions(p.id, 'Crud.editProject', 'Crud.delProject') + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${p.id}')">كشف حساب</button>`;
        return [p.name, p.client_name || '-', p.address || '-', this.fmtMoney(p.value), this.fmtMoney(exp), (p.supervision_percentage || 0) + '%', this.fmtMoney(supAmt), `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${p.status}</span>`, actions];
      })) : '<p style="color:var(--text3)">لا توجد مشاريع</p>';
    } catch (e) { console.error(e); }
  },

  async loadVendors() {
    try {
      const data = await API.request('vendors', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc');
      document.getElementById('vendors-tbl').innerHTML = data.length ? this.table(['الاسم', 'النوع', 'التخصص', 'الشخص المسؤول', 'الهاتف', 'الإجراءات'], data.map(v => {
        const typeBadge = v.vendor_type === 'merchandise' ? '<span class="badge badge-gold">بضاعة</span>' : '<span class="badge badge-gray">خدمات</span>';
        const actions = UI.actions(v.id, 'Crud.editVendor', 'Crud.delVendor', Auth.can('vendors', 'edit'), Auth.can('vendors', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.vendorStatement('${v.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.vendorPurchases('${v.id}')">💰 مشتريات</button>`;
        return [v.name, typeBadge, v.sector || '-', v.contact_person || '-', v.phone || '-', actions];
      })) : '<p style="color:var(--text3)">لا يوجد موردين</p>';
      this.attachSearch('vendors-tbl', '🔍 بحث في الموردين...');
    } catch (e) { console.error(e); }
  },

  async loadTransactions() {
    try {
      const [data, projects, projectExpenses, allProjTxs] = await Promise.all([
        API.request('transactions', 'GET', null, "?select=*&type=in.(project_deposit,project_expense)&deleted_at=is.null&order=created_at.desc&limit=50"),
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null'),
        API.request('transactions', 'GET', null, "?select=*&type=eq.project_expense&deleted_at=is.null"),
        API.request('transactions', 'GET', null, '?select=*&deleted_at=is.null')
      ]);
      // KPIs
      const deposits = allProjTxs.filter(t => t.type === 'project_deposit').reduce((s, t) => s + (+t.amount || 0), 0);
      const expenses = allProjTxs.filter(t => t.type === 'project_expense').reduce((s, t) => s + (+t.amount || 0), 0);
      const expByProject = {};
      const designByProject = {};
      projectExpenses.forEach(t => {
        const amt = +t.amount || 0;
        expByProject[t.project_id] = (expByProject[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') {
          designByProject[t.project_id] = (designByProject[t.project_id] || 0) + amt;
        }
      });
      const supervision = projects.reduce((s, p) => {
        const exp = expByProject[p.id] || 0;
        const design = designByProject[p.id] || 0;
        return s + ((exp - design) * (p.supervision_percentage || 0) / 100);
      }, 0);
      const balance = deposits - expenses - supervision;
      document.getElementById('tx-kpis').innerHTML = `
        <div class="kpi-card"><div class="kpi-label">إجمالي الوارد</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(deposits)}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expenses)}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي الإشراف</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(supervision)}</div></div>
        <div class="kpi-card"><div class="kpi-label">رصيد المشروعات</div><div class="kpi-value" style="color:var(--blue)">${this.fmtMoney(balance)}</div></div>`;
      // Table
      const expByProj = {};
      const designByProj = {};
      projectExpenses.forEach(t => {
        const amt = +t.amount || 0;
        expByProj[t.project_id] = (expByProj[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') {
          designByProj[t.project_id] = (designByProj[t.project_id] || 0) + amt;
        }
      });
      const supRows = projects.map(p => {
        const exp = expByProj[p.id] || 0;
        const design = designByProj[p.id] || 0;
        const constr = exp - design;
        const supAmt = constr * (p.supervision_percentage || 0) / 100;
        const rows = [];
        if (supAmt > 0) rows.push({ created_at: p.created_at, type: 'supervision', amount: supAmt, employee_name: '-', sector_name: '-', party_name: '-', project_name: p.name, description: `إشراف ${p.name} (${p.supervision_percentage || 0}%)` });
        return rows;
      }).filter(Boolean);
      const allTxs = [...data, ...supRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      document.getElementById('tx-tbl').innerHTML = allTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف', 'الجهة', 'المشروع', 'طريقة الدفع', 'الإجراءات'], allTxs.map(t => {
        const badgeColor = t.type === 'project_deposit' ? 'green' : 'red';
        let party;
        if (t.type === 'project_expense') {
          party = t.party_name || '-';
          if (t.vendor_name) party += ' ← ' + t.vendor_name;
          if (t.expense_category === 'design') party += ' <span class="badge badge-gray" style="font-size:10px">تصميم</span>';
        } else {
          party = t.vendor_name || t.employee_name || t.party_name || t.sector_name || '-';
        }
        const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '-';
        const termLabels = { immediate: 'فوري', credit: 'اجل', settlement: 'تسديد' };
        const pt = t.payment_term ? `<span class="badge badge-${t.payment_term === 'immediate' ? 'green' : t.payment_term === 'credit' ? 'orange' : 'blue'}" style="font-size:10px">${termLabels[t.payment_term] || t.payment_term}</span>` : (t.type === 'project_deposit' ? pm : '-');
        const actions = t.type === 'supervision' && !t.id ? '-' : UI.actions(t.id, 'Crud.editTx', 'Crud.delTx');
        return [this.fmtDate(t.created_at), `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`, this.fmtMoney(t.amount), t.description || '-', party, t.project_name || '-', pt, actions];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      this.attachSearch('tx-tbl', '🔍 بحث في معاملات المشاريع...');
    } catch (e) { console.error(e); }
  },


  async loadOffice() {
    try {
      const [incomeTxs, expenseTxs, projects, projectExpenses] = await Promise.all([
        API.request('transactions', 'GET', null, "?select=*&type=eq.owner_deposit&deleted_at=is.null&order=created_at.desc"),
        API.request('transactions', 'GET', null, "?select=*&type=in.(office_expense,withdrawal)&deleted_at=is.null&order=created_at.desc"),
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null'),
        API.request('transactions', 'GET', null, "?select=*&type=eq.project_expense&deleted_at=is.null")
      ]);
      const txIncome = incomeTxs.reduce((s, t) => s + (+t.amount || 0), 0);
      const expByProject = {};
      const designByProject = {};
      projectExpenses.forEach(t => {
        const amt = +t.amount || 0;
        expByProject[t.project_id] = (expByProject[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') {
          designByProject[t.project_id] = (designByProject[t.project_id] || 0) + amt;
        }
      });
      const calcSupervision = projects.reduce((s, p) => {
        const exp = expByProject[p.id] || 0;
        const design = designByProject[p.id] || 0;
        return s + ((exp - design) * (p.supervision_percentage || 0) / 100);
      }, 0);
      const totalIncome = txIncome + calcSupervision;
      const expense = expenseTxs.reduce((s, t) => s + (+t.amount || 0), 0);
      document.getElementById('office-kpis').innerHTML = `
        <div class="kpi-card" style="border-top:4px solid var(--green)"><div class="kpi-label">إيرادات المكتب</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(totalIncome)}</div><div style="font-size:12px;color:var(--text3);margin-top:6px">إشراف: ${this.fmtMoney(calcSupervision)} &nbsp;|&nbsp; توريدات: ${this.fmtMoney(txIncome)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--red)"><div class="kpi-label">مصروفات المكتب</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expense)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--gold)"><div class="kpi-label">رصيد المكتب</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(totalIncome - expense)}</div></div>`;
      const supRows = projects.map(p => {
        const exp = expByProject[p.id] || 0;
        const design = designByProject[p.id] || 0;
        const constr = exp - design;
        const supAmt = constr * (p.supervision_percentage || 0) / 100;
        const rows = [];
        if (supAmt > 0) rows.push({ created_at: p.created_at, type: 'supervision', amount: supAmt, employee_name: '-', sector_name: '-', description: `إشراف ${p.name}` });
        return rows;
      }).filter(Boolean);
      const allTxs = [...incomeTxs, ...expenseTxs, ...supRows.flat()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      document.getElementById('office-tbl').innerHTML = allTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الموظف', 'التصنيف', 'الوصف', 'الإجراءات'], allTxs.map(t => {
        const badgeColor = ['owner_deposit','supervision'].includes(t.type) ? 'green' : 'red';
        const actions = t.id ? UI.actions(t.id, 'Crud.editTx', 'Crud.delTx') : '-';
        return [this.fmtDate(t.created_at), `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`, this.fmtMoney(t.amount), t.employee_name || '-', t.sector_name || '-', t.description || '-', actions];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      this.attachSearch('office-tbl', '🔍 بحث في معاملات المكتب...');
    } catch (e) { console.error(e); }
  },

  async loadEmployees() {
    try {
      const data = await API.request('employees', 'GET', null, '?select=*&is_active=eq.true&deleted_at=is.null&order=created_at.desc');
      const empIds = data.map(e => e.id);
      const custodyData = await API.request('custody_records', 'GET', null, `?select=employee_id,amount,status&employee_id=in.(${empIds.join(',')})&deleted_at=is.null`);
      const custodyByEmp = {};
      custodyData.forEach(c => { custodyByEmp[c.employee_id] = (custodyByEmp[c.employee_id] || 0) + (+c.amount || 0); });
      document.getElementById('emp-tbl').innerHTML = data.length ? this.table(['الاسم', 'الوظيفة', 'الراتب', 'العهدة النشطة', 'الإجراءات'], data.map(e => {
        const cAmt = custodyByEmp[e.id] || 0;
        const custodyBadge = cAmt > 0 ? `<span class="badge badge-green">${this.fmtMoney(cAmt)}</span>` : '-';
        const actions = UI.actions(e.id, 'Crud.editEmp', 'Crud.delEmp', Auth.can('employees', 'edit'), Auth.can('employees', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.employeeCustody('${e.id}')">العهدة</button> <button class="btn btn-sm btn-secondary" onclick="Crud.employeeAttendance('${e.id}')">الحضور</button>`;
        return [e.name, e.job_title || '-', this.fmtMoney(e.salary), custodyBadge, actions];
      })) : '<p style="color:var(--text3)">لا يوجد موظفين</p>';
      this.attachSearch('emp-tbl', '🔍 بحث في الموظفين...');
      await this.loadEmpPayroll();
    } catch (e) { console.error(e); }
  },

  // ─── FINGERPRINT FILE UPLOAD ───
  async parseFingerprintFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      UI.toast('مكتبة Excel لم يتم تحميلها — تأكد من اتصال الإنترنت', 'error');
      return;
    }
    const preview = document.getElementById('fingerprint-preview');
    preview.innerHTML = '<p style="color:var(--text3)">جاري قراءة الملف...</p>';
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(new Uint8Array(e.target.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
      if (!json.length || json.length < 2) {
        preview.innerHTML = '<p style="color:var(--red)">الملف فارغ أو غير صالح</p>';
        return;
      }
      const headers = (json[0] || []).map(h => String(h || '').trim());
      const lowerHeaders = headers.map(h => h.toLowerCase());
      // Auto-detect columns
      const findCol = patterns => {
        for (let i = 0; i < lowerHeaders.length; i++) {
          if (!lowerHeaders[i]) continue;
          for (const p of patterns) { if (lowerHeaders[i].includes(p)) return i; }
        }
        return -1;
      };
      const colName = findCol(['name', 'employee', 'user', 'الاسم', 'الموظف', 'emp', 'العامل']);
      const colDate = findCol(['date', 'day', 'التاريخ', 'يوم']);
      const colIn = findCol(['in', 'check in', 'time in', 'الدخول', 'حضور', 'login', 'entry', 'وقت']);
      const colOut = findCol(['out', 'check out', 'time out', 'الخروج', 'انصراف', 'logout', 'exit']);

      if (colName < 0 || colDate < 0) {
        preview.innerHTML = `<p style="color:var(--red)">لم يتم التعرف على الأعمدة المطلوبة. العناوين المكتشفة: ${headers.join(' | ')}</p><p style="color:var(--text3);font-size:12px">المطلوب: عمود الاسم + عمود التاريخ (اختياري: دخول/خروج)</p>`;
        return;
      }

      const employees = await API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc');
      const empByName = {};
      employees.forEach(e => { empByName[e.name.trim().toLowerCase()] = e; });

      const parsed = [];
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!Array.isArray(row) || row.length <= colName || !row[colName]) continue;
        const rawName = String(row[colName]).trim();
        const rawDate = (colDate >= 0 && colDate < row.length) ? row[colDate] : null;
        const rawIn = (colIn >= 0 && colIn < row.length) ? row[colIn] : null;
        const rawOut = (colOut >= 0 && colOut < row.length) ? row[colOut] : null;

        // Parse date (handle Excel serial numbers, Date objects, and strings)
        let dateStr = null;
        if (rawDate) {
          if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().slice(0, 10);
          } else if (typeof rawDate === 'number') {
            // Excel serial date → JS Date
            const epoch = new Date(1899, 11, 30);
            const fixed = rawDate > 60 ? rawDate - 1 : rawDate; // Excel 1900 leap year bug
            const d = new Date(epoch.getTime() + fixed * 86400000);
            dateStr = d.toISOString().slice(0, 10);
          } else {
            const s = String(rawDate).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) dateStr = s;
            else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
              const [d, m, y] = s.split(/[\/\-]/);
              dateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            }
          }
        }

        // Find employee
        const searchName = rawName.toLowerCase();
        let emp = empByName[searchName];
        if (!emp) {
          emp = employees.find(e => {
            const en = e.name.trim().toLowerCase();
            return searchName.includes(en) || en.includes(searchName);
          });
        }

        // Determine status
        let status = 'present';
        let checkIn = rawIn ? String(rawIn).trim() : null;
        let checkOut = rawOut ? String(rawOut).trim() : null;
        if (!checkIn && !checkOut) status = 'absent';
        else if (checkIn && !checkOut) status = 'half_day';
        else if (checkIn) {
          const inTime = checkIn.replace(/[^0-9:]/g, '');
          if (inTime > '09:15') status = 'late';
        }

        parsed.push({
          rawName, employee_id: emp ? emp.id : null, employee_name: emp ? emp.name : rawName,
          date: dateStr, status, check_in: checkIn, check_out: checkOut, matched: !!emp
        });
      }

      // Build preview table
      const fpMonth = +document.getElementById('fp-month').value;
      const fpYear = +document.getElementById('fp-year').value;
      const rows = parsed.map((p, idx) => [
        idx + 1, p.rawName, p.matched ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">✗</span>',
        p.date || '-', p.status === 'present' ? 'حاضر' : p.status === 'absent' ? 'غائب' : p.status === 'late' ? 'متأخر' : p.status === 'half_day' ? 'نصف يوم' : p.status,
        p.check_in || '-', p.check_out || '-'
      ]);
      const unmatched = parsed.filter(p => !p.matched).length;
      const summary = `<div style="margin-bottom:12px;font-size:13px"><span style="color:var(--green)">✓ متطابق: ${parsed.length - unmatched}</span> &nbsp;|&nbsp; <span style="color:var(--red)">✗ غير متطابق: ${unmatched}</span> &nbsp;|&nbsp; إجمالي: ${parsed.length}</div>`;
      const saveBtn = `<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="App.saveFingerprintAttendance()">💾 حفظ الحضور في قاعدة البيانات</button></div>`;
      const table = rows.length ? App.table(['#', 'الاسم في الملف', 'تطابق', 'التاريخ', 'الحالة', 'دخول', 'خروج'], rows) : '<p style="color:var(--text3)">لا توجد بيانات</p>';
      preview.innerHTML = saveBtn + summary + table;
      preview.dataset.parsed = JSON.stringify(parsed);
      preview.dataset.month = fpMonth;
      preview.dataset.year = fpYear;
    } catch (e) {
      console.error(e);
      preview.innerHTML = '<p style="color:var(--red)">خطأ في قراءة الملف: ' + (e.message || '') + '</p>';
    }
  },

  async saveFingerprintAttendance() {
    const preview = document.getElementById('fingerprint-preview');
    const parsed = JSON.parse(preview.dataset.parsed || '[]');
    if (!parsed.length) { UI.toast('لا يوجد بيانات للحفظ', 'error'); return; }
    const month = +preview.dataset.month;
    const year = +preview.dataset.year;
    const records = parsed.filter(p => p.employee_id && p.date).map(p => ({
      employee_id: p.employee_id, employee_name: p.employee_name,
      date: p.date, status: p.status, check_in: p.check_in, check_out: p.check_out
    }));
    if (!records.length) { UI.toast('لا توجد سجلات صالحة للحفظ', 'error'); return; }
    try {
      // Upsert: delete old records for same month first, then insert new
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const end = `${year}-${String(month).padStart(2,'0')}-31`;
      const existing = await API.request('attendance_records', 'GET', null, `?select=id&date=gte.${start}&date=lte.${end}&deleted_at=is.null`);
      // Soft delete old
      for (const ex of existing) {
        await API.request('attendance_records', 'PATCH', { deleted_at: new Date().toISOString() }, '?id=eq.' + ex.id);
      }
      // Insert in batches of 50
      for (let i = 0; i < records.length; i += 50) {
        await API.request('attendance_records', 'POST', records.slice(i, i + 50));
      }
      UI.toast(`تم حفظ ${records.length} سجل حضور`);
      preview.innerHTML = '<p style="color:var(--green)">✅ تم الحفظ بنجاح</p>';
    } catch (e) { console.error(e); UI.toast('خطأ في الحفظ: ' + e.message, 'error'); }
  },

  async loadEmpPayroll() {
    try {
      const month = +document.getElementById('emp-payroll-month').value;
      const year = +document.getElementById('emp-payroll-year').value;
      const [employees, payrolls] = await Promise.all([
        API.request('employees', 'GET', null, '?select=*&is_active=eq.true&deleted_at=is.null&order=name.asc'),
        API.request('payroll_records', 'GET', null, `?month=eq.${month}&year=eq.${year}&deleted_at=is.null`)
      ]);
      const payrollMap = Object.fromEntries(payrolls.map(p => [p.employee_id, p]));
      const statusBadge = (s) => {
        const map = { draft: '<span class="badge badge-gray">مسودة</span>', approved: '<span class="badge" style="background:rgba(212,165,116,0.12);color:var(--gold);border:1px solid rgba(212,165,116,0.15)">معتمد</span>', paid: '<span class="badge badge-green">مدفوع</span>' };
        return map[s] || s;
      };
      const rows = employees.map(e => {
        const p = payrollMap[e.id];
        if (!p) return [e.name, App.fmtMoney(e.salary), '-', '-', '-', '-', '-', '-', '-', '<span class="badge badge-gray">غير مولد</span>', '-'];
        const actions = p.status === 'draft'
          ? `<button class="btn btn-sm btn-primary" onclick="Crud.editPayroll('${p.id}')">تعديل</button> <button class="btn btn-sm btn-secondary" onclick="Crud.approvePayroll('${p.id}')">اعتماد</button>`
          : p.status === 'approved'
            ? `<button class="btn btn-sm btn-primary" onclick="Crud.payPayroll('${p.id}')">💰 دفع</button> <button class="btn btn-sm btn-secondary" onclick="Crud.editPayroll('${p.id}')">تعديل</button>`
            : `<button class="btn btn-sm btn-secondary" onclick="Crud.editPayroll('${p.id}')">تعديل</button>`;
        return [e.name, App.fmtMoney(p.base_salary), p.days_present, p.days_absent, p.days_late, App.fmtMoney(p.deductions), App.fmtMoney(p.bonuses), App.fmtMoney(p.penalties), App.fmtMoney(p.net_salary), statusBadge(p.status), actions];
      });
      document.getElementById('emp-payroll-tbl').innerHTML = rows.length ? App.table(['الموظف', 'الراتب الأساسي', 'حاضر', 'غائب', 'متأخر', 'الخصومات', 'المكافآت', 'الجزاءات', 'الصافي', 'الحالة', 'الإجراءات'], rows) : '<p style="color:var(--text3)">لا يوجد بيانات</p>';
    } catch (e) {
      console.error(e);
      const errText = (e.message || '').toLowerCase();
      const isMissing = errText.includes('does not exist') || errText.includes('pgrst');
      const msg = isMissing
        ? '<p style="color:var(--red)">جداول الرواتب غير موجودة. شغّل schema.sql في Supabase.</p>'
        : '<p style="color:var(--red)">خطأ في تحميل البيانات</p>';
      document.getElementById('emp-payroll-tbl').innerHTML = msg;
    }
  },

  async generateEmpPayroll() {
    try {
      const month = +document.getElementById('emp-payroll-month').value;
      const year = +document.getElementById('emp-payroll-year').value;
      const [employees, attendance, empTxs] = await Promise.all([
        API.request('employees', 'GET', null, '?select=*&is_active=eq.true&deleted_at=is.null&order=name.asc'),
        API.request('attendance_records', 'GET', null, `?date=gte.${year}-${String(month).padStart(2,'0')}-01&date=lte.${year}-${String(month).padStart(2,'0')}-31&deleted_at=is.null`),
        API.request('employee_transactions', 'GET', null, `?date=gte.${year}-${String(month).padStart(2,'0')}-01&date=lte.${year}-${String(month).padStart(2,'0')}-31&deleted_at=is.null`)
      ]);
      const attByEmp = {};
      attendance.forEach(a => { attByEmp[a.employee_id] = attByEmp[a.employee_id] || []; attByEmp[a.employee_id].push(a); });
      const bonusByEmp = {};
      const penaltyByEmp = {};
      empTxs.forEach(t => {
        if (t.type === 'bonus') bonusByEmp[t.employee_id] = (bonusByEmp[t.employee_id] || 0) + (+t.amount || 0);
        if (t.type === 'penalty') penaltyByEmp[t.employee_id] = (penaltyByEmp[t.employee_id] || 0) + (+t.amount || 0);
      });
      const records = employees.map(e => {
        const empAtt = attByEmp[e.id] || [];
        const present = empAtt.filter(a => a.status === 'present').length;
        const absent = empAtt.filter(a => a.status === 'absent').length;
        const late = empAtt.filter(a => a.status === 'late').length;
        const half = empAtt.filter(a => a.status === 'half_day').length;
        const leave = empAtt.filter(a => a.status === 'leave').length;
        const base = +e.salary || 0;
        const dailyRate = base / 30;
        const deductions = Math.round(absent * dailyRate + half * dailyRate * 0.5);
        const bonuses = bonusByEmp[e.id] || 0;
        const penalties = penaltyByEmp[e.id] || 0;
        const net = base - deductions + bonuses - penalties;
        return {
          employee_id: e.id, employee_name: e.name, month, year,
          base_salary: base, days_present: present, days_absent: absent,
          days_late: late, days_half: half, days_leave: leave,
          deductions, bonuses, penalties, net_salary: net, status: 'draft'
        };
      });
      for (const r of records) {
        try {
          await API.request('payroll_records', 'POST', r);
        } catch (e) {
          // unique constraint — update instead
          if (e.message && e.message.includes('23505')) {
            const existing = await API.request('payroll_records', 'GET', null, `?employee_id=eq.${r.employee_id}&month=eq.${month}&year=eq.${year}&deleted_at=is.null`);
            if (existing.length) {
              await API.request('payroll_records', 'PATCH', { base_salary: r.base_salary, days_present: r.days_present, days_absent: r.days_absent, days_late: r.days_late, days_half: r.days_half, days_leave: r.days_leave, deductions: r.deductions, bonuses: r.bonuses, penalties: r.penalties, net_salary: r.net_salary }, `?id=eq.${existing[0].id}`);
            }
          } else { throw e; }
        }
      }
      UI.toast(`تم توليد رواتب ${records.length} موظف`);
      this.loadEmpPayroll();
    } catch (e) { console.error(e); UI.toast('خطأ في توليد الرواتب: ' + e.message, 'error'); }
  },

  async loadSettings() {
    // Settings page is static cards; no async data needed.
  },

  async loadUsers() {
    try {
      const [authData, profiles] = await Promise.all([
        API.authListUsers(),
        API.request('profiles', 'GET', null, '?select=*&order=created_at.desc')
      ]);
      const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
      const users = (authData.users || []).map(u => {
        const p = profileMap[u.id];
        const rawName = p?.name || u.user_metadata?.name || '';
        const safeName = Auth.safeName(rawName, '');
        return {
          id: u.id,
          email: u.email,
          name: safeName || Auth.fromEmail(u.email),
          role: p?.role || u.user_metadata?.role || 'user',
          email_confirmed_at: u.email_confirmed_at,
          created_at: u.created_at
        };
      });
      document.getElementById('users-tbl').innerHTML = users.length ? this.table(['المستخدم', 'الاسم', 'الدور', 'الحالة', 'تاريخ الإنشاء', 'الإجراءات'], users.map(u => [
        Auth.fromEmail(u.email),
        u.name,
        u.role === 'admin' ? '<span class="badge badge-green">مدير</span>' : '<span class="badge badge-gray">موظف</span>',
        u.email_confirmed_at ? '<span class="badge badge-green">مفعل</span>' : '<span class="badge badge-red">غير مفعل</span>',
        this.fmtDate(u.created_at),
        `<button class="btn btn-sm btn-secondary" onclick="Crud.editUser('${u.id}')">تعديل الاسم</button>`
      ])) : '<p style="color:var(--text3)">لا يوجد مستخدمين</p>';
      this.attachSearch('users-tbl', '🔍 بحث في المستخدمين...');
    } catch (e) { console.error(e); document.getElementById('users-tbl').innerHTML = '<p style="color:var(--red)">خطأ في تحميل المستخدمين</p>'; }
  },

  async loadBackup() {
    try {
      const last = localStorage.getItem('sara_last_backup');
      document.getElementById('backup-last').innerHTML = last
        ? `آخر نسخة يدوية: <strong>${new Date(last).toLocaleString('ar-EG')}</strong>`
        : 'لم يتم عمل نسخة يدوية بعد';
      const tables = ['clients','projects','employees','vendors','items','sectors','transactions','procurements','employee_transactions','employee_salary_history','custody_records','custody_expenses','attendance_records','payroll_records','work_sections','work_items','profiles','audit_logs','user_permissions'];
      // Check which tables actually exist
      const results = await Promise.all(tables.map(async t => {
        try { await API.request(t, 'GET', null, '?select=id&limit=1'); return { table: t, ok: true }; }
        catch (e) { return { table: t, ok: false }; }
      }));
      const okTables = results.filter(r => r.ok).map(r => r.table);
      const missingTables = results.filter(r => !r.ok).map(r => r.table);
      const statusHtml = `<ul style="list-style:none;padding:0;font-size:13px">${results.map(r => `<li style="padding:4px 0;border-bottom:1px solid var(--border)">${r.ok ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--text3)">○</span>'} ${r.table}.json</li>`).join('')}</ul><p style="font-size:12px;color:var(--text3);margin-top:8px">✓ متاح: ${okTables.length} &nbsp;|&nbsp; ○ غير منشأ بعد: ${missingTables.length}</p>`;
      document.getElementById('backup-status').innerHTML = statusHtml;
    } catch (e) { console.error(e); document.getElementById('backup-status').innerHTML = '<p style="color:var(--red)">خطأ في التحميل</p>'; }
  },

  async downloadLocalBackup() {
    const tables = ['clients','projects','employees','vendors','items','sectors','transactions','procurements','employee_transactions','employee_salary_history','custody_records','custody_expenses','attendance_records','payroll_records','work_sections','work_items','profiles','audit_logs','user_permissions'];
    const progress = document.getElementById('backup-progress');
    progress.innerHTML = '<p style="color:var(--gold)">⏳ جاري جمع البيانات...</p>';
    const zip = new JSZip();
    const folder = zip.folder('Sara_Backup_' + new Date().toISOString().slice(0,10));
    let ok = 0, skip = 0;
    for (const table of tables) {
      try {
        const data = await API.request(table, 'GET', null, '?select=*');
        folder.file(`${table}.json`, JSON.stringify(data, null, 2));
        ok++;
        progress.innerHTML = `<p style="color:var(--gold)">⏳ تم ${ok} جداول...</p>`;
      } catch (e) {
        // Table doesn't exist — skip gracefully, no error file
        skip++;
      }
    }
    progress.innerHTML = '<p style="color:var(--gold)">⏳ جاري ضغط الملف...</p>';
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sara_Backup_${new Date().toISOString().slice(0,10)}_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    localStorage.setItem('sara_last_backup', new Date().toISOString());
    const skipMsg = skip > 0 ? ` (تم تخطي ${skip} جدول غير منشأ)` : '';
    progress.innerHTML = `<p style="color:var(--green)">✅ تم التحميل بنجاح — ${ok} جدول${skipMsg}</p>`;
    this.loadBackup();
  },

  clearAppCache() {
    try {
      const token = localStorage.getItem('sara_token');
      localStorage.clear();
      sessionStorage.clear();
      if (token) localStorage.setItem('sara_token', token); // preserve login
      const url = new URL(location.href);
      url.searchParams.set('_', Date.now());
      location.href = url.toString();
    } catch (e) {
      console.error(e);
      location.reload(true);
    }
  },

  async loadPermissionsScreen() {
    try {
      const [users, perms] = await Promise.all([
        API.request('profiles', 'GET', null, '?select=*&role=eq.user&order=name.asc'),
        API.request('user_permissions', 'GET', null, '?select=*')
      ]);
      if (!users.length) {
        document.getElementById('permissions-tbl').innerHTML = '<p style="color:var(--text3)">لا يوجد مستخدمين عاديين</p>';
        return;
      }
      const screens = [
        { key: 'dashboard', label: '📊 الرئيسية' },
        { key: 'clients', label: '👥 العملاء' },
        { key: 'vendors', label: '🚚 الموردين' },
        { key: 'transactions', label: '💰 معاملات المشاريع' },
        { key: 'office', label: '🏢 المكتب' },
        { key: 'employees', label: '🧑‍💼 الموظفين' },
        { key: 'master', label: '📋 البيانات الأساسية' }
      ];
      const actions = [
        { key: 'can_view', label: 'عرض' },
        { key: 'can_add', label: 'إضافة' },
        { key: 'can_edit', label: 'تعديل' },
        { key: 'can_delete', label: 'حذف' },
        { key: 'can_print', label: 'طباعة' }
      ];
      const permMap = {};
      perms.forEach(p => { permMap[`${p.user_id}_${p.screen}`] = p; });

      const html = users.map(u => {
        const rows = screens.map(s => {
          const pk = `${u.id}_${s.key}`;
          const p = permMap[pk] || {};
          const cells = actions.map(a => {
            const checked = p[a.key] ? 'checked' : '';
            return `<td style="text-align:center"><input type="checkbox" data-user="${u.id}" data-screen="${s.key}" data-action="${a.key}" ${checked} style="width:18px;height:18px;cursor:pointer;accent-color:var(--gold)"></td>`;
          }).join('');
          return `<tr><td style="font-weight:600;font-size:13px">${s.label}</td>${cells}</tr>`;
        }).join('');
        return `<div class="card" style="margin-bottom:16px"><h3 style="margin-bottom:12px">👤 ${u.name || u.username}</h3><div class="table-responsive"><table class="data-table"><thead><tr><th>الشاشة</th>${actions.map(a => `<th style="text-align:center">${a.label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
      }).join('');

      const saveBtn = `<div style="margin-bottom:20px"><button class="btn btn-primary" onclick="App.savePermissions()">💾 حفظ الصلاحيات</button></div>`;
      document.getElementById('permissions-tbl').innerHTML = saveBtn + html;
    } catch (e) {
      console.error(e);
      const errText = (e.message || '').toLowerCase();
      const isMissingTable = errText.includes('does not exist') || errText.includes('user_permissions') || errText.includes('pgrst116') || errText.includes('relation');
      const msg = isMissingTable
        ? '<p style="color:var(--red)">جدول user_permissions غير موجود. شغّل schema.sql في Supabase.</p>'
        : '<p style="color:var(--red)">خطأ في التحميل: ' + (e.message || '').slice(0, 100) + '</p>';
      document.getElementById('permissions-tbl').innerHTML = msg;
    }
  },

  async savePermissions() {
    const checkboxes = document.querySelectorAll('#permissions-tbl input[type="checkbox"]');
    const perms = {};
    checkboxes.forEach(cb => {
      const userId = cb.dataset.user;
      const screen = cb.dataset.screen;
      const action = cb.dataset.action;
      const key = `${userId}_${screen}`;
      if (!perms[key]) perms[key] = { user_id: userId, screen };
      perms[key][action] = cb.checked;
    });
    try {
      for (const p of Object.values(perms)) {
        const existing = await API.request('user_permissions', 'GET', null, `?user_id=eq.${p.user_id}&screen=eq.${p.screen}`);
        if (existing.length) {
          await API.request('user_permissions', 'PATCH', p, `?id=eq.${existing[0].id}`);
        } else {
          await API.request('user_permissions', 'POST', p);
        }
      }
      UI.toast('تم حفظ الصلاحيات');
      this.loadPermissionsScreen();
    } catch (e) { console.error(e); UI.toast('خطأ في الحفظ: ' + e.message, 'error'); }
  },

  async loadAuditLog() {
    try {
      const tableFilter = document.getElementById('audit-table')?.value;
      const query = '?select=*&order=created_at.desc&limit=100' + (tableFilter ? '&table_name=eq.' + tableFilter : '');
      const logs = await API.request('audit_logs', 'GET', null, query);
      const actionLabels = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' };
      const actionColors = { INSERT: 'var(--green)', UPDATE: 'var(--gold)', DELETE: 'var(--red)' };
      document.getElementById('audit-tbl').innerHTML = logs.length ? this.table(['التاريخ', 'المستخدم', 'الجدول', 'العملية', 'السجل', 'البيانات'], logs.map(l => [
        this.fmtDate(l.created_at) + ' ' + new Date(l.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        l.user_name || '-',
        l.table_name || '-',
        `<span style="color:${actionColors[l.action] || 'var(--text)'};font-weight:600">${actionLabels[l.action] || l.action}</span>`,
        (l.record_id || '').slice(0, 8) + '...',
        l.new_data ? JSON.stringify(l.new_data).slice(0, 60) + '...' : '-'
      ])) : '<p style="color:var(--text3)">لا توجد سجلات</p>';
    } catch (e) {
      console.error(e);
      const errText = (e.message || '').toLowerCase();
      const isMissing = errText.includes('does not exist') || errText.includes('audit_logs') || errText.includes('pgrst');
      const msg = isMissing
        ? '<p style="color:var(--red)">جدول audit_logs غير موجود. شغّل schema.sql في Supabase.</p>'
        : '<p style="color:var(--red)">خطأ في التحميل</p>';
      document.getElementById('audit-tbl').innerHTML = msg;
    }
  },

  async loadMasterData() {
    try {
      // Fetch sectors & items (always exist). Filter out soft-deleted and deduplicate by name.
      const [sectorsRaw, itemsRaw] = await Promise.all([
        API.request('sectors', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc'),
        API.request('items', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc')
      ]);
      const dedup = (arr) => {
        const seen = new Set();
        return arr.filter(x => {
          const key = String(x.name || '').trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };
      const sectors = dedup(sectorsRaw);
      const items = dedup(itemsRaw);

      document.getElementById('sectors-tbl').innerHTML = sectors.length ? this.table(['التصنيف', 'الوصف', 'الإجراءات'], sectors.map(s => [
        s.name, s.description || '-', UI.actions(s.id, 'Crud.editSector', 'Crud.delSector', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : '<p style="color:var(--text3)">لا توجد تصنيفات</p>';
      this.attachSearch('sectors-tbl', '🔍 بحث في التصنيفات...');
      document.getElementById('items-tbl').innerHTML = items.length ? this.table(['الصنف', 'المواصفات', 'الماركة', 'الوحدة', 'الإجراءات'], items.map(i => [
        i.name, i.specification || '-', i.brand || '-', i.unit || 'قطعة', UI.actions(i.id, 'Crud.editItem', 'Crud.delItem', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : '<p style="color:var(--text3)">لا توجد أصناف</p>';
      this.attachSearch('items-tbl', '🔍 بحث في الأصناف...');

      // Fetch work sections & items (may fail if schema not run yet)
      let workSections = [], workItems = [];
      try {
        workSections = await API.request('work_sections', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc');
      } catch (e) { console.log('[MasterData] work_sections not ready:', e.message); }
      try {
        workItems = await API.request('work_items', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc');
      } catch (e) { console.log('[MasterData] work_items not ready:', e.message); }

      const sectionMap = Object.fromEntries(workSections.map(s => [s.id, s.name]));
      document.getElementById('work-sections-tbl').innerHTML = workSections.length ? this.table(['القسم', 'ملاحظات', 'الإجراءات'], workSections.map(s => [
        s.name, s.notes || '-', UI.actions(s.id, 'Crud.editWorkSection', 'Crud.delWorkSection', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : '<p style="color:var(--text3)">لا يوجد أقسام</p>';
      this.attachSearch('work-sections-tbl', '🔍 بحث في الأقسام...');
      document.getElementById('work-items-tbl').innerHTML = workItems.length ? this.table(['البند', 'القسم', 'ملاحظات', 'الإجراءات'], workItems.map(i => [
        i.name, sectionMap[i.section_id] || '-', i.notes || '-', UI.actions(i.id, 'Crud.editWorkItem', 'Crud.delWorkItem', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : '<p style="color:var(--text3)">لا توجد بنود</p>';
      this.attachSearch('work-items-tbl', '🔍 بحث في البنود...');
    } catch (e) { console.error(e); }
  },

  // ─── WORK SECTIONS & ITEMS EXCEL UPLOAD ───
  async parseWorkSectionsItemsFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      UI.toast('مكتبة Excel لم يتم تحميلها — تأكد من اتصال الإنترنت', 'error');
      return;
    }
    const preview = document.getElementById('work-sections-items-preview');
    preview.innerHTML = '<p style="color:var(--text3)">جاري قراءة الملف...</p>';
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(new Uint8Array(e.target.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
      if (!json.length || json.length < 2) {
        preview.innerHTML = '<p style="color:var(--red)">الملف فارغ أو غير صالح</p>';
        return;
      }
      const headers = (json[0] || []).map(h => String(h || '').trim());
      const lowerHeaders = headers.map(h => h.toLowerCase());
      const findCol = patterns => {
        for (let i = 0; i < lowerHeaders.length; i++) {
          if (!lowerHeaders[i]) continue;
          for (const p of patterns) { if (lowerHeaders[i].includes(p)) return i; }
        }
        return -1;
      };
      const colSection = findCol(['section', 'قسم', 'القسم', 'department', 'category', 'تصنيف']);
      const colItem = findCol(['item', 'بند', 'البند', 'name', 'الاسم', 'الأسم', 'work', 'عمل']);
      const colNotes = findCol(['notes', 'ملاحظات', 'ملاحظه', 'note', 'وصف', 'description']);

      if (colSection < 0 || colItem < 0) {
        preview.innerHTML = `<p style="color:var(--red)">لم يتم التعرف على الأعمدة المطلوبة. العناوين المكتشفة: ${headers.join(' | ')}</p><p style="color:var(--text3);font-size:12px">المطلوب: عمود القسم + عمود البند (اختياري: ملاحظات)</p>`;
        return;
      }

      // Fetch existing sections to match by name
      let existingSections = [];
      try {
        existingSections = await API.request('work_sections', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc');
      } catch (e) { console.log('[MasterData] work_sections not ready:', e.message); }
      const sectionByName = {};
      existingSections.forEach(s => { sectionByName[String(s.name || '').trim().toLowerCase()] = s; });

      const parsed = [];
      const sectionsToCreate = new Map();
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!Array.isArray(row) || row.length <= Math.max(colSection, colItem)) continue;
        const rawSection = String(row[colSection] || '').trim();
        const rawItem = String(row[colItem] || '').trim();
        if (!rawSection || !rawItem) continue;
        const rawNotes = colNotes >= 0 && colNotes < row.length ? String(row[colNotes] || '').trim() : '';
        const sectionKey = rawSection.toLowerCase();
        let sectionId = sectionByName[sectionKey]?.id || null;
        let sectionExists = !!sectionId;
        if (!sectionExists && !sectionsToCreate.has(sectionKey)) {
          sectionsToCreate.set(sectionKey, { name: rawSection, notes: rawNotes });
        }
        parsed.push({ rawSection, rawItem, rawNotes, sectionKey, sectionExists, sectionId });
      }

      // Build preview
      const rows = parsed.map((p, idx) => [
        idx + 1, p.rawSection, p.rawItem, p.rawNotes || '-',
        p.sectionExists ? '<span style="color:var(--green)">موجود</span>' : '<span style="color:var(--gold)">سيتم إنشاؤه</span>'
      ]);
      const summary = `<div style="margin-bottom:12px;font-size:13px">
        <span style="color:var(--gold)">أقسام جديدة: ${sectionsToCreate.size}</span> &nbsp;|&nbsp;
        <span style="color:var(--blue)">بنود: ${parsed.length}</span>
      </div>`;
      const saveBtn = parsed.length
        ? `<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="App.saveWorkSectionsItems()">💾 حفظ الأقسام والبنود</button></div>`
        : '';
      const table = rows.length ? App.table(['#', 'القسم', 'البند', 'ملاحظات', 'حالة القسم'], rows) : '<p style="color:var(--text3)">لا توجد بيانات</p>';
      preview.innerHTML = saveBtn + summary + table;
      preview.dataset.parsed = JSON.stringify(parsed);
      preview.dataset.sectionsToCreate = JSON.stringify(Array.from(sectionsToCreate.entries()));
    } catch (e) {
      console.error(e);
      preview.innerHTML = '<p style="color:var(--red)">خطأ في قراءة الملف: ' + (e.message || '') + '</p>';
    }
  },

  async saveWorkSectionsItems() {
    const preview = document.getElementById('work-sections-items-preview');
    const parsed = JSON.parse(preview.dataset.parsed || '[]');
    if (!parsed.length) { UI.toast('لا يوجد بيانات للحفظ', 'error'); return; }
    try {
      // Fetch existing sections again (in case user created some manually)
      let existingSections = [];
      try {
        existingSections = await API.request('work_sections', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc');
      } catch (e) { console.log('[MasterData] work_sections not ready:', e.message); }
      const sectionByName = {};
      existingSections.forEach(s => { sectionByName[String(s.name || '').trim().toLowerCase()] = s; });

      // Create missing sections
      const sectionsToCreate = JSON.parse(preview.dataset.sectionsToCreate || '[]');
      for (const [, sectionData] of sectionsToCreate) {
        const key = String(sectionData.name || '').trim().toLowerCase();
        if (sectionByName[key]) continue;
        try {
          const created = await API.request('work_sections', 'POST', sectionData);
          const newSection = Array.isArray(created) ? created[0] : created;
          sectionByName[key] = newSection;
        } catch (e) {
          console.log('[MasterData] failed to create section:', e.message);
        }
      }

      // Create items (deduplicate by section+item name)
      const seenItems = new Set();
      let createdCount = 0;
      for (const p of parsed) {
        const section = sectionByName[p.sectionKey];
        if (!section) continue;
        const itemKey = `${p.sectionKey}::${p.rawItem.trim().toLowerCase()}`;
        if (seenItems.has(itemKey)) continue;
        seenItems.add(itemKey);
        try {
          await API.request('work_items', 'POST', {
            section_id: section.id,
            section_name: section.name,
            name: p.rawItem,
            notes: p.rawNotes || null
          });
          createdCount++;
        } catch (e) {
          console.log('[MasterData] failed to create item:', e.message);
        }
      }
      UI.toast(`تم حفظ ${sectionsToCreate.length} قسم و ${createdCount} بند`);
      preview.innerHTML = '<p style="color:var(--green)">✅ تم الحفظ بنجاح</p>';
      this.loadMasterData();
    } catch (e) {
      console.error(e);
      UI.toast('خطأ في الحفظ: ' + e.message, 'error');
    }
  },

  table(headers, rows) {
    return `<div class="table-responsive"><table class="data-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },

  attachSearch(containerId, placeholder = '🔍 بحث...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container.dataset.searchAttached) return;
    container.dataset.searchAttached = 'true';
    const searchId = containerId + '-search';
    const searchHtml = `<div class="table-search" style="margin-bottom:12px"><input type="text" id="${searchId}" placeholder="${placeholder}" style="width:100%;max-width:320px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:inherit;outline:none" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'" /></div>`;
    container.insertAdjacentHTML('beforebegin', searchHtml);
    document.getElementById(searchId).addEventListener('input', (e) => {
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
  },

  fmtMoney(n) { return (+n || 0).toLocaleString('ar-EG') + ' ج.م'; },
  fmtDate(d) { return d ? new Date(d).toLocaleDateString('ar-EG') : '-'; },
  fmtTxType(type) { const map = { project_deposit: 'عربون مشروع', project_expense: 'مصروف مشروع', office_expense: 'مصروف مكتبي', owner_deposit: 'توريد صاحب المكتب', owner_withdrawal: 'سحب صاحب المكتب', supervision: 'إشراف مشروع', design: 'تصميم مشروع', income: 'إيراد', expense: 'مصروف', deposit: 'عربون', withdrawal: 'سحب' }; return map[type] || type; }
};

// ─── CRUD ───
const Crud = {
  _currentUserId() { return Auth.user?.id || null; },
  _currentUserName() { return Auth.user?.displayName || Auth.fromEmail(Auth.user?.email) || 'unknown'; },

  _isMissingColumnErr(e) {
    const msg = e?.message || '';
    return msg.includes('PGRST204') || msg.includes('42703') || msg.includes('updated_by') || msg.includes('created_by');
  },

  async save(table, data, id) {
    const userId = this._currentUserId();
    const userName = this._currentUserName();
    if (id) {
      const payload = { ...data, updated_by: userId };
      try {
        await API.request(table, 'PATCH', payload, '?id=eq.' + id);
      } catch (e) {
        if (this._isMissingColumnErr(e)) {
          delete payload.updated_by;
          await API.request(table, 'PATCH', payload, '?id=eq.' + id);
        } else { throw e; }
      }
      this._logAudit(table, id, 'UPDATE', null, payload, userId, userName).catch(() => {});
      return { id, ...payload };
    } else {
      const payload = { ...data, created_by: userId };
      let result;
      try {
        result = await API.request(table, 'POST', payload);
      } catch (e) {
        if (this._isMissingColumnErr(e)) {
          delete payload.created_by;
          result = await API.request(table, 'POST', payload);
        } else { throw e; }
      }
      const recordId = Array.isArray(result) ? result[0]?.id : result?.id;
      this._logAudit(table, recordId, 'INSERT', null, payload, userId, userName).catch(() => {});
      return result;
    }
  },

  async _logAudit(table, recordId, action, oldData, newData, userId, userName) {
    try {
      await API.request('audit_logs', 'POST', {
        table_name: table, record_id: recordId || null, action,
        old_data: oldData || null, new_data: newData || null,
        user_id: userId, user_name: userName
      });
    } catch (e) { console.log('[Audit] log failed:', e.message); }
  },

  _setupClientProjectCascade(overlay, projects, currentClientId, currentProjectId) {
    const form = overlay.querySelector('form');
    if (!form) return;
    const clientSel = form.querySelector('[name="client_id"]');
    const projSel = form.querySelector('[name="project_id"]');
    if (!clientSel || !projSel) return;

    // Store full options
    const allProjOpts = Array.from(projSel.options).map(o => ({ v: o.value, l: o.textContent }));

    const filterProjects = (clientId) => {
      if (!clientId) {
        projSel.innerHTML = '<option value="">-- اختر مشروع --</option>';
        projSel.disabled = true;
        return;
      }
      const filtered = projects.filter(p => p.client_id === clientId);
      projSel.innerHTML = '<option value="">-- اختر مشروع --</option>' + filtered.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      projSel.disabled = false;
    };

    // Initial state
    if (currentClientId) {
      filterProjects(currentClientId);
      if (currentProjectId) projSel.value = currentProjectId;
    } else {
      projSel.disabled = true;
    }

    clientSel.addEventListener('change', () => {
      filterProjects(clientSel.value);
    });
  },

  async bulkSave(table, rows) {
    if (!rows || rows.length === 0) throw new Error('لا يوجد بيانات');
    const userId = this._currentUserId();
    const clean = rows.map(r => {
      const c = { created_by: userId };
      for (const [k, v] of Object.entries(r)) {
        if (v !== null && v !== '') c[k] = v;
      }
      return c;
    }).filter(r => Object.keys(r).length > 1);
    if (clean.length === 0) throw new Error('لا يوجد بيانات صالحة');
    let result;
    try {
      result = await API.request(table, 'POST', clean);
    } catch (e) {
      if (this._isMissingColumnErr(e)) {
        const cleanNoAudit = clean.map(r => { const c = { ...r }; delete c.created_by; return c; });
        result = await API.request(table, 'POST', cleanNoAudit);
      } else { throw e; }
    }
    this._logAudit(table, null, 'INSERT', null, { count: clean.length }, this._currentUserId(), this._currentUserName()).catch(() => {});
    return result;
  },

  async softDelete(table, id) {
    const userId = this._currentUserId();
    const userName = this._currentUserName();
    const payload = { deleted_at: new Date().toISOString(), updated_by: userId };
    try {
      await API.request(table, 'PATCH', payload, '?id=eq.' + id);
    } catch (e) {
      if (this._isMissingColumnErr(e)) {
        delete payload.updated_by;
        await API.request(table, 'PATCH', payload, '?id=eq.' + id);
      } else { throw e; }
    }
    this._logAudit(table, id, 'DELETE', null, { deleted_at: new Date().toISOString() }, userId, userName).catch(() => {});
  },

  // ─── CLIENTS ───
  addClient() {
    const cols = [
      { key: 'name', label: 'اسم العميل *', req: true },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد' },
      { key: 'address', label: 'العنوان' },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة عملاء', cols, async (rows) => {
      await this.bulkSave('clients', rows);
      UI.toast(`تم حفظ ${rows.length} عميل`);
      App.loadClients();
    }, {}, {}, 'none');
  },

  async editClient(id) {
    const rows = await API.request('clients', 'GET', null, '?select=*&id=eq.' + id);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم العميل', req: true },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد' },
      { name: 'address', label: 'العنوان' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل عميل', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('clients', { name: fd.get('name'), phone: fd.get('phone') || null, email: fd.get('email') || null, address: fd.get('address') || null, notes: fd.get('notes') || null }, id);
      UI.toast('تم التحديث'); App.loadClients();
    });
  },

  delClient(id) {
    UI.confirm('هل أنت متأكد من حذف هذا العميل؟', async () => { await this.softDelete('clients', id); UI.toast('تم الحذف'); App.loadClients(); });
  },

  // ─── PROJECTS (linked to Clients) ───
  async addProject(clientId) {
    const clients = await API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc');
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const cols = [
      { key: 'name', label: 'اسم المشروع *', req: true },
      { key: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { key: 'address', label: 'العنوان' },
      { key: 'value', label: 'القيمة', type: 'number' },
      { key: 'supervision_percentage', label: 'نسبة الإشراف %', type: 'number' },
      { key: 'status', label: 'الحالة', type: 'select', opts: [{ v: 'active', l: 'نشط' }, { v: 'completed', l: 'منتهي' }, { v: 'on_hold', l: 'معلق' }, { v: 'cancelled', l: 'ملغي' }] },
      { key: 'start_date', label: 'تاريخ البدء', type: 'date' },
      { key: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
      { key: 'notes', label: 'ملاحظات' }
    ];
    const defaults = clientId ? { client_id: clientId, status: 'active' } : { status: 'active' };
    Spreadsheet.open('إضافة مشاريع', cols, async (rows) => {
      const enriched = rows.map(r => {
        const client = clients.find(c => c.id === r.client_id);
        return { ...r, client_id: r.client_id || null, client_name: client ? client.name : null };
      });
      await this.bulkSave('projects', enriched);
      UI.toast(`تم حفظ ${rows.length} مشروع`);
      App.loadClients();
    }, defaults, {}, 'none');
  },

  async editProject(id) {
    const [projectRows, clients] = await Promise.all([
      API.request('projects', 'GET', null, '?select=*&id=eq.' + id),
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    if (!projectRows.length) return;
    const project = projectRows[0];
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const fields = [
      { name: 'name', label: 'اسم المشروع', req: true },
      { name: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { name: 'address', label: 'العنوان' },
      { name: 'value', label: 'القيمة', type: 'number' },
      { name: 'supervision_percentage', label: 'نسبة الإشراف %', type: 'number' },
      { name: 'status', label: 'الحالة', type: 'select', opts: [{ v: 'active', l: 'نشط' }, { v: 'completed', l: 'منتهي' }, { v: 'on_hold', l: 'معلق' }, { v: 'cancelled', l: 'ملغي' }] },
      { name: 'start_date', label: 'تاريخ البدء', type: 'date' },
      { name: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    const values = { ...project, client_id: project.client_id || '' };
    UI.openModal('تعديل مشروع', `<form>${UI.form(fields, values)}</form>`, async (form) => {
      const fd = new FormData(form);
      const client = clients.find(c => c.id === fd.get('client_id'));
      await this.save('projects', { name: fd.get('name'), client_id: fd.get('client_id') || null, client_name: client ? client.name : null, value: +fd.get('value') || 0, supervision_percentage: +fd.get('supervision_percentage') || 0, status: fd.get('status') || 'active', start_date: fd.get('start_date') || null, end_date: fd.get('end_date') || null, notes: fd.get('notes') || null }, id);
      UI.toast('تم التحديث'); App.loadClients();
    });
  },

  async projectStatement(id) {
    const [projectRows, deposits, expenses] = await Promise.all([
      API.request('projects', 'GET', null, `?select=*&id=eq.${id}`),
      API.request('transactions', 'GET', null, `?select=*&type=eq.project_deposit&project_id=eq.${id}&deleted_at=is.null&order=date.asc`),
      API.request('transactions', 'GET', null, `?select=*&type=eq.project_expense&project_id=eq.${id}&deleted_at=is.null&order=date.asc`)
    ]);
    if (!projectRows.length) return;
    const project = projectRows[0];
    const totalExpenses = expenses.reduce((s, t) => s + (+t.amount || 0), 0);
    const designExpenses = expenses.filter(t => t.expense_category === 'design');
    const totalDesign = designExpenses.reduce((s, t) => s + (+t.amount || 0), 0);
    const totalConstr = totalExpenses - totalDesign;
    const supervisionAmount = totalConstr * (project.supervision_percentage || 0) / 100;
    const ledger = [];
    deposits.forEach(t => {
      const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '';
      ledger.push({ date: t.date || t.created_at, type: 'وارد', in: +t.amount || 0, out: 0, desc: (t.description || 'عربون من العميل') + (pm ? ` (${pm})` : '') });
    });
    expenses.filter(t => (t.expense_category || 'construction') !== 'design').forEach(t => ledger.push({ date: t.date || t.created_at, type: 'منصرف', in: 0, out: +t.amount || 0, desc: (t.description || '-') + (t.vendor_name ? ` (${t.vendor_name})` : '') }));
    if (designExpenses.length > 0) {
      ledger.push({ date: new Date().toISOString(), type: 'تصنيف', in: 0, out: 0, desc: '<strong>━━ مصروفات تصميم ━━</strong>' });
      designExpenses.forEach(t => ledger.push({ date: t.date || t.created_at, type: 'منصرف تصميم', in: 0, out: +t.amount || 0, desc: (t.description || '-') + (t.vendor_name ? ` (${t.vendor_name})` : '') }));
    }
    ledger.push({ date: new Date().toISOString(), type: 'إشراف', in: 0, out: supervisionAmount, desc: `إشراف ${project.name} (${project.supervision_percentage || 0}%)` });
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));
    let balance = 0;
    const rows = ledger.map(r => {
      balance += r.in - r.out;
      return [App.fmtDate(r.date), r.type, App.fmtMoney(r.in), App.fmtMoney(r.out), App.fmtMoney(balance), r.desc];
    });
    const totalIn = ledger.reduce((s, r) => s + r.in, 0);
    const totalOut = ledger.reduce((s, r) => s + r.out, 0);
    rows.push(['', '<strong>الإجمالي</strong>', `<strong>${App.fmtMoney(totalIn)}</strong>`, `<strong>${App.fmtMoney(totalOut)}</strong>`, `<strong>${App.fmtMoney(balance)}</strong>`, '']);
    const printTitle = `كشف حساب مشروع ${project.name} - ${project.client_name || ''}`;
    const html = `<div style="margin-bottom:16px"><strong>المشروع:</strong> ${project.name}<br><strong>العميل:</strong> ${project.client_name || '-'}<br><strong>نسبة الإشراف:</strong> ${project.supervision_percentage || 0}%<br><strong>إجمالي الوارد:</strong> ${App.fmtMoney(totalIn)}<br><strong>إجمالي المنصرف:</strong> ${App.fmtMoney(totalExpenses)}<br><strong>إشراف:</strong> ${App.fmtMoney(supervisionAmount)}<br><strong style="color:var(--gold)">رصيد العميل:</strong> ${App.fmtMoney(balance)}</div><div style="margin-bottom:16px"><button class="btn btn-secondary" onclick="App.printReport('${printTitle.replace(/'/g, "\\'")}')">🖨️ طباعة / PDF</button></div>${App.table(['التاريخ', 'النوع', 'وارد', 'منصرف', 'رصيد العميل', 'البيان'], rows)}`;
    UI.openModal('كشف حساب المشروع', html, null);
  },

  async projectBudget(id) {
    const [projectRows, deposits, expenses] = await Promise.all([
      API.request('projects', 'GET', null, `?select=*&id=eq.${id}`),
      API.request('transactions', 'GET', null, `?select=*&type=eq.project_deposit&project_id=eq.${id}&deleted_at=is.null`),
      API.request('transactions', 'GET', null, `?select=*&type=eq.project_expense&project_id=eq.${id}&deleted_at=is.null`)
    ]);
    if (!projectRows.length) return;
    const project = projectRows[0];
    const budget = +project.value || 0;
    const totalDep = deposits.reduce((s, t) => s + (+t.amount || 0), 0);
    const totalExp = expenses.reduce((s, t) => s + (+t.amount || 0), 0);
    const totalDesign = expenses.filter(t => t.expense_category === 'design').reduce((s, t) => s + (+t.amount || 0), 0);
    const totalConstr = totalExp - totalDesign;
    const supervision = totalConstr * (project.supervision_percentage || 0) / 100;
    const remainingBudget = budget - totalExp;
    const clientBalance = totalDep - totalExp - supervision;
    const expPct = budget > 0 ? Math.min(100, (totalExp / budget) * 100) : 0;

    const bar = (label, value, max, color) => {
      const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
      return `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${label}</span><span>${App.fmtMoney(value)}</span></div><div style="height:10px;background:var(--bg3);border-radius:5px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color};border-radius:5px;transition:.4s"></div></div></div>`;
    };

    const kpi = (label, value, color) => `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;text-align:center"><div style="font-size:11px;color:var(--text3);margin-bottom:6px">${label}</div><div style="font-size:20px;font-weight:700;color:${color}">${App.fmtMoney(value)}</div></div>`;

    const isCompleted = project.status === 'completed';
    const html = `<div style="margin-bottom:16px"><strong>المشروع:</strong> ${project.name}<br><strong>العميل:</strong> ${project.client_name || '-'}<br><strong>نسبة الإشراف:</strong> ${project.supervision_percentage || 0}%<br><strong>حالة المشروع:</strong> <span class="badge badge-${isCompleted ? 'green' : 'gray'}">${isCompleted ? 'منتهي' : 'قيد التنفيذ'}</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
      ${kpi('ميزانية المشروع', budget, 'var(--text)')}
      ${kpi('الوارد من العميل', totalDep, 'var(--green)')}
      ${kpi('المصروفات الفعلية', totalExp, 'var(--red)')}
      ${kpi('إشراف المكتب', supervision, 'var(--gold)')}
      ${kpi('المتبقي من الميزانية', remainingBudget, remainingBudget >= 0 ? 'var(--green)' : 'var(--red)')}
      ${kpi('رصيد العميل', clientBalance, clientBalance >= 0 ? 'var(--blue)' : 'var(--red)')}
    </div>
    ${bar('نسبة الصرف من الميزانية', totalExp, budget, totalExp > budget ? 'var(--red)' : 'var(--green)')}
    <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:var(--radius-sm);font-size:13px;color:var(--text2)">
      ${isCompleted
        ? (remainingBudget > 0 ? `✅ المتبقي من الميزانية: <strong>${App.fmtMoney(remainingBudget)}</strong>` : remainingBudget < 0 ? `⚠️ تجاوز الميزانية بـ <strong>${App.fmtMoney(Math.abs(remainingBudget))}</strong>` : '✅ الميزانية مستنفدة بالكامل')
          + '<br>'
          + (clientBalance > 0 ? `💰 للعميل رصيد مسترد: <strong>${App.fmtMoney(clientBalance)}</strong>` : clientBalance < 0 ? `📥 العميل مديون بـ <strong>${App.fmtMoney(Math.abs(clientBalance))}</strong>` : '✅ الرصيد صفر')
        : `🔧 المشروع قيد التنفيذ — الرصيد الحالي: <strong>${App.fmtMoney(clientBalance)}</strong><br>💡 التسوية النهائية (استرداد / مديونية) تظهر بعد إغلاق المشروع`
      }
    </div>
    <div style="margin-top:16px"><button class="btn btn-secondary" onclick="App.printReport('ميزانية المشروع ${project.name.replace(/'/g, "\\'")}')">🖨️ طباعة / PDF</button></div>`;
    UI.openModal('📊 ميزانية المشروع — ' + project.name, html, null);
  },

  async clientStatement(id) {
    const [clientRows, projects, deposits, expenses] = await Promise.all([
      API.request('clients', 'GET', null, `?select=*&id=eq.${id}`),
      API.request('projects', 'GET', null, `?select=*&client_id=eq.${id}&deleted_at=is.null`),
      API.request('transactions', 'GET', null, `?select=*&type=eq.project_deposit&deleted_at=is.null&order=date.asc`),
      API.request('transactions', 'GET', null, `?select=*&type=eq.project_expense&deleted_at=is.null&order=date.asc`)
    ]);
    if (!clientRows.length) return;
    const client = clientRows[0];
    const projIds = projects.map(p => p.id);
    const clientDeposits = deposits.filter(t => projIds.includes(t.project_id));
    const clientExpenses = expenses.filter(t => projIds.includes(t.project_id));
    const depByProject = {};
    clientDeposits.forEach(t => { depByProject[t.project_id] = (depByProject[t.project_id] || 0) + (+t.amount || 0); });
    const expByProject = {};
    const designByProject = {};
    clientExpenses.forEach(t => {
      const amt = +t.amount || 0;
      expByProject[t.project_id] = (expByProject[t.project_id] || 0) + amt;
      if (t.expense_category === 'design') {
        designByProject[t.project_id] = (designByProject[t.project_id] || 0) + amt;
      }
    });

    // Build per-project summary
    const projectSummary = projects.map(p => {
      const dep = depByProject[p.id] || 0;
      const exp = expByProject[p.id] || 0;
      const design = designByProject[p.id] || 0;
      const constr = exp - design;
      const sup = constr * (p.supervision_percentage || 0) / 100;
      const bal = dep - exp - sup;
      return { ...p, dep, exp, design, constr, sup, bal };
    });

    const totalDep = projectSummary.reduce((s, p) => s + p.dep, 0);
    const totalExp = projectSummary.reduce((s, p) => s + p.exp, 0);
    const totalSup = projectSummary.reduce((s, p) => s + p.sup, 0);
    const totalBalance = totalDep - totalExp - totalSup;

    const card = (title, value, color) => `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center;min-width:120px"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">${title}</div><div style="font-size:18px;font-weight:700;color:${color||'var(--text)'}">${value}</div></div>`;

    // Page 1: Summary
    let html = `<div style="margin-bottom:20px;padding:16px;background:linear-gradient(135deg,var(--bg3),var(--bg));border-radius:var(--radius);border:1px solid var(--border)">
      <h2 style="color:var(--gold);margin-bottom:8px;font-size:18px">📋 ملخص العميل — ${client.name}</h2>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px">${client.phone || ''} · ${client.email || ''} · ${client.address || ''}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        ${card('إجمالي الوارد', App.fmtMoney(totalDep), 'var(--green)')}
        ${card('إجمالي المصروفات', App.fmtMoney(totalExp), 'var(--red)')}
        ${card('إجمالي الإشراف', App.fmtMoney(totalSup), 'var(--gold)')}
        ${card('الرصيد', App.fmtMoney(totalBalance), totalBalance >= 0 ? 'var(--green)' : 'var(--red)')}
      </div>
      <h3 style="font-size:14px;color:var(--text2);margin-bottom:8px">📊 ملخص المشاريع</h3>
      ${App.table(['المشروع', 'الوارد', 'مصروفات', 'تصميم', 'تشطيب', 'إشراف', 'رصيد'], projectSummary.map(p => [
        p.name, App.fmtMoney(p.dep), App.fmtMoney(p.exp), App.fmtMoney(p.design), App.fmtMoney(p.constr), App.fmtMoney(p.sup), `<span style="color:${p.bal >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${App.fmtMoney(p.bal)}</span>`
      ]))}
    </div>`;

    // Each project chapter
    projectSummary.forEach(p => {
      const pDeposits = clientDeposits.filter(t => t.project_id === p.id);
      const pExpenses = clientExpenses.filter(t => t.project_id === p.id);
      const pDesign = pExpenses.filter(t => t.expense_category === 'design');
      const pConstr = pExpenses.filter(t => (t.expense_category || 'construction') !== 'design');

      html += `<div style="margin-bottom:20px;padding:16px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
        <h3 style="color:var(--gold);margin-bottom:12px;font-size:16px;border-bottom:1px solid var(--border);padding-bottom:8px">🏗️ ${p.name}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:12px">
          <span style="background:var(--bg);padding:4px 10px;border-radius:var(--radius-sm)">وارد: ${App.fmtMoney(p.dep)}</span>
          <span style="background:var(--bg);padding:4px 10px;border-radius:var(--radius-sm)">مصروفات: ${App.fmtMoney(p.exp)}</span>
          <span style="background:var(--bg);padding:4px 10px;border-radius:var(--radius-sm)">إشراف: ${App.fmtMoney(p.sup)}</span>
          <span style="background:var(--bg);padding:4px 10px;border-radius:var(--radius-sm);color:${p.bal >= 0 ? 'var(--green)' : 'var(--red)'}">رصيد: ${App.fmtMoney(p.bal)}</span>
        </div>`;

      // Deposits
      if (pDeposits.length) {
        html += `<h4 style="font-size:13px;color:var(--text2);margin:8px 0">💰 الوارد</h4>`;
        html += App.table(['التاريخ', 'المبلغ', 'طريقة الدفع', 'البيان'], pDeposits.map(t => {
          const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '-';
          return [App.fmtDate(t.date || t.created_at), App.fmtMoney(t.amount), pm, t.description || 'عربون'];
        }));
      }

      // Construction expenses
      if (pConstr.length) {
        html += `<h4 style="font-size:13px;color:var(--text2);margin:8px 0">🔨 مصروفات تشطيب</h4>`;
        html += App.table(['التاريخ', 'المبلغ', 'المورد', 'البيان'], pConstr.map(t => [App.fmtDate(t.date || t.created_at), App.fmtMoney(t.amount), t.vendor_name || '-', t.description || '-']));
      }

      // Design expenses
      if (pDesign.length) {
        html += `<h4 style="font-size:13px;color:var(--text2);margin:8px 0">🎨 مصروفات تصميم</h4>`;
        html += App.table(['التاريخ', 'المبلغ', 'البيان'], pDesign.map(t => [App.fmtDate(t.date || t.created_at), App.fmtMoney(t.amount), t.description || '-']));
      }

      // Supervision line
      html += `<div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center;font-size:13px">
        <span>📋 إشراف (${p.supervision_percentage || 0}% على ${App.fmtMoney(p.constr)})</span>
        <strong style="color:var(--gold)">${App.fmtMoney(p.sup)}</strong>
      </div>`;

      html += `</div>`;
    });

    html += `<div style="text-align:center;margin-top:20px"><button class="btn btn-secondary" onclick="App.printReport('كشف حساب العميل ${client.name.replace(/'/g, "\\'")}')">🖨️ طباعة / PDF</button></div>`;
    UI.openModal('كشف حساب العميل — ' + client.name, html, null);
  },

  delProject(id) {
    UI.confirm('هل أنت متأكد من حذف هذا المشروع؟', async () => { await this.softDelete('projects', id); UI.toast('تم الحذف'); App.loadClients(); });
  },

  // ─── VENDORS ───
  addVendor() {
    const sectorOpts = [{ v: '', l: '-- اختر تخصص --' }, { v: 'كهرباء', l: 'كهرباء' }, { v: 'سباكة', l: 'سباكة' }, { v: 'نجارة', l: 'نجارة' }, { v: 'دهانات', l: 'دهانات' }, { v: 'بناء', l: 'بناء' }, { v: 'ألوميتال', l: 'ألوميتال' }, { v: 'ديكور', l: 'ديكور' }, { v: 'تكييف', l: 'تكييف' }, { v: 'أرضيات', l: 'أرضيات' }, { v: 'حدادة', l: 'حدادة' }, { v: 'أخرى', l: 'أخرى' }];
    const typeOpts = [{ v: 'service', l: 'خدمات' }, { v: 'merchandise', l: 'بضاعة' }];
    const cols = [
      { key: 'name', label: 'اسم المورد *', req: true },
      { key: 'vendor_type', label: 'النوع', type: 'select', opts: typeOpts },
      { key: 'sector', label: 'التخصص', type: 'select', opts: sectorOpts },
      { key: 'contact_person', label: 'الشخص المسؤول' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد' },
      { key: 'address', label: 'العنوان' },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة موردين', cols, async (rows) => {
      try {
        await this.bulkSave('vendors', rows);
      } catch (e) {
        if (e.message && (e.message.includes('sector') || e.message.includes('vendor_type'))) {
          const fallback = rows.map(r => { const { sector, vendor_type, ...rest } = r; return rest; });
          await this.bulkSave('vendors', fallback);
        } else { throw e; }
      }
      UI.toast(`تم حفظ ${rows.length} مورد`);
      App.loadVendors();
    }, {}, {}, 'none');
  },

  async editVendor(id) {
    const rows = await API.request('vendors', 'GET', null, '?select=*&id=eq.' + id);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم المورد', req: true },
      { name: 'vendor_type', label: 'النوع', type: 'select', opts: [{ v: 'service', l: 'خدمات' }, { v: 'merchandise', l: 'بضاعة' }] },
      { name: 'sector', label: 'التخصص', type: 'select', opts: [{ v: '', l: '-- اختر تخصص --' }, { v: 'كهرباء', l: 'كهرباء' }, { v: 'سباكة', l: 'سباكة' }, { v: 'نجارة', l: 'نجارة' }, { v: 'دهانات', l: 'دهانات' }, { v: 'بناء', l: 'بناء' }, { v: 'ألوميتال', l: 'ألوميتال' }, { v: 'ديكور', l: 'ديكور' }, { v: 'تكييف', l: 'تكييف' }, { v: 'أرضيات', l: 'أرضيات' }, { v: 'حدادة', l: 'حدادة' }, { v: 'أخرى', l: 'أخرى' }] },
      { name: 'contact_person', label: 'الشخص المسؤول' },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد' },
      { name: 'address', label: 'العنوان' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل مورد', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      const data = { name: fd.get('name'), vendor_type: fd.get('vendor_type') || 'service', sector: fd.get('sector') || null, contact_person: fd.get('contact_person') || null, phone: fd.get('phone') || null, email: fd.get('email') || null, address: fd.get('address') || null, notes: fd.get('notes') || null };
      try {
        await this.save('vendors', data, id);
      } catch (e) {
        if (e.message && (e.message.includes('sector') || e.message.includes('vendor_type'))) {
          const { sector, vendor_type, ...rest } = data;
          await this.save('vendors', rest, id);
        } else { throw e; }
      }
      UI.toast('تم التحديث'); App.loadVendors();
    });
  },

  delVendor(id) {
    UI.confirm('هل أنت متأكد من حذف هذا المورد؟', async () => { await this.softDelete('vendors', id); UI.toast('تم الحذف'); App.loadVendors(); });
  },

  async vendorStatement(id) {
    const [vendorRows, procs, payments] = await Promise.all([
      API.request('vendors', 'GET', null, `?select=*&id=eq.${id}`),
      API.request('procurements', 'GET', null, `?select=*&vendor_id=eq.${id}&deleted_at=is.null&order=date.asc`),
      API.request('transactions', 'GET', null, `?select=*&vendor_id=eq.${id}&deleted_at=is.null&order=date.asc`)
    ]);
    if (!vendorRows.length) return;
    const vendor = vendorRows[0];

    // Build unified ledger combining procurements + transactions
    const ledger = [];

    // Procurements (purchases)
    procs.forEach(p => {
      const isNew = p.payment_term !== undefined && p.payment_term !== null;
      const amount = +p.total_price || 0;
      const paid = isNew ? (+p.paid_amount || 0) : 0; // old data: unpaid
      const term = p.payment_term || 'credit'; // old data: treat as credit
      ledger.push({
        date: p.date,
        source: 'procurement',
        client: p.client_name || '-',
        project: p.project_name || '-',
        vendor: vendor.name,
        category: p.item_name || 'شراء',
        amount,
        paid,
        term,
        desc: `شراء: ${p.item_name || '-'} (${p.project_name || '-'})`
      });
    });

    // Transactions (expenses / payments / settlements)
    payments.forEach(t => {
      const isNew = t.payment_term !== undefined && t.payment_term !== null;
      const amount = isNew ? (+t.amount || 0) : 0; // old data: pure payment
      const paid = isNew ? (+t.paid_amount || 0) : (+t.amount || 0); // old data: paid = amount
      const term = t.payment_term || 'settlement'; // old data: treat as settlement
      const category = t.expense_category === 'design' ? 'تصميم' : (t.expense_category === 'construction' ? 'تشطيب' : (t.type === 'office_expense' ? 'مكتبي' : 'أخرى'));
      ledger.push({
        date: t.date || t.created_at,
        source: 'transaction',
        client: t.party_name || t.client_name || '-',
        project: t.project_name || '-',
        vendor: t.vendor_name || vendor.name,
        category,
        amount,
        paid,
        term,
        desc: t.description || 'دفعة للمورد'
      });
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    const termLabels = { immediate: 'فوري', credit: 'اجل', settlement: 'تسديد' };
    let running = 0;
    const tableRows = ledger.map((r, idx) => {
      const balanceChange = r.amount - r.paid;
      running += balanceChange;
      return [
        idx + 1,
        r.client,
        r.project,
        r.vendor,
        r.category,
        App.fmtMoney(r.amount),
        `<span class="badge badge-${r.term === 'immediate' ? 'green' : r.term === 'credit' ? 'orange' : 'blue'}">${termLabels[r.term] || r.term}</span>`,
        App.fmtMoney(r.paid),
        `<strong style="color:${running >= 0 ? 'var(--red)' : 'var(--green)'}">${App.fmtMoney(Math.abs(running))}</strong>`,
        App.fmtDate(r.date)
      ];
    });

    const totalAmount = ledger.reduce((s, r) => s + r.amount, 0);
    const totalPaid = ledger.reduce((s, r) => s + r.paid, 0);
    const balance = totalAmount - totalPaid;

    if (tableRows.length) tableRows.push(['', '', '', '', '<strong>الإجمالي</strong>', `<strong>${App.fmtMoney(totalAmount)}</strong>`, '', `<strong>${App.fmtMoney(totalPaid)}</strong>`, `<strong style="color:${balance >= 0 ? 'var(--red)' : 'var(--green)'}">${App.fmtMoney(Math.abs(balance))}</strong>`, '']);

    const summary = `<div style="margin-bottom:16px"><strong>المورد:</strong> ${vendor.name}<br><strong>الشخص المسؤول:</strong> ${vendor.contact_person || '-'}<br><strong>الهاتف:</strong> ${vendor.phone || '-'}<br><strong>إجمالي المبلغ:</strong> ${App.fmtMoney(totalAmount)}<br><strong>إجمالي المدفوع:</strong> ${App.fmtMoney(totalPaid)}<br><strong style="color:var(--gold)">الرصيد:</strong> <span style="color:${balance >= 0 ? 'var(--red)' : 'var(--green)'}">${balance >= 0 ? 'علينا ' + App.fmtMoney(balance) : 'له ' + App.fmtMoney(Math.abs(balance))}</span></div><div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary" onclick="App.printReport('كشف حساب المورد ${vendor.name.replace(/'/g, "\\'")}')">🖨️ طباعة / PDF</button><button class="btn btn-secondary" onclick="Crud.exportVendorLedger('${id}')">📊 تصدير Excel</button></div>`;
    const tableHtml = tableRows.length ? App.table(['#', 'العميل', 'المشروع', 'المورد', 'التصنيف', 'المبلغ', 'طريقة الدفع', 'المدفوع', 'الباقي', 'التاريخ'], tableRows) : '<p style="color:var(--text3)">لا توجد بيانات</p>';
    UI.openModal('📋 كشف حساب المورد — ' + vendor.name, summary + tableHtml, null);
  },

  async exportVendorLedger(id) {
    const [vendorRows, procs, payments] = await Promise.all([
      API.request('vendors', 'GET', null, `?select=*&id=eq.${id}`),
      API.request('procurements', 'GET', null, `?select=*&vendor_id=eq.${id}&deleted_at=is.null&order=date.asc`),
      API.request('transactions', 'GET', null, `?select=*&vendor_id=eq.${id}&deleted_at=is.null&order=date.asc`)
    ]);
    if (!vendorRows.length) return;
    const vendor = vendorRows[0];

    const ledger = [];
    procs.forEach(p => {
      const isNew = p.payment_term !== undefined && p.payment_term !== null;
      ledger.push({
        date: p.date, client: p.client_name || '-', project: p.project_name || '-',
        vendor: vendor.name, category: p.item_name || 'شراء',
        amount: +p.total_price || 0, paid: isNew ? (+p.paid_amount || 0) : 0,
        term: p.payment_term || 'credit', desc: `شراء: ${p.item_name || '-'}`
      });
    });
    payments.forEach(t => {
      const isNew = t.payment_term !== undefined && t.payment_term !== null;
      const category = t.expense_category === 'design' ? 'تصميم' : (t.expense_category === 'construction' ? 'تشطيب' : (t.type === 'office_expense' ? 'مكتبي' : 'أخرى'));
      ledger.push({
        date: t.date || t.created_at, client: t.party_name || t.client_name || '-', project: t.project_name || '-',
        vendor: t.vendor_name || vendor.name, category,
        amount: isNew ? (+t.amount || 0) : 0, paid: isNew ? (+t.paid_amount || 0) : (+t.amount || 0),
        term: t.payment_term || 'settlement', desc: t.description || 'دفعة للمورد'
      });
    });
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    const termLabels = { immediate: 'فوري', credit: 'اجل', settlement: 'تسديد' };
    let running = 0;
    const rows = ledger.map(r => {
      running += (r.amount - r.paid);
      return [r.date, r.client, r.project, r.vendor, r.category, r.amount, termLabels[r.term] || r.term, r.paid, running, r.desc];
    });

    const totalAmount = ledger.reduce((s, r) => s + r.amount, 0);
    const totalPaid = ledger.reduce((s, r) => s + r.paid, 0);
    rows.push(['', '', '', '', 'الإجمالي', totalAmount, '', totalPaid, totalAmount - totalPaid, '']);

    const ws = XLSX.utils.aoa_to_sheet([
      ['التاريخ', 'العميل', 'المشروع', 'المورد', 'التصنيف', 'المبلغ', 'طريقة الدفع', 'المدفوع', 'الباقي', 'البيان'],
      ...rows
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب المورد');
    XLSX.writeFile(wb, `كشف-حساب-مورد-${vendor.name}-${new Date().toISOString().slice(0,10)}.xlsx`);
  },

  async vendorPurchases(vendorId) {
    const [vendorRows, procs, projects] = await Promise.all([
      API.request('vendors', 'GET', null, `?select=*&id=eq.${vendorId}`),
      API.request('procurements', 'GET', null, `?select=*&vendor_id=eq.${vendorId}&deleted_at=is.null&order=date.desc`),
      API.request('projects', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    if (!vendorRows.length) return;
    const vendor = vendorRows[0];
    const total = procs.reduce((s, p) => s + (+p.total_price || 0), 0);
    const rows = procs.map(p => [
      App.fmtDate(p.date), p.project_name || '-', p.item_name || '-', p.quantity || '-',
      App.fmtMoney(p.unit_price), App.fmtMoney(p.total_price), p.expense_type || '-',
      UI.actions(p.id, 'Crud.editProcurement', 'Crud.delProcurement')
    ]);
    const html = `<div style="margin-bottom:16px"><strong>المورد:</strong> ${vendor.name}<br><strong>إجمالي المشتريات:</strong> ${App.fmtMoney(total)}</div>
      <div style="margin-bottom:16px"><button class="btn btn-primary" onclick="Crud.addProcurement('${vendorId}')">+ إضافة مشتريات</button></div>
      ${rows.length ? App.table(['التاريخ', 'المشروع', 'البند', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'التصنيف', 'الإجراءات'], rows) : '<p style="color:var(--text3)">لا توجد مشتريات</p>'}`;
    UI.openModal('💰 مشتريات — ' + vendor.name, html, null);
  },

  async addProcurement(vendorId) {
    const [projects, vendors] = await Promise.all([
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    const vendorOpts = vendors.map(v => ({ v: v.id, l: v.name }));
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }));
    const fields = [
      { name: 'vendor_id', label: 'المورد', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مورد --' }, ...vendorOpts] },
      { name: 'project_id', label: 'المشروع', type: 'select', opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { name: 'item_name', label: 'البند / الصنف', req: true },
      { name: 'quantity', label: 'الكمية', type: 'number' },
      { name: 'unit_price', label: 'سعر الوحدة', type: 'number' },
      { name: 'expense_type', label: 'التصنيف' },
      { name: 'date', label: 'التاريخ', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    const overlay = UI.openModal('إضافة مشتريات', `<form>${UI.form(fields, { vendor_id: vendorId || '', date: new Date().toISOString().slice(0, 10) })}</form>`, async (form) => {
      const fd = new FormData(form);
      const project = projects.find(p => p.id === fd.get('project_id'));
      const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
      await this.save('procurements', {
        vendor_id: fd.get('vendor_id'), vendor_name: vendor ? vendor.name : null,
        project_id: fd.get('project_id') || null, project_name: project ? project.name : null,
        item_name: fd.get('item_name'), quantity: +fd.get('quantity') || 1, unit_price: +fd.get('unit_price') || 0,
        expense_type: fd.get('expense_type') || null, date: fd.get('date') || new Date().toISOString().slice(0, 10), notes: fd.get('notes') || null
      });
      UI.toast('تمت الإضافة');
      if (vendorId) this.vendorPurchases(vendorId);
      else App.loadVendors();
    });
    this._setupClientProjectCascade(overlay, projects, null, null);
  },

  async editProcurement(id) {
    const rows = await API.request('procurements', 'GET', null, `?select=*&id=eq.${id}`);
    if (!rows.length) return;
    const p = rows[0];
    const [projects, vendors] = await Promise.all([
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    const fields = [
      { name: 'vendor_id', label: 'المورد', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مورد --' }, ...vendors.map(v => ({ v: v.id, l: v.name }))] },
      { name: 'project_id', label: 'المشروع', type: 'select', opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }))] },
      { name: 'item_name', label: 'البند / الصنف', req: true },
      { name: 'quantity', label: 'الكمية', type: 'number' },
      { name: 'unit_price', label: 'سعر الوحدة', type: 'number' },
      { name: 'expense_type', label: 'التصنيف' },
      { name: 'date', label: 'التاريخ', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    const overlay = UI.openModal('تعديل مشتريات', `<form>${UI.form(fields, { ...p, vendor_id: p.vendor_id || '', project_id: p.project_id || '' })}</form>`, async (form) => {
      const fd = new FormData(form);
      const project = projects.find(pr => pr.id === fd.get('project_id'));
      const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
      await this.save('procurements', {
        vendor_id: fd.get('vendor_id'), vendor_name: vendor ? vendor.name : null,
        project_id: fd.get('project_id') || null, project_name: project ? project.name : null,
        item_name: fd.get('item_name'), quantity: +fd.get('quantity') || 1, unit_price: +fd.get('unit_price') || 0,
        expense_type: fd.get('expense_type') || null, date: fd.get('date') || new Date().toISOString().slice(0, 10), notes: fd.get('notes') || null
      }, id);
      UI.toast('تم التحديث'); App.loadVendors();
    });
    this._setupClientProjectCascade(overlay, projects, p.vendor_id, p.project_id);
  },

  delProcurement(id) {
    UI.confirm('هل أنت متأكد من حذف هذه المشتريات؟', async () => {
      await this.softDelete('procurements', id);
      UI.toast('تم الحذف'); App.loadVendors();
    });
  },

  // ─── EMPLOYEES ───
  addEmp() {
    const cols = [
      { key: 'name', label: 'اسم الموظف *', req: true },
      { key: 'job_title', label: 'الوظيفة' },
      { key: 'salary', label: 'الراتب', type: 'number' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد' },
      { key: 'hire_date', label: 'تاريخ التعيين', type: 'date' },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة موظفين', cols, async (rows) => {
      await this.bulkSave('employees', rows);
      UI.toast(`تم حفظ ${rows.length} موظف`);
      App.loadEmployees();
    }, {}, {}, 'none');
  },

  async editEmp(id) {
    const rows = await API.request('employees', 'GET', null, '?select=*&id=eq.' + id);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم الموظف', req: true },
      { name: 'job_title', label: 'الوظيفة' },
      { name: 'salary', label: 'الراتب', type: 'number' },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد' },
      { name: 'hire_date', label: 'تاريخ التعيين', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل موظف', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('employees', { name: fd.get('name'), job_title: fd.get('job_title') || null, salary: +fd.get('salary') || 0, phone: fd.get('phone') || null, email: fd.get('email') || null, hire_date: fd.get('hire_date') || null, notes: fd.get('notes') || null }, id);
      UI.toast('تم التحديث'); App.loadEmployees();
    });
  },

  delEmp(id) {
    UI.confirm('هل أنت متأكد من حذف هذا الموظف؟', async () => { await this.softDelete('employees', id); UI.toast('تم الحذف'); App.loadEmployees(); });
  },

  // ─── CUSTODY (العهدة) ───
  async addCustody(empId, empName) {
    const [projects, clients] = await Promise.all([
      API.request('projects', 'GET', null, '?select=id,name,client_id&deleted_at=is.null&order=name.asc'),
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name }));
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const fields = [
      { name: 'amount', label: 'مبلغ العهدة', type: 'number', req: true },
      { name: 'client_id', label: 'العميل', type: 'select', opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { name: 'project_id', label: 'المشروع', type: 'select', opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { name: 'date', label: 'التاريخ', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    const overlay = UI.openModal('تسليم عهدة مالية', `<form>${UI.form(fields, {})}</form>`, async (form) => {
      const fd = new FormData(form);
      const project = projects.find(p => p.id === fd.get('project_id'));
      const client = clients.find(c => c.id === fd.get('client_id'));
      await this.save('custody_records', { employee_id: empId, employee_name: empName, amount: +fd.get('amount') || 0, project_id: fd.get('project_id') || null, project_name: project ? project.name : null, client_id: fd.get('client_id') || null, client_name: client ? client.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), notes: fd.get('notes') || null, status: 'active' });
      UI.toast('تم تسليم العهدة'); App.loadEmployees(); Crud.employeeCustody(empId);
    });
    this._setupClientProjectCascade(overlay, projects, null, null);
  },

  async employeeCustody(empId) {
    try {
      const [empRows, custodyRecs] = await Promise.all([
        API.request('employees', 'GET', null, `?select=*&id=eq.${empId}`),
        API.request('custody_records', 'GET', null, `?select=*&employee_id=eq.${empId}&deleted_at=is.null&order=date.desc`)
      ]);
      if (!empRows.length) return;
      const emp = empRows[0];
      // Fetch expenses for all custody records
      const custodyIds = custodyRecs.map(c => c.id);
      let allExpenses = [];
      if (custodyIds.length) {
        try {
          allExpenses = await API.request('custody_expenses', 'GET', null, `?select=*&custody_id=in.(${custodyIds.join(',')})&deleted_at=is.null&order=date.asc`);
        } catch (e) {
          console.error('[Custody] Failed to load expenses:', e);
          UI.toast('تنبيه: تعذر تحميل مصروفات العهدة', 'error');
        }
      }
      const expByCustody = {};
      allExpenses.forEach(e => { expByCustody[e.custody_id] = (expByCustody[e.custody_id] || 0) + (+e.amount || 0); });
      const activeTotal = custodyRecs.filter(c => c.status === 'active').reduce((s, c) => s + (+c.amount || 0), 0);
      const settledTotal = custodyRecs.filter(c => c.status === 'settled').reduce((s, c) => s + (+c.amount || 0), 0);
      // Build custody cards
      let custodyHtml = '';
      custodyRecs.forEach(c => {
        const given = +c.amount || 0;
        const spent = expByCustody[c.id] || 0;
        const returned = +c.returned_amount || 0;
        const remaining = given - spent - returned;
        const statusBadge = c.status === 'active' ? '<span class="badge badge-green">نشطة</span>' : '<span class="badge badge-gray">مقفلة</span>';
        const expenses = allExpenses.filter(e => e.custody_id === c.id);
        let expRows = expenses.map(e => [App.fmtDate(e.date), e.description || '-', App.fmtMoney(e.amount)]);
        expRows.push(['', '<strong>المتبقي</strong>', `<strong style="color:${remaining >= 0 ? 'var(--green)' : 'var(--red)'}">${App.fmtMoney(remaining)}</strong>`]);
        const canSettle = c.status === 'active';
        custodyHtml += `<div class="card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px"><div><strong>عهدة ${App.fmtDate(c.date)}</strong> — ${c.project_name || '-'} ${statusBadge}</div><div style="display:flex;gap:6px">${canSettle ? `<button class="btn btn-sm btn-secondary" onclick="Crud.addCustodyExpense('${c.id}', '${empId}')">+ مصروف</button><button class="btn btn-sm btn-secondary" onclick="Crud.returnCustody('${c.id}', '${empId}')">+ مرتد</button><button class="btn btn-sm btn-primary" onclick="Crud.settleCustody('${c.id}', '${empId}')">تسوية</button>` : ''}</div></div><div style="font-size:12px;color:var(--text2);margin-bottom:8px">سلمت: ${App.fmtMoney(given)} | صرفت: ${App.fmtMoney(spent)} | مرتد: ${App.fmtMoney(returned)} | متبقي: <strong style="color:${remaining >= 0 ? 'var(--green)' : 'var(--red)'}">${App.fmtMoney(remaining)}</strong></div>${App.table(['التاريخ', 'البيان', 'المبلغ'], expRows)}</div>`;
      });
      const html = `<div style="margin-bottom:16px"><strong>الموظف:</strong> ${emp.name}<br><strong>الوظيفة:</strong> ${emp.job_title || '-'}<br><strong>العهدة النشطة:</strong> <span style="color:var(--green)">${App.fmtMoney(activeTotal)}</span><br><strong>العهدة المقفلة:</strong> ${App.fmtMoney(settledTotal)}</div><div style="margin-bottom:16px"><button class="btn btn-primary" onclick="Crud.addCustody('${emp.id}', '${emp.name}')">+ تسليم عهدة جديدة</button></div>${custodyHtml || '<p style="color:var(--text3)">لا توجد سجلات عهدة</p>'}`;
      UI.openModal('سجل العهدة — ' + emp.name, html, null);
    } catch (e) {
      console.error('[employeeCustody] Error:', e);
      UI.toast('خطأ في تحميل سجل العهدة: ' + (e.message || ''), 'error');
    }
  },

  async addCustodyExpense(custodyId, empId) {
    const fields = [
      { name: 'amount', label: 'المبلغ', type: 'number', req: true },
      { name: 'description', label: 'البيان', req: true },
      { name: 'date', label: 'التاريخ', type: 'date' }
    ];
    UI.openModal('إضافة مصروف عهدة', `<form>${UI.form(fields, {})}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('custody_expenses', { custody_id: custodyId, amount: +fd.get('amount') || 0, description: fd.get('description'), date: fd.get('date') || new Date().toISOString().slice(0, 10) });
        UI.toast('تم تسجيل المصروف'); Crud.employeeCustody(empId);
      } catch (e) {
        console.error('[addCustodyExpense]', e);
        UI.toast('فشل حفظ المصروف — جدول custody_expenses ممكن ميكونش موجود في قاعدة البيانات. شغل schema.sql في Supabase.', 'error');
        throw e;
      }
    });
  },

  async returnCustody(custodyId, empId) {
    try {
      const custodyRows = await API.request('custody_records', 'GET', null, `?select=*&id=eq.${custodyId}`);
      if (!custodyRows.length) return;
      const c = custodyRows[0];
      let expenses = [];
      try {
        expenses = await API.request('custody_expenses', 'GET', null, `?select=amount&custody_id=eq.${custodyId}&deleted_at=is.null`);
      } catch (e) { console.error('[returnCustody] Failed to load expenses:', e); }
      const totalExp = expenses.reduce((s, e) => s + (+e.amount || 0), 0);
      const currentReturned = +c.returned_amount || 0;
      const remaining = (+c.amount || 0) - totalExp - currentReturned;
      const fields = [
        { name: 'amount', label: `المبلغ المرتد (المتبقي: ${App.fmtMoney(remaining)})`, type: 'number', req: true },
        { name: 'date', label: 'التاريخ', type: 'date' }
      ];
      UI.openModal('تسجيل مرتد عهدة', `<form>${UI.form(fields, {})}</form>`, async (form) => {
        const fd = new FormData(form);
        const newReturned = currentReturned + (+fd.get('amount') || 0);
        try {
          await this.save('custody_records', { returned_amount: newReturned }, custodyId);
          UI.toast('تم تسجيل المرتد'); Crud.employeeCustody(empId);
        } catch (e) {
          console.error('[returnCustody save]', e);
          UI.toast('فشل حفظ المرتد — عمود returned_amount ممكن ميكونش موجود. شغل schema.sql في Supabase.', 'error');
          throw e;
        }
      });
    } catch (e) {
      console.error('[returnCustody] Error:', e);
      UI.toast('خطأ في تحميل بيانات العهدة', 'error');
    }
  },

  async settleCustody(id, empId) {
    UI.confirm('هل أنت متأكد من تسوية هذه العهدة؟', async () => {
      try {
        await this.save('custody_records', { status: 'settled' }, id);
        UI.toast('تمت التسوية'); App.loadEmployees(); Crud.employeeCustody(empId);
      } catch (e) {
        console.error('[settleCustody] Error:', e);
        UI.toast('خطأ في تسوية العهدة — ' + (e.message || ''), 'error');
      }
    });
  },

  async employeeAttendance(empId) {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const [empRows, attendance] = await Promise.all([
        API.request('employees', 'GET', null, `?select=*&id=eq.${empId}`),
        API.request('attendance_records', 'GET', null, `?select=*&employee_id=eq.${empId}&date=gte.${year}-${String(month).padStart(2,'0')}-01&date=lte.${year}-${String(month).padStart(2,'0')}-31&deleted_at=is.null&order=date.asc`)
      ]);
      if (!empRows.length) return;
      const emp = empRows[0];
      const statusLabels = { present: 'حاضر', absent: 'غائب', late: 'متأخر', half_day: 'نصف يوم', leave: 'إجازة' };
      const statusColors = { present: 'var(--green)', absent: 'var(--red)', late: 'var(--gold)', half_day: 'var(--blue)', leave: 'var(--text3)' };
      const summary = { present: 0, absent: 0, late: 0, half_day: 0, leave: 0 };
      attendance.forEach(a => { if (summary[a.status] !== undefined) summary[a.status]++; });
      const rows = attendance.map(a => [
        App.fmtDate(a.date),
        `<span style="color:${statusColors[a.status] || 'var(--text)'};font-weight:600">${statusLabels[a.status] || a.status}</span>`,
        a.check_in || '-', a.check_out || '-', a.notes || '-'
      ]);
      const html = `<div style="margin-bottom:16px"><strong>الموظف:</strong> ${emp.name}<br><strong>الشهر:</strong> ${month}/${year}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;font-size:13px">
        <span style="color:var(--green)">✓ حاضر: ${summary.present}</span>
        <span style="color:var(--red)">✗ غائب: ${summary.absent}</span>
        <span style="color:var(--gold)">⏱ متأخر: ${summary.late}</span>
        <span style="color:var(--blue)">½ نصف يوم: ${summary.half_day}</span>
        <span style="color:var(--text3)">🏖 إجازة: ${summary.leave}</span>
      </div>
      ${rows.length ? App.table(['التاريخ', 'الحالة', 'دخول', 'خروج', 'ملاحظات'], rows) : '<p style="color:var(--text3)">لا توجد سجلات حضور هذا الشهر</p>'}`;
      UI.openModal('سجل الحضور — ' + emp.name, html, null);
    } catch (e) { console.error(e); UI.toast('خطأ في تحميل سجل الحضور', 'error'); }
  },

  // ─── TRANSACTIONS: 4 Types ───
  async addProjectDeposit() {
    const [clients, projects] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id&deleted_at=is.null&order=name.asc')
    ]);
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name }));
    const cols = [
      { key: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { key: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'payment_method', label: 'طريقة الدفع', type: 'select', opts: [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }, { v: 'transfer', l: 'تحويل' }] },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('💰 عربون مشروع (من عميل)', cols, async (rows) => {
      const enriched = rows.map(r => {
        const client = clients.find(c => c.id === r.client_id);
        const project = projects.find(p => p.id === r.project_id);
        return { type: 'project_deposit', amount: r.amount, client_id: r.client_id, party_id: r.client_id, party_name: client ? client.name : null, party_type: 'client', project_id: r.project_id, project_name: project ? project.name : null, payment_method: r.payment_method || null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} عربون`);
      App.loadTransactions(); App.loadOffice();
    }, {}, { clientProject: { clientKey: 'client_id', projectKey: 'project_id', projects } });
  },

  async addProjectExpense() {
    const [clients, projects, vendors] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }));
    const vendorOpts = vendors.map(v => ({ v: v.id, l: v.name }));
    const cols = [
      { key: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { key: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { key: 'vendor_id', label: 'المورد', type: 'select', opts: [{ v: '', l: '-- اختر مورد --' }, ...vendorOpts] },
      { key: 'expense_category', label: 'التصنيف', type: 'select', opts: [{ v: 'construction', l: 'تشطيب' }, { v: 'design', l: 'تصميم' }] },
      { key: 'payment_term', label: 'طريقة الدفع', type: 'select', opts: [{ v: 'immediate', l: 'فوري' }, { v: 'credit', l: 'اجل' }, { v: 'settlement', l: 'تسديد' }] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'paid_amount', label: 'المدفوع', type: 'number' },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('🔨 مصروف مشروع', cols, async (rows) => {
      const enriched = rows.map(r => {
        const project = projects.find(p => p.id === r.project_id);
        const vendor = vendors.find(v => v.id === r.vendor_id);
        if (!project) { UI.toast('مشروع غير موجود', 'error'); throw new Error('invalid project'); }
        if (r.client_id && project.client_id !== r.client_id) { UI.toast('المشروع لا ينتمي للعميل المختار', 'error'); throw new Error('client mismatch'); }
        let amount = +r.amount || 0;
        let paid_amount = +r.paid_amount || 0;
        const payment_term = r.payment_term || 'immediate';
        if (payment_term === 'immediate') paid_amount = amount;
        else if (payment_term === 'settlement') amount = 0;
        if (payment_term === 'credit' && paid_amount > amount) paid_amount = amount;
        return { type: 'project_expense', expense_category: r.expense_category || 'construction', payment_term, amount, paid_amount, client_id: project.client_id, party_id: project.client_id, party_name: project.client_name, party_type: 'client', project_id: r.project_id, project_name: project.name, vendor_id: r.vendor_id || null, vendor_name: vendor ? vendor.name : null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      try {
        await this.bulkSave('transactions', enriched);
      } catch (e) {
        if (e.message && (e.message.includes('expense_category') || e.message.includes('payment_term') || e.message.includes('paid_amount') || e.message.includes('42703') || e.message.includes('PGRST204'))) {
          const fallback = enriched.map(r => { const { expense_category, payment_term, paid_amount, ...rest } = r; return rest; });
          await this.bulkSave('transactions', fallback);
        } else { throw e; }
      }
      UI.toast(`تم حفظ ${rows.length} مصروف`);
      App.loadTransactions(); App.loadOffice();
    }, {}, { clientProject: { clientKey: 'client_id', projectKey: 'project_id', projects } });
  },

  async addOfficeExpense() {
    const [employees, sectors] = await Promise.all([
      API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc'),
      API.request('sectors', 'GET', null, '?select=id,name&order=name.asc')
    ]);
    const empOpts = employees.map(e => ({ v: e.id, l: e.name }));
    const sectorOpts = sectors.map(s => ({ v: s.id, l: s.name }));
    const cols = [
      { key: 'employee_id', label: 'الموظف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر موظف --' }, ...empOpts] },
      { key: 'sector_id', label: 'التصنيف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر تصنيف --' }, ...sectorOpts] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('🏢 مصروف مكتبي (موظف)', cols, async (rows) => {
      const enriched = rows.map(r => {
        const emp = employees.find(e => e.id === r.employee_id);
        const sector = sectors.find(s => s.id === r.sector_id);
        return { type: 'office_expense', amount: r.amount, employee_id: r.employee_id, employee_name: emp ? emp.name : null, sector_id: r.sector_id, sector_name: sector ? sector.name : null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} مصروف مكتبي`);
      App.loadTransactions();
    });
  },

  addOwnerDeposit() {
    const cols = [
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('👤 توريد صاحب المكتب', cols, async (rows) => {
      const enriched = rows.map(r => ({ type: 'owner_deposit', amount: r.amount, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null }));
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} توريد`);
      App.loadTransactions(); App.loadOffice();
    });
  },

  addOwnerWithdrawal() {
    const cols = [
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('🏃 سحب صاحب المكتب', cols, async (rows) => {
      const enriched = rows.map(r => ({ type: 'withdrawal', amount: r.amount, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null }));
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} سحب`);
      App.loadTransactions();
    });
  },

  async addProjectSupervision() {
    const projects = await API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc');
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name }));
    const cols = [
      { key: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { key: 'amount', label: 'نسبة الإشراف', type: 'number', req: true },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('📋 إشراف مشروع', cols, async (rows) => {
      const enriched = rows.map(r => {
        const project = projects.find(p => p.id === r.project_id);
        return { type: 'supervision', amount: r.amount, client_id: project ? project.client_id : null, party_id: project ? project.client_id : null, party_name: project ? project.client_name : null, party_type: 'client', project_id: r.project_id, project_name: project ? project.name : null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} إشراف`);
      App.loadTransactions(); App.loadOffice();
    });
  },

  async editTx(id) {
    const txRows = await API.request('transactions', 'GET', null, '?select=*&id=eq.' + id);
    if (!txRows.length) return;
    const tx = txRows[0];

    if (tx.type === 'project_deposit') {
      const [clients, projects] = await Promise.all([
        API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('projects', 'GET', null, '?select=id,name,client_id&deleted_at=is.null&order=name.asc')
      ]);
      const fields = [
        { name: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clients.map(c => ({ v: c.id, l: c.name }))] },
        { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name }))] },
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'payment_method', label: 'طريقة الدفع', type: 'select', opts: [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }, { v: 'transfer', l: 'تحويل' }] },
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      const overlay = UI.openModal('تعديل عربون مشروع', `<form>${UI.form(fields, { ...tx, client_id: tx.client_id || '' })}</form>`, async (form) => {
        const fd = new FormData(form);
        const client = clients.find(c => c.id === fd.get('client_id'));
        const project = projects.find(p => p.id === fd.get('project_id'));
        await this.save('transactions', { type: 'project_deposit', amount: +fd.get('amount') || 0, client_id: fd.get('client_id'), party_id: fd.get('client_id'), party_name: client ? client.name : null, party_type: 'client', project_id: fd.get('project_id'), project_name: project ? project.name : null, payment_method: fd.get('payment_method') || null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
      this._setupClientProjectCascade(overlay, projects, tx.client_id, tx.project_id);
    } else if (tx.type === 'project_expense') {
      const [clients, projects, vendors] = await Promise.all([
        API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
        API.request('vendors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
      ]);
      const fields = [
        { name: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clients.map(c => ({ v: c.id, l: c.name }))] },
        { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }))] },
        { name: 'vendor_id', label: 'المورد', type: 'select', opts: [{ v: '', l: '-- اختر مورد --' }, ...vendors.map(v => ({ v: v.id, l: v.name }))] },
        { name: 'expense_category', label: 'التصنيف', type: 'select', opts: [{ v: 'construction', l: 'تشطيب' }, { v: 'design', l: 'تصميم' }] },
        { name: 'payment_term', label: 'طريقة الدفع', type: 'select', opts: [{ v: 'immediate', l: 'فوري' }, { v: 'credit', l: 'اجل' }, { v: 'settlement', l: 'تسديد' }] },
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'paid_amount', label: 'المدفوع', type: 'number' },
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      const overlay = UI.openModal('تعديل مصروف مشروع', `<form>${UI.form(fields, { ...tx, client_id: tx.client_id || '', project_id: tx.project_id || '', vendor_id: tx.vendor_id || '', expense_category: tx.expense_category || 'construction', payment_term: tx.payment_term || 'immediate', paid_amount: tx.paid_amount !== undefined ? tx.paid_amount : (tx.amount || 0) })}</form>`, async (form) => {
        const fd = new FormData(form);
        const project = projects.find(p => p.id === fd.get('project_id'));
        const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
        if (!project) { UI.toast('مشروع غير موجود', 'error'); return; }
        if (fd.get('client_id') && project.client_id !== fd.get('client_id')) { UI.toast('المشروع لا ينتمي للعميل المختار', 'error'); return; }
        let amount = +fd.get('amount') || 0;
        let paid_amount = +fd.get('paid_amount') || 0;
        const payment_term = fd.get('payment_term') || 'immediate';
        if (payment_term === 'immediate') paid_amount = amount;
        else if (payment_term === 'settlement') amount = 0;
        if (payment_term === 'credit' && paid_amount > amount) paid_amount = amount;
        try {
          await this.save('transactions', { type: 'project_expense', expense_category: fd.get('expense_category') || 'construction', payment_term, amount, paid_amount, client_id: project.client_id, party_id: project.client_id, party_name: project.client_name, party_type: 'client', project_id: fd.get('project_id'), project_name: project.name, vendor_id: fd.get('vendor_id') || null, vendor_name: vendor ? vendor.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        } catch (e) {
          if (e.message && (e.message.includes('expense_category') || e.message.includes('payment_term') || e.message.includes('paid_amount') || e.message.includes('42703') || e.message.includes('PGRST204'))) {
            await this.save('transactions', { type: 'project_expense', amount, paid_amount, client_id: project.client_id, party_id: project.client_id, party_name: project.client_name, party_type: 'client', project_id: fd.get('project_id'), project_name: project.name, vendor_id: fd.get('vendor_id') || null, vendor_name: vendor ? vendor.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
          } else { throw e; }
        }
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
      this._setupClientProjectCascade(overlay, projects, tx.client_id, tx.project_id);
    } else if (tx.type === 'office_expense') {
      const [employees, sectors] = await Promise.all([
        API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc'),
        API.request('sectors', 'GET', null, '?select=id,name&order=name.asc')
      ]);
      const fields = [
        { name: 'employee_id', label: 'الموظف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر موظف --' }, ...employees.map(e => ({ v: e.id, l: e.name }))] },
        { name: 'sector_id', label: 'التصنيف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر تصنيف --' }, ...sectors.map(s => ({ v: s.id, l: s.name }))] },
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      UI.openModal('تعديل مصروف مكتبي', `<form>${UI.form(fields, { ...tx, employee_id: tx.employee_id || '', sector_id: tx.sector_id || '' })}</form>`, async (form) => {
        const fd = new FormData(form);
        const emp = employees.find(e => e.id === fd.get('employee_id'));
        const sector = sectors.find(s => s.id === fd.get('sector_id'));
        await this.save('transactions', { type: 'office_expense', amount: +fd.get('amount') || 0, employee_id: fd.get('employee_id'), employee_name: emp ? emp.name : null, sector_id: fd.get('sector_id'), sector_name: sector ? sector.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
    } else if (tx.type === 'supervision') {
      const projects = await API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc');
      const fields = [
        { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name }))] },
        { name: 'amount', label: 'نسبة الإشراف', type: 'number', req: true },
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      UI.openModal('تعديل إشراف مشروع', `<form>${UI.form(fields, { ...tx, project_id: tx.project_id || '' })}</form>`, async (form) => {
        const fd = new FormData(form);
        const project = projects.find(p => p.id === fd.get('project_id'));
        await this.save('transactions', { type: 'supervision', amount: +fd.get('amount') || 0, client_id: project ? project.client_id : null, party_id: project ? project.client_id : null, party_name: project ? project.client_name : null, party_type: 'client', project_id: fd.get('project_id'), project_name: project ? project.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
    } else {
      const fields = [
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      const title = tx.type === 'withdrawal' ? 'تعديل سحب صاحب المكتب' : 'تعديل توريد';
      UI.openModal(title, `<form>${UI.form(fields, tx)}</form>`, async (form) => {
        const fd = new FormData(form);
        await this.save('transactions', { amount: +fd.get('amount') || 0, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions();
      });
    }
  },

  delTx(id) {
    UI.confirm('هل أنت متأكد من حذف هذه المعاملة؟', async () => { await this.softDelete('transactions', id); UI.toast('تم الحذف'); App.loadTransactions(); App.loadOffice(); });
  },

  // ─── USERS (admin only) ───
  addUser() {
    const cols = [
      { key: 'username', label: 'اسم المستخدم *', req: true },
      { key: 'name', label: 'الاسم الكامل *', req: true },
      { key: 'password', label: 'كلمة المرور *', req: true },
      { key: 'role', label: 'الدور', type: 'select', opts: [{ v: 'user', l: 'موظف' }, { v: 'admin', l: 'مدير' }] }
    ];
    Spreadsheet.open('إضافة مستخدمين', cols, async (rows) => {
      for (const row of rows) {
        const authData = await API.authCreateUser(Auth.toEmail(row.username), row.password, { name: row.name, username: row.username, role: row.role || 'user' });
        if (authData.user?.id) {
          await API.request('profiles', 'POST', { id: authData.user.id, name: row.name, username: row.username, role: row.role || 'user' });
        }
      }
      UI.toast(`تم إنشاء ${rows.length} مستخدم`);
      App.loadUsers();
    }, {}, {}, 'none');
  },

  async editUser(id) {
    const profiles = await API.request('profiles', 'GET', null, `?id=eq.${id}`);
    const profile = profiles[0];
    const fields = [
      { name: 'name', label: 'الاسم الكامل', req: true },
      { name: 'role', label: 'الدور', type: 'select', opts: [{ v: 'user', l: 'موظف' }, { v: 'admin', l: 'مدير' }] }
    ];
    UI.openModal('تعديل اسم المستخدم', `<form>${UI.form(fields, { name: profile?.name || '', role: profile?.role || 'user' })}</form>`, async (form) => {
      const fd = new FormData(form);
      if (profile) {
        await API.request('profiles', 'PATCH', { name: fd.get('name'), role: fd.get('role') }, `?id=eq.${id}`);
      } else {
        await API.request('profiles', 'POST', { id, name: fd.get('name'), role: fd.get('role') });
      }
      UI.toast('تم التحديث'); App.loadUsers();
    });
  },

  // ─── MASTER DATA: SECTORS & ITEMS ───
  addSector() {
    const cols = [
      { key: 'name', label: 'اسم التصنيف *', req: true },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('إضافة تصنيفات', cols, async (rows) => {
      await this.bulkSave('sectors', rows);
      UI.toast(`تم حفظ ${rows.length} تصنيف`);
      App.loadMasterData();
    }, {}, {}, 'none');
  },

  async editSector(id) {
    const rows = await API.request('sectors', 'GET', null, `?select=*&id=eq.${id}`);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم التصنيف', req: true },
      { name: 'description', label: 'الوصف', type: 'textarea' }
    ];
    UI.openModal('تعديل تصنيف', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('sectors', { name: fd.get('name'), description: fd.get('description') || null }, id);
      UI.toast('تم التحديث'); App.loadMasterData();
    });
  },

  delSector(id) {
    UI.confirm('هل أنت متأكد من حذف هذا التصنيف؟', async () => {
      await this.softDelete('sectors', id);
      UI.toast('تم الحذف'); App.loadMasterData();
    });
  },

  addItem() {
    const cols = [
      { key: 'name', label: 'اسم الصنف *', req: true },
      { key: 'specification', label: 'المواصفات' },
      { key: 'brand', label: 'الماركة' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة أصناف', cols, async (rows) => {
      await this.bulkSave('items', rows);
      UI.toast(`تم حفظ ${rows.length} صنف`);
      App.loadMasterData();
    }, {}, {}, 'none');
  },

  async editItem(id) {
    const rows = await API.request('items', 'GET', null, `?select=*&id=eq.${id}`);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم الصنف', req: true },
      { name: 'specification', label: 'المواصفات', type: 'textarea' },
      { name: 'brand', label: 'الماركة' },
      { name: 'unit', label: 'الوحدة' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل صنف', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('items', { name: fd.get('name'), specification: fd.get('specification') || null, brand: fd.get('brand') || null, unit: fd.get('unit') || null, notes: fd.get('notes') || null }, id);
      UI.toast('تم التحديث'); App.loadMasterData();
    });
  },

  delItem(id) {
    UI.confirm('هل أنت متأكد من حذف هذا الصنف؟', async () => {
      await this.softDelete('items', id);
      UI.toast('تم الحذف'); App.loadMasterData();
    });
  },

  // ─── PAYROLL ───
  async editPayroll(id) {
    const rows = await API.request('payroll_records', 'GET', null, `?select=*&id=eq.${id}`);
    if (!rows.length) return;
    const p = rows[0];
    const fields = [
      { name: 'base_salary', label: 'الراتب الأساسي', type: 'number', req: true },
      { name: 'days_present', label: 'أيام الحضور', type: 'number' },
      { name: 'days_absent', label: 'أيام الغياب', type: 'number' },
      { name: 'days_late', label: 'أيام التأخر', type: 'number' },
      { name: 'deductions', label: 'الخصومات', type: 'number' },
      { name: 'bonuses', label: 'المكافآت', type: 'number' },
      { name: 'penalties', label: 'الجزاءات', type: 'number' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل راتب — ' + p.employee_name, `<form>${UI.form(fields, p)}</form>`, async (form) => {
      const fd = new FormData(form);
      const base = +fd.get('base_salary') || 0;
      const deductions = +fd.get('deductions') || 0;
      const bonuses = +fd.get('bonuses') || 0;
      const penalties = +fd.get('penalties') || 0;
      const net = base - deductions + bonuses - penalties;
      await this.save('payroll_records', {
        base_salary: base, days_present: +fd.get('days_present') || 0, days_absent: +fd.get('days_absent') || 0,
        days_late: +fd.get('days_late') || 0, deductions, bonuses, penalties, net_salary: net, notes: fd.get('notes') || null
      }, id);
      UI.toast('تم التحديث'); App.loadEmpPayroll();
    });
  },

  async approvePayroll(id) {
    UI.confirm('هل أنت متأكد من اعتماد هذا الراتب؟', async () => {
      await this.save('payroll_records', { status: 'approved' }, id);
      UI.toast('تم الاعتماد'); App.loadEmpPayroll();
    });
  },

  async payPayroll(id) {
    UI.confirm('هل أنت متأكد من تسجيل دفع هذا الراتب؟', async () => {
      await this.save('payroll_records', { status: 'paid' }, id);
      UI.toast('تم تسجيل الدفع'); App.loadEmpPayroll();
    });
  },

  // ─── WORK SECTIONS & ITEMS (أقسام وبنود المشاريع) ───
  addWorkSection() {
    const cols = [
      { key: 'name', label: 'اسم القسم *', req: true },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة أقسام المشاريع', cols, async (rows) => {
      await this.bulkSave('work_sections', rows);
      UI.toast(`تم حفظ ${rows.length} قسم`);
      App.loadMasterData();
    }, {}, {}, 'none');
  },

  async editWorkSection(id) {
    const rows = await API.request('work_sections', 'GET', null, `?select=*&id=eq.${id}`);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم القسم', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل قسم', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('work_sections', { name: fd.get('name'), notes: fd.get('notes') || null }, id);
      UI.toast('تم التحديث'); App.loadMasterData();
    });
  },

  delWorkSection(id) {
    UI.confirm('هل أنت متأكد من حذف هذا القسم؟', async () => {
      await this.softDelete('work_sections', id);
      UI.toast('تم الحذف'); App.loadMasterData();
    });
  },

  async addWorkItem() {
    const sections = await API.request('work_sections', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc');
    const sectionOpts = sections.map(s => ({ v: s.id, l: s.name }));
    const cols = [
      { key: 'section_id', label: 'القسم', type: 'select', req: true, opts: [{ v: '', l: '-- اختر قسم --' }, ...sectionOpts] },
      { key: 'name', label: 'اسم البند *', req: true },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة بنود الأعمال', cols, async (rows) => {
      const enriched = rows.map(r => {
        const sec = sections.find(s => s.id === r.section_id);
        return { ...r, section_id: r.section_id || null, section_name: sec ? sec.name : null };
      });
      await this.bulkSave('work_items', enriched);
      UI.toast(`تم حفظ ${rows.length} بند`);
      App.loadMasterData();
    }, {}, {}, 'none');
  },

  async editWorkItem(id) {
    const [rows, sections] = await Promise.all([
      API.request('work_items', 'GET', null, `?select=*&id=eq.${id}`),
      API.request('work_sections', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    if (!rows.length) return;
    const fields = [
      { name: 'section_id', label: 'القسم', type: 'select', req: true, opts: [{ v: '', l: '-- اختر قسم --' }, ...sections.map(s => ({ v: s.id, l: s.name }))] },
      { name: 'name', label: 'اسم البند', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل بند', `<form>${UI.form(fields, { ...rows[0], section_id: rows[0].section_id || '' })}</form>`, async (form) => {
      const fd = new FormData(form);
      const sec = sections.find(s => s.id === fd.get('section_id'));
      await this.save('work_items', { section_id: fd.get('section_id'), section_name: sec ? sec.name : null, name: fd.get('name'), notes: fd.get('notes') || null }, id);
      UI.toast('تم التحديث'); App.loadMasterData();
    });
  },

  delWorkItem(id) {
    UI.confirm('هل أنت متأكد من حذف هذا البند؟', async () => {
      await this.softDelete('work_items', id);
      UI.toast('تم الحذف'); App.loadMasterData();
    });
  }
};
