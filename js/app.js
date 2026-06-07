// Main App

const App = {
  screen: 'login',
  loading: false,

  async start() {
    try {
      await Auth.init();
      this.bindNav();
      if (Auth.isLoggedIn()) await this.go('dashboard');
      else this.renderLogin();
    } catch (e) {
      this.showError('فشل تحميل التطبيق: ' + e.message);
    }
  },

  bindNav() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) this.go(nav.dataset.nav);
      if (e.target.closest('[data-action="logout"]')) this.doLogout();
    });
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.dataset.form === 'login') { e.preventDefault(); this.doLogin(form); }
      if (form.dataset.form === 'register') { e.preventDefault(); this.doRegister(form); }
    });
  },

  async go(screen) {
    const isAdmin = Auth.user?.user_metadata?.role === 'admin';
    if (screen !== 'login' && !Auth.isLoggedIn()) { screen = 'login'; }
    if ((screen === 'register' || screen === 'users') && !isAdmin) { screen = 'dashboard'; }
    this.screen = screen;
    const app = document.getElementById('app');
    if (!app) return;

    if (screen === 'login') this.renderLogin();
    else if (screen === 'register') this.renderRegister();
    else app.innerHTML = this.layout(this.pageContent(screen));

    if (screen === 'dashboard') await this.loadDashboard();
    if (screen === 'clients') await this.loadClients();
    if (screen === 'projects') await this.loadProjects();
    if (screen === 'transactions') await this.loadTransactions();
    if (screen === 'employees') await this.loadEmployees();
    if (screen === 'users') await this.loadUsers();
  },

  layout(content) {
    const user = Auth.user || {};
    const name = user.displayName || user.user_metadata?.name || 'المستخدم';
    const isAdmin = user.user_metadata?.role === 'admin';
    return `<div class="app-layout"><aside class="sidebar"><div class="sidebar-logo"><div class="logo-box">S</div><div><h2>سارة أبو العلا</h2><p>النظام المالي</p></div></div><nav class="sidebar-nav">
      <button data-nav="dashboard" class="nav-item ${this.screen === 'dashboard' ? 'active' : ''}"><span>📊</span> الرئيسية</button>
      <button data-nav="clients" class="nav-item ${this.screen === 'clients' ? 'active' : ''}"><span>👥</span> العملاء</button>
      <button data-nav="projects" class="nav-item ${this.screen === 'projects' ? 'active' : ''}"><span>📁</span> المشاريع</button>
      <button data-nav="transactions" class="nav-item ${this.screen === 'transactions' ? 'active' : ''}"><span>💰</span> المعاملات</button>
      <button data-nav="employees" class="nav-item ${this.screen === 'employees' ? 'active' : ''}"><span>🧑‍💼</span> الموظفين</button>
      ${isAdmin ? `<button data-nav="users" class="nav-item ${this.screen === 'users' ? 'active' : ''}"><span>🔐</span> المستخدمين</button>` : ''}
    </nav><div class="sidebar-footer"><div class="user-info">${name}</div><div style="font-size:10px;color:var(--text3);text-align:center;margin-bottom:4px">${isAdmin ? '👑 مدير' : '👤 موظف'}</div><button data-action="logout" class="btn-logout">🚪 خروج</button></div></aside><main class="main-content">${content}</main></div>`;
  },

  pageContent(screen) {
    if (screen === 'dashboard') return `<div class="page-header"><h1>📊 لوحة التحكم</h1></div><div class="kpi-grid" id="kpis"><div class="kpi-card">جاري التحميل...</div></div><div class="content-grid"><div class="card"><h3>آخر المعاملات</h3><div id="recent-tx">جاري التحميل...</div></div><div class="card"><h3>المشاريع النشطة</h3><div id="active-proj">جاري التحميل...</div></div></div>`;
    if (screen === 'clients') return `<div class="page-header"><h1>👥 العملاء</h1><button class="btn btn-primary" onclick="Crud.addClient()">+ عميل جديد</button></div><div class="card"><div id="clients-tbl">جاري التحميل...</div></div>`;
    if (screen === 'projects') return `<div class="page-header"><h1>📁 المشاريع</h1><button class="btn btn-primary" onclick="Crud.addProject()">+ مشروع جديد</button></div><div class="card"><div id="projects-tbl">جاري التحميل...</div></div>`;
    if (screen === 'transactions') return `<div class="page-header"><h1>💰 المعاملات</h1><button class="btn btn-primary" onclick="Crud.addTx()">+ معاملة جديدة</button></div><div class="card"><div id="tx-tbl">جاري التحميل...</div></div>`;
    if (screen === 'employees') return `<div class="page-header"><h1>🧑‍💼 الموظفين</h1><button class="btn btn-primary" onclick="Crud.addEmp()">+ موظف جديد</button></div><div class="card"><div id="emp-tbl">جاري التحميل...</div></div>`;
    if (screen === 'users') return `<div class="page-header"><h1>🔐 إدارة المستخدمين</h1><button class="btn btn-primary" onclick="Crud.addUser()">+ مستخدم جديد</button></div><div class="card"><div id="users-tbl">جاري التحميل...</div></div>`;
    return '';
  },

  renderLogin() {
    document.getElementById('app').innerHTML = `<div class="auth-page"><div class="auth-card"><div class="auth-logo"><div class="logo-box large">S</div><h1>سارة أبو العلا</h1><p>النظام المالي والمحاسبي</p></div><form data-form="login" class="auth-form"><div class="form-group"><label>اسم المستخدم</label><input type="text" name="username" required placeholder="admin" dir="ltr"></div><div class="form-group"><label>كلمة المرور</label><input type="password" name="password" required placeholder="••••••••" dir="ltr"></div><button type="submit" class="btn btn-primary btn-block">دخول</button></form></div></div>`;
  },

  renderRegister() {
    document.getElementById('app').innerHTML = `<div class="auth-page"><div class="auth-card"><div class="auth-logo"><div class="logo-box large">S</div><h1>إضافة مستخدم جديد</h1></div><form data-form="register" class="auth-form"><div class="form-group"><label>اسم المستخدم</label><input type="text" name="username" required dir="ltr"></div><div class="form-group"><label>الاسم الكامل</label><input type="text" name="name" required></div><div class="form-group"><label>كلمة المرور</label><input type="password" name="password" required minlength="6" dir="ltr"></div><button type="submit" class="btn btn-primary btn-block">إنشاء</button></form></div></div>`;
  },

  async doLogin(form) {
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'جاري الدخول...';
    try {
      await Auth.login(fd.get('username'), fd.get('password'));
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
    Auth.logout();
    this.renderLogin();
  },

  showError(msg) {
    document.getElementById('app').innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;text-align:center"><div style="font-size:48px">⚠️</div><h2 style="color:var(--red)">حدث خطأ</h2><p style="color:var(--text2);max-width:400px">${msg}</p><button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button></div>`;
  },

  // ─── DATA LOADING ───
  async loadDashboard() {
    try {
      const clients = await API.request('clients', 'GET', null, '?select=id&deleted_at=is.null');
      const projects = await API.request('projects', 'GET', null, '?select=id&deleted_at=is.null');
      const employees = await API.request('employees', 'GET', null, '?select=id&is_active=eq.true&deleted_at=is.null');
      const txs = await API.request('transactions', 'GET', null, '?select=type,amount&deleted_at=is.null');
      const income = txs.filter(t => t.type === 'income' || t.type === 'deposit').reduce((s, t) => s + (+t.amount || 0), 0);
      const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + (+t.amount || 0), 0);
      document.getElementById('kpis').innerHTML = `
        <div class="kpi-card"><div class="kpi-label">العملاء</div><div class="kpi-value">${clients.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">المشاريع</div><div class="kpi-value">${projects.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">الموظفين</div><div class="kpi-value">${employees.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">الإيرادات</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(income)}</div></div>
        <div class="kpi-card"><div class="kpi-label">المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(exp)}</div></div>
        <div class="kpi-card"><div class="kpi-label">صافي الربح</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(income - exp)}</div></div>`;
      const recent = await API.request('transactions', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc&limit=5');
      document.getElementById('recent-tx').innerHTML = recent.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف'], recent.map(t => [this.fmtDate(t.created_at), t.type, this.fmtMoney(t.amount), t.description || '-'])) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      const active = await API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&status=eq.active&limit=5');
      document.getElementById('active-proj').innerHTML = active.length ? this.table(['المشروع', 'العميل', 'الحالة'], active.map(p => [p.name, p.client_name || '-', '<span class="badge badge-green">نشط</span>'])) : '<p style="color:var(--text3)">لا توجد مشاريع نشطة</p>';
    } catch (e) { console.error(e); }
  },

  async loadClients() {
    try {
      const data = await API.request('clients', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc');
      document.getElementById('clients-tbl').innerHTML = data.length ? this.table(['الاسم', 'الهاتف', 'البريد', 'الإجراءات'], data.map(c => [c.name, c.phone || '-', c.email || '-', UI.actions(c.id, 'Crud.editClient', 'Crud.delClient')])) : '<p style="color:var(--text3)">لا يوجد عملاء</p>';
    } catch (e) { console.error(e); }
  },

  async loadProjects() {
    try {
      const data = await API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc');
      document.getElementById('projects-tbl').innerHTML = data.length ? this.table(['المشروع', 'العميل', 'القيمة', 'الحالة', 'الإجراءات'], data.map(p => [p.name, p.client_name || '-', this.fmtMoney(p.value), `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${p.status}</span>`, UI.actions(p.id, 'Crud.editProject', 'Crud.delProject')])) : '<p style="color:var(--text3)">لا توجد مشاريع</p>';
    } catch (e) { console.error(e); }
  },

  async loadTransactions() {
    try {
      const data = await API.request('transactions', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc&limit=50');
      document.getElementById('tx-tbl').innerHTML = data.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف', 'الجهة', 'الإجراءات'], data.map(t => [this.fmtDate(t.created_at), `<span class="badge badge-${t.type === 'income' || t.type === 'deposit' ? 'green' : 'red'}">${t.type}</span>`, this.fmtMoney(t.amount), t.description || '-', t.party_name || '-', UI.actions(t.id, 'Crud.editTx', 'Crud.delTx')])) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
    } catch (e) { console.error(e); }
  },

  async loadEmployees() {
    try {
      const data = await API.request('employees', 'GET', null, '?select=*&is_active=eq.true&deleted_at=is.null&order=created_at.desc');
      document.getElementById('emp-tbl').innerHTML = data.length ? this.table(['الاسم', 'الوظيفة', 'الراتب', 'الهاتف', 'الإجراءات'], data.map(e => [e.name, e.job_title || '-', this.fmtMoney(e.salary), e.phone || '-', UI.actions(e.id, 'Crud.editEmp', 'Crud.delEmp')])) : '<p style="color:var(--text3)">لا يوجد موظفين</p>';
    } catch (e) { console.error(e); }
  },

  async loadUsers() {
    try {
      const data = await API.authListUsers();
      const users = data.users || [];
      document.getElementById('users-tbl').innerHTML = users.length ? this.table(['المستخدم', 'الاسم', 'الدور', 'الحالة', 'تاريخ الإنشاء'], users.map(u => [
        Auth.fromEmail(u.email),
        u.user_metadata?.name || '-',
        u.user_metadata?.role === 'admin' ? '<span class="badge badge-green">مدير</span>' : '<span class="badge badge-gray">موظف</span>',
        u.email_confirmed_at ? '<span class="badge badge-green">مفعل</span>' : '<span class="badge badge-red">غير مفعل</span>',
        this.fmtDate(u.created_at)
      ])) : '<p style="color:var(--text3)">لا يوجد مستخدمين</p>';
    } catch (e) { console.error(e); document.getElementById('users-tbl').innerHTML = '<p style="color:var(--red)">خطأ في تحميل المستخدمين</p>'; }
  },

  table(headers, rows) {
    return `<div class="table-responsive"><table class="data-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },

  fmtMoney(n) { return (+n || 0).toLocaleString('ar-EG') + ' ج.م'; },
  fmtDate(d) { return d ? new Date(d).toLocaleDateString('ar-EG') : '-'; }
};

// ─── CRUD ───
const Crud = {
  async save(table, data, id) {
    if (id) { await API.request(table, 'PATCH', data, '?id=eq.' + id); return { id, ...data }; }
    else { return API.request(table, 'POST', data); }
  },

  async softDelete(table, id) {
    await API.request(table, 'PATCH', { deleted_at: new Date().toISOString() }, '?id=eq.' + id);
  },

  // Clients
  addClient() {
    UI.openModal('عميل جديد', `<form>${UI.form([{name:'name',label:'اسم العميل',req:true},{name:'phone',label:'الهاتف'},{name:'email',label:'البريد'},{name:'address',label:'العنوان'},{name:'notes',label:'ملاحظات',type:'textarea'}])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('clients', {name:fd.get('name'),phone:fd.get('phone')||null,email:fd.get('email')||null,address:fd.get('address')||null,notes:fd.get('notes')||null});
      UI.toast('تم الحفظ'); App.loadClients();
    });
  },

  async editClient(id) {
    const rows = await API.request('clients', 'GET', null, '?select=*&id=eq.' + id);
    if (!rows.length) return;
    UI.openModal('تعديل عميل', `<form>${UI.form([{name:'name',label:'اسم العميل',req:true},{name:'phone',label:'الهاتف'},{name:'email',label:'البريد'},{name:'address',label:'العنوان'},{name:'notes',label:'ملاحظات',type:'textarea'}], rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('clients', {name:fd.get('name'),phone:fd.get('phone')||null,email:fd.get('email')||null,address:fd.get('address')||null,notes:fd.get('notes')||null}, id);
      UI.toast('تم التحديث'); App.loadClients();
    });
  },

  delClient(id) {
    UI.confirm('هل أنت متأكد من حذف هذا العميل؟', async () => { await this.softDelete('clients', id); UI.toast('تم الحذف'); App.loadClients(); });
  },

  // Projects
  addProject() {
    UI.openModal('مشروع جديد', `<form>${UI.form([{name:'name',label:'اسم المشروع',req:true},{name:'client_name',label:'اسم العميل'},{name:'value',label:'القيمة',type:'number',default:0},{name:'status',label:'الحالة',type:'select',opts:[{v:'active',l:'نشط'},{v:'completed',l:'منتهي'},{v:'on_hold',l:'معلق'},{v:'cancelled',l:'ملغي'}]},{name:'start_date',label:'تاريخ البدء',type:'date'},{name:'end_date',label:'تاريخ الانتهاء',type:'date'},{name:'notes',label:'ملاحظات',type:'textarea'}])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('projects', {name:fd.get('name'),client_name:fd.get('client_name')||null,value:+fd.get('value')||0,status:fd.get('status')||'active',start_date:fd.get('start_date')||null,end_date:fd.get('end_date')||null,notes:fd.get('notes')||null});
      UI.toast('تم الحفظ'); App.loadProjects();
    });
  },

  async editProject(id) {
    const rows = await API.request('projects', 'GET', null, '?select=*&id=eq.' + id);
    if (!rows.length) return;
    UI.openModal('تعديل مشروع', `<form>${UI.form([{name:'name',label:'اسم المشروع',req:true},{name:'client_name',label:'اسم العميل'},{name:'value',label:'القيمة',type:'number'},{name:'status',label:'الحالة',type:'select',opts:[{v:'active',l:'نشط'},{v:'completed',l:'منتهي'},{v:'on_hold',l:'معلق'},{v:'cancelled',l:'ملغي'}]},{name:'start_date',label:'تاريخ البدء',type:'date'},{name:'end_date',label:'تاريخ الانتهاء',type:'date'},{name:'notes',label:'ملاحظات',type:'textarea'}], rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('projects', {name:fd.get('name'),client_name:fd.get('client_name')||null,value:+fd.get('value')||0,status:fd.get('status')||'active',start_date:fd.get('start_date')||null,end_date:fd.get('end_date')||null,notes:fd.get('notes')||null}, id);
      UI.toast('تم التحديث'); App.loadProjects();
    });
  },

  delProject(id) {
    UI.confirm('هل أنت متأكد من حذف هذا المشروع؟', async () => { await this.softDelete('projects', id); UI.toast('تم الحذف'); App.loadProjects(); });
  },

  // Employees
  addEmp() {
    UI.openModal('موظف جديد', `<form>${UI.form([{name:'name',label:'اسم الموظف',req:true},{name:'job_title',label:'الوظيفة'},{name:'salary',label:'الراتب',type:'number',default:0},{name:'phone',label:'الهاتف'},{name:'email',label:'البريد'},{name:'hire_date',label:'تاريخ التعيين',type:'date'},{name:'notes',label:'ملاحظات',type:'textarea'}])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('employees', {name:fd.get('name'),job_title:fd.get('job_title')||null,salary:+fd.get('salary')||0,phone:fd.get('phone')||null,email:fd.get('email')||null,hire_date:fd.get('hire_date')||null,notes:fd.get('notes')||null});
      UI.toast('تم الحفظ'); App.loadEmployees();
    });
  },

  async editEmp(id) {
    const rows = await API.request('employees', 'GET', null, '?select=*&id=eq.' + id);
    if (!rows.length) return;
    UI.openModal('تعديل موظف', `<form>${UI.form([{name:'name',label:'اسم الموظف',req:true},{name:'job_title',label:'الوظيفة'},{name:'salary',label:'الراتب',type:'number'},{name:'phone',label:'الهاتف'},{name:'email',label:'البريد'},{name:'hire_date',label:'تاريخ التعيين',type:'date'},{name:'notes',label:'ملاحظات',type:'textarea'}], rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('employees', {name:fd.get('name'),job_title:fd.get('job_title')||null,salary:+fd.get('salary')||0,phone:fd.get('phone')||null,email:fd.get('email')||null,hire_date:fd.get('hire_date')||null,notes:fd.get('notes')||null}, id);
      UI.toast('تم التحديث'); App.loadEmployees();
    });
  },

  delEmp(id) {
    UI.confirm('هل أنت متأكد من حذف هذا الموظف؟', async () => { await this.softDelete('employees', id); UI.toast('تم الحذف'); App.loadEmployees(); });
  },

  // Transactions
  addTx() {
    UI.openModal('معاملة جديدة', `<form>${UI.form([{name:'type',label:'النوع',type:'select',req:true,opts:[{v:'income',l:'إيراد'},{v:'expense',l:'مصروف'},{v:'deposit',l:'عربون'},{v:'supervision',l:'إشراف'},{v:'office_expense',l:'مصروف مكتبي'}]},{name:'amount',label:'المبلغ',type:'number',req:true,default:0},{name:'party_name',label:'الجهة / الاسم'},{name:'project_name',label:'المشروع'},{name:'date',label:'التاريخ',type:'date'},{name:'description',label:'الوصف',type:'textarea'}])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('transactions', {type:fd.get('type'),amount:+fd.get('amount')||0,party_name:fd.get('party_name')||null,project_name:fd.get('project_name')||null,date:fd.get('date')||new Date().toISOString().slice(0,10),description:fd.get('description')||null});
      UI.toast('تم الحفظ'); App.loadTransactions();
    });
  },

  async editTx(id) {
    const rows = await API.request('transactions', 'GET', null, '?select=*&id=eq.' + id);
    if (!rows.length) return;
    UI.openModal('تعديل معاملة', `<form>${UI.form([{name:'type',label:'النوع',type:'select',req:true,opts:[{v:'income',l:'إيراد'},{v:'expense',l:'مصروف'},{v:'deposit',l:'عربون'},{v:'supervision',l:'إشراف'},{v:'office_expense',l:'مصروف مكتبي'}]},{name:'amount',label:'المبلغ',type:'number',req:true},{name:'party_name',label:'الجهة / الاسم'},{name:'project_name',label:'المشروع'},{name:'date',label:'التاريخ',type:'date'},{name:'description',label:'الوصف',type:'textarea'}], rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('transactions', {type:fd.get('type'),amount:+fd.get('amount')||0,party_name:fd.get('party_name')||null,project_name:fd.get('project_name')||null,date:fd.get('date')||new Date().toISOString().slice(0,10),description:fd.get('description')||null}, id);
      UI.toast('تم التحديث'); App.loadTransactions();
    });
  },

  delTx(id) {
    UI.confirm('هل أنت متأكد من حذف هذه المعاملة؟', async () => { await this.softDelete('transactions', id); UI.toast('تم الحذف'); App.loadTransactions(); });
  },

  // Users (admin only)
  addUser() {
    UI.openModal('مستخدم جديد', `<form>${UI.form([{name:'username',label:'اسم المستخدم',req:true},{name:'name',label:'الاسم الكامل',req:true},{name:'password',label:'كلمة المرور',req:true},{name:'role',label:'الدور',type:'select',opts:[{v:'user',l:'موظف'},{v:'admin',l:'مدير'}]}])}</form>`, async (form) => {
      const fd = new FormData(form);
      await API.authCreateUser(Auth.toEmail(fd.get('username')), fd.get('password'), { name: fd.get('name'), username: fd.get('username'), role: fd.get('role') || 'user' });
      UI.toast('تم إنشاء المستخدم'); App.loadUsers();
    });
  }
};
