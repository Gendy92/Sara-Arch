// Main Application Logic

const App = {
  currentScreen: 'login',
  loading: false,

  async init() {
    // Initialize auth first
    await Auth.init();

    // Setup navigation
    this.setupNav();

    // Route to correct screen
    if (Auth.isLoggedIn()) {
      await this.goTo('dashboard');
    } else {
      await this.goTo('login');
    }
  },

  setupNav() {
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-nav]');
      if (navBtn) {
        const screen = navBtn.dataset.nav;
        this.goTo(screen);
      }

      const logoutBtn = e.target.closest('[data-action="logout"]');
      if (logoutBtn) {
        this.handleLogout();
      }
    });

    // Form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.dataset.form === 'login') {
        e.preventDefault();
        this.handleLogin(form);
      } else if (form.dataset.form === 'register') {
        e.preventDefault();
        this.handleRegister(form);
      }
    });
  },

  async goTo(screen) {
    if (this.loading) return;

    // Auth guard
    if (screen !== 'login' && screen !== 'register' && !Auth.isLoggedIn()) {
      screen = 'login';
    }

    this.currentScreen = screen;
    this.render();

    // Load screen-specific data
    if (screen === 'dashboard') await this.loadDashboard();
    if (screen === 'clients') await this.loadClients();
    if (screen === 'projects') await this.loadProjects();
    if (screen === 'transactions') await this.loadTransactions();
    if (screen === 'employees') await this.loadEmployees();
  },

  render() {
    const app = document.getElementById('app');
    if (!app) return;

    switch (this.currentScreen) {
      case 'login':
        app.innerHTML = this.renderLogin();
        break;
      case 'register':
        app.innerHTML = this.renderRegister();
        break;
      case 'dashboard':
        app.innerHTML = this.renderLayout(this.renderDashboard());
        break;
      case 'clients':
        app.innerHTML = this.renderLayout(this.renderClients());
        break;
      case 'projects':
        app.innerHTML = this.renderLayout(this.renderProjects());
        break;
      case 'transactions':
        app.innerHTML = this.renderLayout(this.renderTransactions());
        break;
      case 'employees':
        app.innerHTML = this.renderLayout(this.renderEmployees());
        break;
      case 'settings':
        app.innerHTML = this.renderLayout(this.renderSettings());
        break;
      default:
        app.innerHTML = this.renderLogin();
    }
  },

  // ─── LAYOUT ───
  renderLayout(content) {
    const user = Auth.getUser();
    const userName = user?.user_metadata?.name || user?.email || 'المستخدم';

    return `
      <div class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-logo">
            <div class="logo-box">S</div>
            <div>
              <h2>سارة أبو العلا</h2>
              <p>النظام المالي</p>
            </div>
          </div>
          <nav class="sidebar-nav">
            <button data-nav="dashboard" class="nav-item ${this.currentScreen === 'dashboard' ? 'active' : ''}">
              <span>📊</span> الرئيسية
            </button>
            <button data-nav="clients" class="nav-item ${this.currentScreen === 'clients' ? 'active' : ''}">
              <span>👥</span> العملاء
            </button>
            <button data-nav="projects" class="nav-item ${this.currentScreen === 'projects' ? 'active' : ''}">
              <span>📁</span> المشاريع
            </button>
            <button data-nav="transactions" class="nav-item ${this.currentScreen === 'transactions' ? 'active' : ''}">
              <span>💰</span> المعاملات
            </button>
            <button data-nav="employees" class="nav-item ${this.currentScreen === 'employees' ? 'active' : ''}">
              <span>🧑‍💼</span> الموظفين
            </button>
            <button data-nav="settings" class="nav-item ${this.currentScreen === 'settings' ? 'active' : ''}">
              <span>⚙️</span> الإعدادات
            </button>
          </nav>
          <div class="sidebar-footer">
            <div class="user-info">
              <span>${userName}</span>
            </div>
            <button data-action="logout" class="btn-logout">🚪 خروج</button>
          </div>
        </aside>
        <main class="main-content">
          ${content}
        </main>
      </div>
    `;
  },

  // ─── LOGIN SCREEN ───
  renderLogin() {
    return `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="logo-box large">S</div>
            <h1>سارة أبو العلا</h1>
            <p>النظام المالي والمحاسبي</p>
          </div>
          <form data-form="login" class="auth-form">
            <div class="form-group">
              <label>البريد الإلكتروني</label>
              <input type="email" name="email" required placeholder="your@email.com" dir="ltr">
            </div>
            <div class="form-group">
              <label>كلمة المرور</label>
              <input type="password" name="password" required placeholder="••••••••" dir="ltr">
            </div>
            <button type="submit" class="btn btn-primary btn-block">دخول</button>
          </form>
          <p class="auth-footer">
            ليس لديك حساب؟ <a href="#" data-nav="register">سجل الآن</a>
          </p>
        </div>
      </div>
    `;
  },

  // ─── REGISTER SCREEN ───
  renderRegister() {
    return `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="logo-box large">S</div>
            <h1>إنشاء حساب</h1>
          </div>
          <form data-form="register" class="auth-form">
            <div class="form-group">
              <label>الاسم</label>
              <input type="text" name="name" required placeholder="محمد أحمد">
            </div>
            <div class="form-group">
              <label>البريد الإلكتروني</label>
              <input type="email" name="email" required placeholder="your@email.com" dir="ltr">
            </div>
            <div class="form-group">
              <label>كلمة المرور</label>
              <input type="password" name="password" required placeholder="6 أحرف على الأقل" dir="ltr" minlength="6">
            </div>
            <button type="submit" class="btn btn-primary btn-block">تسجيل</button>
          </form>
          <p class="auth-footer">
            لديك حساب؟ <a href="#" data-nav="login">تسجيل الدخول</a>
          </p>
        </div>
      </div>
    `;
  },

  // ─── DASHBOARD ───
  renderDashboard() {
    return `
      <div class="page-header">
        <h1>📊 لوحة التحكم</h1>
        <p>نظرة عامة على أداء المكتب</p>
      </div>
      <div class="kpi-grid" id="dashboard-kpis">
        <div class="kpi-card loading">جاري التحميل...</div>
      </div>
      <div class="content-grid">
        <div class="card">
          <h3>آخر المعاملات</h3>
          <div id="recent-transactions">جاري التحميل...</div>
        </div>
        <div class="card">
          <h3>المشاريع النشطة</h3>
          <div id="active-projects">جاري التحميل...</div>
        </div>
      </div>
    `;
  },

  // ─── CLIENTS ───
  renderClients() {
    return `
      <div class="page-header">
        <h1>👥 العملاء</h1>
        <button class="btn btn-primary" onclick="Crud.openAddClient()">+ عميل جديد</button>
      </div>
      <div class="card">
        <div class="table-responsive" id="clients-table">جاري التحميل...</div>
      </div>
    `;
  },

  // ─── PROJECTS ───
  renderProjects() {
    return `
      <div class="page-header">
        <h1>📁 المشاريع</h1>
        <button class="btn btn-primary" onclick="Crud.openAddProject()">+ مشروع جديد</button>
      </div>
      <div class="card">
        <div class="table-responsive" id="projects-table">جاري التحميل...</div>
      </div>
    `;
  },

  // ─── TRANSACTIONS ───
  renderTransactions() {
    return `
      <div class="page-header">
        <h1>💰 المعاملات المالية</h1>
        <button class="btn btn-primary" onclick="Crud.openAddTransaction()">+ معاملة جديدة</button>
      </div>
      <div class="card">
        <div class="table-responsive" id="transactions-table">جاري التحميل...</div>
      </div>
    `;
  },

  // ─── EMPLOYEES ───
  renderEmployees() {
    return `
      <div class="page-header">
        <h1>🧑‍💼 الموظفين</h1>
        <button class="btn btn-primary" onclick="Crud.openAddEmployee()">+ موظف جديد</button>
      </div>
      <div class="card">
        <div class="table-responsive" id="employees-table">جاري التحميل...</div>
      </div>
    `;
  },

  // ─── SETTINGS ───
  renderSettings() {
    const user = Auth.getUser();
    return `
      <div class="page-header">
        <h1>⚙️ الإعدادات</h1>
      </div>
      <div class="card">
        <h3>معلومات الحساب</h3>
        <p><strong>البريد:</strong> ${user?.email || ''}</p>
        <p><strong>الاسم:</strong> ${user?.user_metadata?.name || 'غير محدد'}</p>
        <hr style="margin:16px 0;border-color:var(--border)">
        <p style="color:var(--text3);font-size:12px">يمكنك تحديث معلوماتك من لوحة تحكم Supabase.</p>
      </div>
    `;
  },

  // ─── DATA LOADING ───
  async loadDashboard() {
    try {
      // Get counts
      const { data: clients } = await sb.from('clients').select('id', { count: 'exact', head: true });
      const { data: projects } = await sb.from('projects').select('id', { count: 'exact', head: true });
      const { data: employees } = await sb.from('employees').select('id', { count: 'exact', head: true });

      // Get transactions summary
      const { data: transactions } = await sb
        .from('transactions')
        .select('type, amount')
        .is('deleted_at', null);

      const income = transactions?.filter(t => t.type === 'income' || t.type === 'deposit').reduce((s, t) => s + (+t.amount || 0), 0) || 0;
      const expenses = transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + (+t.amount || 0), 0) || 0;

      document.getElementById('dashboard-kpis').innerHTML = `
        <div class="kpi-card"><div class="kpi-label">العملاء</div><div class="kpi-value">${clients?.length || 0}</div></div>
        <div class="kpi-card"><div class="kpi-label">المشاريع</div><div class="kpi-value">${projects?.length || 0}</div></div>
        <div class="kpi-card"><div class="kpi-label">الموظفين</div><div class="kpi-value">${employees?.length || 0}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي الإيرادات</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(income)}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expenses)}</div></div>
        <div class="kpi-card"><div class="kpi-label">صافي الربح</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(income - expenses)}</div></div>
      `;

      // Recent transactions
      const { data: recent } = await sb
        .from('transactions')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      document.getElementById('recent-transactions').innerHTML = recent?.length
        ? `<table class="data-table"><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الوصف</th></tr></thead><tbody>${recent.map(t => `
          <tr><td>${this.fmtDate(t.created_at)}</td><td>${t.type}</td><td>${this.fmtMoney(t.amount)}</td><td>${t.description || '-'}</td></tr>
        `).join('')}</tbody></table>`
        : '<p style="color:var(--text3)">لا توجد معاملات</p>';

      // Active projects
      const { data: activeProjects } = await sb
        .from('projects')
        .select('*')
        .is('deleted_at', null)
        .eq('status', 'active')
        .limit(5);

      document.getElementById('active-projects').innerHTML = activeProjects?.length
        ? `<table class="data-table"><thead><tr><th>المشروع</th><th>العميل</th><th>الحالة</th></tr></thead><tbody>${activeProjects.map(p => `
          <tr><td>${p.name}</td><td>${p.client_name || '-'}</td><td><span class="badge badge-green">نشط</span></td></tr>
        `).join('')}</tbody></table>`
        : '<p style="color:var(--text3)">لا توجد مشاريع نشطة</p>';

    } catch (e) {
      console.error('Dashboard load error:', e);
      document.getElementById('dashboard-kpis').innerHTML = `<div class="error">خطأ في تحميل البيانات: ${e.message}</div>`;
    }
  },

  async loadClients() {
    try {
      const { data, error } = await sb.from('clients').select('*').is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      const table = document.getElementById('clients-table');
      if (!table) return;
      table.innerHTML = data?.length
        ? `<table class="data-table"><thead><tr><th>الاسم</th><th>الهاتف</th><th>البريد</th><th>العنوان</th><th>الإجراءات</th></tr></thead><tbody>${data.map(c => `
          <tr><td>${c.name}</td><td>${c.phone || '-'}</td><td>${c.email || '-'}</td><td>${c.address || '-'}</td>
          <td>${UI.actionButtons(c.id, 'Crud.openEditClient', 'Crud.deleteClient')}</td></tr>
        `).join('')}</tbody></table>`
        : '<p style="color:var(--text3)">لا يوجد عملاء</p>';
    } catch (e) {
      console.error('Clients load error:', e);
    }
  },

  async loadProjects() {
    try {
      const { data, error } = await sb.from('projects').select('*').is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      const table = document.getElementById('projects-table');
      if (!table) return;
      table.innerHTML = data?.length
        ? `<table class="data-table"><thead><tr><th>المشروع</th><th>العميل</th><th>القيمة</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>${data.map(p => `
          <tr><td>${p.name}</td><td>${p.client_name || '-'}</td><td>${this.fmtMoney(p.value)}</td><td><span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${p.status}</span></td>
          <td>${UI.actionButtons(p.id, 'Crud.openEditProject', 'Crud.deleteProject')}</td></tr>
        `).join('')}</tbody></table>`
        : '<p style="color:var(--text3)">لا توجد مشاريع</p>';
    } catch (e) {
      console.error('Projects load error:', e);
    }
  },

  async loadTransactions() {
    try {
      const { data, error } = await sb.from('transactions').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const table = document.getElementById('transactions-table');
      if (!table) return;
      table.innerHTML = data?.length
        ? `<table class="data-table"><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الوصف</th><th>الجهة</th><th>الإجراءات</th></tr></thead><tbody>${data.map(t => `
          <tr><td>${this.fmtDate(t.created_at)}</td><td><span class="badge badge-${t.type === 'income' || t.type === 'deposit' ? 'green' : 'red'}">${t.type}</span></td><td>${this.fmtMoney(t.amount)}</td><td>${t.description || '-'}</td><td>${t.party_name || '-'}</td>
          <td>${UI.actionButtons(t.id, 'Crud.openEditTransaction', 'Crud.deleteTransaction')}</td></tr>
        `).join('')}</tbody></table>`
        : '<p style="color:var(--text3)">لا توجد معاملات</p>';
    } catch (e) {
      console.error('Transactions load error:', e);
    }
  },

  async loadEmployees() {
    try {
      const { data, error } = await sb.from('employees').select('*').eq('is_active', true).is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      const table = document.getElementById('employees-table');
      if (!table) return;
      table.innerHTML = data?.length
        ? `<table class="data-table"><thead><tr><th>الاسم</th><th>الوظيفة</th><th>الراتب</th><th>الهاتف</th><th>الإجراءات</th></tr></thead><tbody>${data.map(e => `
          <tr><td>${e.name}</td><td>${e.job_title || '-'}</td><td>${this.fmtMoney(e.salary)}</td><td>${e.phone || '-'}</td>
          <td>${UI.actionButtons(e.id, 'Crud.openEditEmployee', 'Crud.deleteEmployee')}</td></tr>
        `).join('')}</tbody></table>`
        : '<p style="color:var(--text3)">لا يوجد موظفين</p>';
    } catch (e) {
      console.error('Employees load error:', e);
    }
  },

  // ─── AUTH HANDLERS ───
  async handleLogin(form) {
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جاري الدخول...';
    try {
      await Auth.login(fd.get('email'), fd.get('password'));
    } catch (e) {
      alert('خطأ في الدخول: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'دخول';
    }
  },

  async handleRegister(form) {
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جاري التسجيل...';
    try {
      await Auth.register(fd.get('email'), fd.get('password'), { name: fd.get('name') });
      alert('تم إنشاء الحساب! يرجى تأكيد بريدك الإلكتروني.');
      this.goTo('login');
    } catch (e) {
      alert('خطأ في التسجيل: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'تسجيل';
    }
  },

  async handleLogout() {
    if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
    try {
      await Auth.logout();
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
  },

  // ─── HELPERS ───
  fmtMoney(n) {
    return (+n || 0).toLocaleString('ar-EG') + ' ج.م';
  },

  fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ar-EG');
  },

  refreshCurrentScreen() {
    this.goTo(this.currentScreen);
  }
};

window.App = App;

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Fallback: if DOM is already loaded, init immediately
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  App.init();
}
