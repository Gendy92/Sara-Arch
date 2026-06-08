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
    if (screen === 'vendors') await this.loadVendors();
    if (screen === 'transactions') await this.loadTransactions();
    if (screen === 'office') await this.loadOffice();
    if (screen === 'employees') await this.loadEmployees();
    if (screen === 'users') await this.loadUsers();
  },

  layout(content) {
    const user = Auth.user || {};
    const name = user.displayName || user.user_metadata?.name || 'المستخدم';
    const isAdmin = user.user_metadata?.role === 'admin';
    return `<div class="app-layout"><aside class="sidebar" id="sidebar"><div class="sidebar-logo"><img src="logo.png" alt="Sara Abo Elelaa"><h2>سارة أبو العلا</h2><p>النظام المالي والمحاسبي</p></div><nav class="sidebar-nav">
      <button data-nav="dashboard" class="nav-item ${this.screen === 'dashboard' ? 'active' : ''}"><span>📊</span> الرئيسية</button>
      <button data-nav="clients" class="nav-item ${this.screen === 'clients' ? 'active' : ''}"><span>👥</span> العملاء</button>
      <button data-nav="projects" class="nav-item ${this.screen === 'projects' ? 'active' : ''}"><span>📁</span> المشاريع</button>
      <button data-nav="vendors" class="nav-item ${this.screen === 'vendors' ? 'active' : ''}"><span>🚚</span> الموردين</button>
      <button data-nav="transactions" class="nav-item ${this.screen === 'transactions' ? 'active' : ''}"><span>💰</span> المعاملات</button>
      <button data-nav="office" class="nav-item ${this.screen === 'office' ? 'active' : ''}"><span>🏢</span> المكتب</button>
      <button data-nav="employees" class="nav-item ${this.screen === 'employees' ? 'active' : ''}"><span>🧑‍💼</span> الموظفين</button>
      ${isAdmin ? `<button data-nav="users" class="nav-item ${this.screen === 'users' ? 'active' : ''}"><span>🔐</span> المستخدمين</button>` : ''}
    </nav><div class="sidebar-footer"><div class="user-info">${name}</div><div style="font-size:10px;color:var(--text3);text-align:center;margin-bottom:4px">${isAdmin ? '👑 مدير' : '👤 موظف'}</div><button data-action="logout" class="btn-logout">🚪 خروج</button></div></aside><button class="hamburger" id="hamburger-btn" onclick="App.toggleSidebar()"><span></span><span></span><span></span></button><main class="main-content">${content}</main></div>`;
  },

  pageContent(screen) {
    if (screen === 'dashboard') return `<div class="page-header"><h1>📊 لوحة التحكم</h1></div><div class="kpi-grid" id="kpis"><div class="kpi-card">جاري التحميل...</div></div><div class="card"><h3>💳 أرصدة العملاء</h3><div id="customer-balances">جاري التحميل...</div></div><div class="content-grid"><div class="card"><h3>آخر المعاملات</h3><div id="recent-tx">جاري التحميل...</div></div><div class="card"><h3>المشاريع النشطة</h3><div id="active-proj">جاري التحميل...</div></div></div>`;
    if (screen === 'clients') return `<div class="page-header"><h1>👥 العملاء</h1><button class="btn btn-primary" onclick="Crud.addClient()">+ إضافة عملاء</button></div><div class="card"><div id="clients-tbl">جاري التحميل...</div></div>`;
    if (screen === 'projects') return `<div class="page-header"><h1>📁 المشاريع</h1><button class="btn btn-primary" onclick="Crud.addProject()">+ إضافة مشاريع</button></div><div class="card"><div id="projects-tbl">جاري التحميل...</div></div>`;
    if (screen === 'transactions') return `<div class="page-header"><h1>💰 المعاملات</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="Crud.addProjectDeposit()">💰 عربون مشروع</button><button class="btn btn-primary" onclick="Crud.addProjectExpense()">🔨 مصروف مشروع</button></div></div><div class="kpi-grid" id="tx-kpis"><div class="kpi-card">جاري التحميل...</div></div><div class="card"><h3>📈 وارد vs مصروف — آخر 6 أشهر</h3><div id="monthly-chart">جاري التحميل...</div></div><div class="card"><div id="tx-tbl">جاري التحميل...</div></div>`;
    if (screen === 'office') return `<div class="page-header"><h1>🏢 حساب المكتب</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="Crud.addOfficeExpense()">🏢 مصروف مكتبي</button><button class="btn btn-primary" onclick="Crud.addOwnerDeposit()">👤 توريد صاحب المكتب</button><button class="btn btn-primary" onclick="Crud.addOwnerWithdrawal()">🏃 سحب صاحب المكتب</button></div></div><div class="kpi-grid" id="office-kpis"><div class="kpi-card">جاري التحميل...</div></div><div class="card" style="margin-top:16px"><h3>تفاصيل المعاملات</h3><div id="office-tbl">جاري التحميل...</div></div>`;
    if (screen === 'vendors') return `<div class="page-header"><h1>🚚 الموردين</h1><button class="btn btn-primary" onclick="Crud.addVendor()">+ إضافة مورد</button></div><div class="card"><div id="vendors-tbl">جاري التحميل...</div></div>`;
    if (screen === 'employees') return `<div class="page-header"><h1>🧑‍💼 الموظفين</h1><button class="btn btn-primary" onclick="Crud.addEmp()">+ إضافة موظفين</button></div><div class="card"><div id="emp-tbl">جاري التحميل...</div></div>`;
    if (screen === 'users') return `<div class="page-header"><h1>🔐 إدارة المستخدمين</h1><button class="btn btn-primary" onclick="Crud.addUser()">+ إضافة مستخدمين</button></div><div class="card"><div id="users-tbl">جاري التحميل...</div></div>`;
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
      const [clients, projects, employees, txs] = await Promise.all([
        API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('projects', 'GET', null, '?select=id,status,client_id,supervision_percentage&deleted_at=is.null'),
        API.request('employees', 'GET', null, '?select=id&is_active=eq.true&deleted_at=is.null'),
        API.request('transactions', 'GET', null, '?select=type,amount,client_id,project_id&deleted_at=is.null')
      ]);
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const totalIncome = txs.filter(t => ['project_deposit','owner_deposit'].includes(t.type)).reduce((s, t) => s + (+t.amount || 0), 0);
      const totalExp = txs.filter(t => ['project_expense','office_expense'].includes(t.type)).reduce((s, t) => s + (+t.amount || 0), 0);
      document.getElementById('kpis').innerHTML = `
        <div class="kpi-card"><div class="kpi-label">العملاء</div><div class="kpi-value">${clients.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">المشاريع</div><div class="kpi-value">${projects.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">النشطة</div><div class="kpi-value" style="color:var(--green)">${activeProjects}</div></div>
        <div class="kpi-card"><div class="kpi-label">الموظفين</div><div class="kpi-value">${employees.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي الحركة</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(totalIncome + totalExp)}</div></div>`;
      // Customer balances
      const deposits = txs.filter(t => t.type === 'project_deposit');
      const expenses = txs.filter(t => t.type === 'project_expense');
      const expByProject = {};
      expenses.forEach(t => { expByProject[t.project_id] = (expByProject[t.project_id] || 0) + (+t.amount || 0); });
      const projByClient = {};
      projects.forEach(p => { if (!projByClient[p.client_id]) projByClient[p.client_id] = []; projByClient[p.client_id].push(p); });
      const depByClient = {};
      deposits.forEach(t => { depByClient[t.client_id] = (depByClient[t.client_id] || 0) + (+t.amount || 0); });
      const balanceRows = clients.map(c => {
        const clientProjects = projByClient[c.id] || [];
        let totalExp = 0;
        let totalSup = 0;
        clientProjects.forEach(p => {
          const exp = expByProject[p.id] || 0;
          totalExp += exp;
          totalSup += exp * (p.supervision_percentage || 0) / 100;
        });
        const dep = depByClient[c.id] || 0;
        const balance = dep - totalExp - totalSup;
        const color = balance >= 0 ? 'var(--green)' : 'var(--red)';
        return [c.name, this.fmtMoney(dep), this.fmtMoney(totalExp), this.fmtMoney(totalSup), `<span style="color:${color};font-weight:700">${this.fmtMoney(balance)}</span>`];
      }).filter(r => r[1] !== '0 ج.م' || r[2] !== '0 ج.م');
      document.getElementById('customer-balances').innerHTML = balanceRows.length ? this.table(['العميل', 'الوارد', 'المصروفات', 'الإشراف', 'الرصيد'], balanceRows) : '<p style="color:var(--text3)">لا يوجد بيانات مالية</p>';
      const recent = await API.request('transactions', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc&limit=5');
      document.getElementById('recent-tx').innerHTML = recent.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف'], recent.map(t => [this.fmtDate(t.created_at), t.type, this.fmtMoney(t.amount), t.description || '-'])) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      const active = await API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&status=eq.active&limit=5');
      document.getElementById('active-proj').innerHTML = active.length ? this.table(['المشروع', 'العميل', 'الحالة'], active.map(p => [p.name, p.client_name || '-', '<span class="badge badge-green">نشط</span>'])) : '<p style="color:var(--text3)">لا توجد مشاريع نشطة</p>';
    } catch (e) { console.error(e); }
  },

  async loadClients() {
    try {
      const data = await API.request('clients', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc');
      document.getElementById('clients-tbl').innerHTML = data.length ? this.table(['الاسم', 'الهاتف', 'البريد', 'الإجراءات'], data.map(c => {
        const actions = UI.actions(c.id, 'Crud.editClient', 'Crud.delClient') + ` <button class="btn btn-sm btn-primary" onclick="Crud.clientStatement('${c.id}')">كشف حساب</button>`;
        return [c.name, c.phone || '-', c.email || '-', actions];
      })) : '<p style="color:var(--text3)">لا يوجد عملاء</p>';
    } catch (e) { console.error(e); }
  },

  async loadProjects() {
    try {
      const [data, expenses] = await Promise.all([
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc'),
        API.request('transactions', 'GET', null, "?select=project_id,amount&type=eq.project_expense&deleted_at=is.null")
      ]);
      const expByProject = {};
      expenses.forEach(t => { expByProject[t.project_id] = (expByProject[t.project_id] || 0) + (+t.amount || 0); });
      document.getElementById('projects-tbl').innerHTML = data.length ? this.table(['المشروع', 'العميل', 'العنوان', 'القيمة', 'مصروفات', 'نسبة الإشراف', 'إشراف', 'الحالة', 'الإجراءات'], data.map(p => {
        const exp = expByProject[p.id] || 0;
        const supAmt = exp * (p.supervision_percentage || 0) / 100;
        const actions = UI.actions(p.id, 'Crud.editProject', 'Crud.delProject') + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${p.id}')">كشف حساب</button>`;
        return [p.name, p.client_name || '-', p.address || '-', this.fmtMoney(p.value), this.fmtMoney(exp), (p.supervision_percentage || 0) + '%', this.fmtMoney(supAmt), `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${p.status}</span>`, actions];
      })) : '<p style="color:var(--text3)">لا توجد مشاريع</p>';
    } catch (e) { console.error(e); }
  },

  async loadVendors() {
    try {
      const data = await API.request('vendors', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc');
      document.getElementById('vendors-tbl').innerHTML = data.length ? this.table(['الاسم', 'الشخص المسؤول', 'الهاتف', 'البريد', 'الإجراءات'], data.map(v => {
        const actions = UI.actions(v.id, 'Crud.editVendor', 'Crud.delVendor') + ` <button class="btn btn-sm btn-primary" onclick="Crud.vendorStatement('${v.id}')">كشف حساب</button>`;
        return [v.name, v.contact_person || '-', v.phone || '-', v.email || '-', actions];
      })) : '<p style="color:var(--text3)">لا يوجد موردين</p>';
    } catch (e) { console.error(e); }
  },

  async loadTransactions() {
    try {
      const [data, projects, projectExpenses, allProjTxs] = await Promise.all([
        API.request('transactions', 'GET', null, "?select=*&type=in.(project_deposit,project_expense)&deleted_at=is.null&order=created_at.desc&limit=50"),
        API.request('projects', 'GET', null, '?select=id,name,created_at,supervision_percentage&deleted_at=is.null'),
        API.request('transactions', 'GET', null, "?select=project_id,amount&type=eq.project_expense&deleted_at=is.null"),
        API.request('transactions', 'GET', null, '?select=type,amount,date,created_at&deleted_at=is.null')
      ]);
      // KPIs
      const deposits = allProjTxs.filter(t => t.type === 'project_deposit').reduce((s, t) => s + (+t.amount || 0), 0);
      const expenses = allProjTxs.filter(t => t.type === 'project_expense').reduce((s, t) => s + (+t.amount || 0), 0);
      const expByProject = {};
      projectExpenses.forEach(t => { expByProject[t.project_id] = (expByProject[t.project_id] || 0) + (+t.amount || 0); });
      const supervision = projects.reduce((s, p) => s + ((expByProject[p.id] || 0) * (p.supervision_percentage || 0) / 100), 0);
      const balance = deposits - expenses - supervision;
      document.getElementById('tx-kpis').innerHTML = `
        <div class="kpi-card"><div class="kpi-label">إجمالي الوارد</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(deposits)}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expenses)}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي الإشراف</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(supervision)}</div></div>
        <div class="kpi-card"><div class="kpi-label">رصيد المشروعات</div><div class="kpi-value" style="color:var(--blue)">${this.fmtMoney(balance)}</div></div>`;
      // Monthly chart
      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('ar-EG', {month:'short'}) }); }
      const monthData = {};
      months.forEach(m => monthData[m.key] = { deposits: 0, expenses: 0 });
      allProjTxs.filter(t => ['project_deposit','project_expense'].includes(t.type)).forEach(t => {
        const d = new Date(t.date || t.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (monthData[key]) {
          if (t.type === 'project_deposit') monthData[key].deposits += (+t.amount || 0);
          if (t.type === 'project_expense') monthData[key].expenses += (+t.amount || 0);
        }
      });
      const maxVal = Math.max(...Object.values(monthData).map(m => Math.max(m.deposits, m.expenses)), 1);
      const chartHtml = `<div class="chart-container">${months.map(m => {
        const d = monthData[m.key];
        const depH = Math.round((d.deposits / maxVal) * 140);
        const expH = Math.round((d.expenses / maxVal) * 140);
        return `<div class="chart-bar"><div class="chart-bar-value" style="font-size:10px;color:var(--green)">${d.deposits > 0 ? (d.deposits/1000).toFixed(1)+'k' : ''}</div><div class="chart-bar-fill" style="height:${depH}px;background:linear-gradient(to top,rgba(125,187,138,0.3),rgba(125,187,138,0.7))"></div><div class="chart-bar-fill" style="height:${expH}px;background:linear-gradient(to top,rgba(200,126,122,0.3),rgba(200,126,122,0.7));margin-top:2px"></div><div class="chart-bar-value" style="font-size:10px;color:var(--red)">${d.expenses > 0 ? (d.expenses/1000).toFixed(1)+'k' : ''}</div><div class="chart-bar-label">${m.label}</div></div>`;
      }).join('')}</div><div class="chart-legend"><span><i style="background:var(--green)"></i> وارد</span><span><i style="background:var(--red)"></i> مصروف</span></div>`;
      document.getElementById('monthly-chart').innerHTML = chartHtml;
      // Table
      const expByProj = {};
      projectExpenses.forEach(t => { expByProj[t.project_id] = (expByProj[t.project_id] || 0) + (+t.amount || 0); });
      const supRows = projects.map(p => {
        const exp = expByProj[p.id] || 0;
        const supAmt = exp * (p.supervision_percentage || 0) / 100;
        if (supAmt <= 0) return null;
        return { created_at: p.created_at, type: 'supervision', amount: supAmt, employee_name: '-', sector_name: '-', party_name: '-', project_name: p.name, description: `إشراف ${p.name} (${p.supervision_percentage || 0}%)` };
      }).filter(Boolean);
      const allTxs = [...data, ...supRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      document.getElementById('tx-tbl').innerHTML = allTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف', 'الجهة', 'المشروع', 'طريقة الدفع', 'الإجراءات'], allTxs.map(t => {
        const badgeColor = t.type === 'project_deposit' ? 'green' : 'red';
        const party = t.employee_name || t.party_name || t.sector_name || '-';
        const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '-';
        const actions = t.type === 'supervision' && !t.id ? '-' : UI.actions(t.id, 'Crud.editTx', 'Crud.delTx');
        return [this.fmtDate(t.created_at), `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`, this.fmtMoney(t.amount), t.description || '-', party, t.project_name || '-', t.type === 'project_deposit' ? pm : '-', actions];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
    } catch (e) { console.error(e); }
  },


  async loadOffice() {
    try {
      const [incomeTxs, expenseTxs, projects, projectExpenses] = await Promise.all([
        API.request('transactions', 'GET', null, "?select=*&type=eq.owner_deposit&deleted_at=is.null&order=created_at.desc"),
        API.request('transactions', 'GET', null, "?select=*&type=in.(office_expense,withdrawal)&deleted_at=is.null&order=created_at.desc"),
        API.request('projects', 'GET', null, '?select=id,name,created_at,value,supervision_percentage&deleted_at=is.null'),
        API.request('transactions', 'GET', null, "?select=project_id,amount&type=eq.project_expense&deleted_at=is.null")
      ]);
      const txIncome = incomeTxs.reduce((s, t) => s + (+t.amount || 0), 0);
      const expByProject = {};
      projectExpenses.forEach(t => { expByProject[t.project_id] = (expByProject[t.project_id] || 0) + (+t.amount || 0); });
      const calcSupervision = projects.reduce((s, p) => s + ((expByProject[p.id] || 0) * (p.supervision_percentage || 0) / 100), 0);
      const totalIncome = txIncome + calcSupervision;
      const expense = expenseTxs.reduce((s, t) => s + (+t.amount || 0), 0);
      document.getElementById('office-kpis').innerHTML = `
        <div class="kpi-card" style="border-top:4px solid var(--green)"><div class="kpi-label">إيرادات المكتب</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(totalIncome)}</div><div style="font-size:12px;color:var(--text3);margin-top:6px">إشراف: ${this.fmtMoney(calcSupervision)} &nbsp;|&nbsp; توريدات: ${this.fmtMoney(txIncome)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--red)"><div class="kpi-label">مصروفات المكتب</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expense)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--gold)"><div class="kpi-label">رصيد المكتب</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(totalIncome - expense)}</div></div>`;
      const supRows = projects.map(p => {
        const exp = expByProject[p.id] || 0;
        const supAmt = exp * (p.supervision_percentage || 0) / 100;
        if (supAmt <= 0) return null;
        return { created_at: p.created_at, type: 'supervision', amount: supAmt, employee_name: '-', sector_name: '-', description: `إشراف ${p.name}` };
      }).filter(Boolean);
      const allTxs = [...incomeTxs, ...expenseTxs, ...supRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      document.getElementById('office-tbl').innerHTML = allTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الموظف', 'التصنيف', 'الوصف', 'الإجراءات'], allTxs.map(t => {
        const badgeColor = ['owner_deposit','supervision'].includes(t.type) ? 'green' : 'red';
        const actions = t.id ? UI.actions(t.id, 'Crud.editTx', 'Crud.delTx') : '-';
        return [this.fmtDate(t.created_at), `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`, this.fmtMoney(t.amount), t.employee_name || '-', t.sector_name || '-', t.description || '-', actions];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
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
      const [authData, profiles] = await Promise.all([
        API.authListUsers(),
        API.request('profiles', 'GET', null, '?select=*&order=created_at.desc')
      ]);
      const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
      const users = (authData.users || []).map(u => {
        const p = profileMap[u.id];
        return {
          id: u.id,
          email: u.email,
          name: p?.name || u.user_metadata?.name || '-',
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
    } catch (e) { console.error(e); document.getElementById('users-tbl').innerHTML = '<p style="color:var(--red)">خطأ في تحميل المستخدمين</p>'; }
  },

  table(headers, rows) {
    return `<div class="table-responsive"><table class="data-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },

  fmtMoney(n) { return (+n || 0).toLocaleString('ar-EG') + ' ج.م'; },
  fmtDate(d) { return d ? new Date(d).toLocaleDateString('ar-EG') : '-'; },
  fmtTxType(type) { const map = { project_deposit: 'عربون مشروع', project_expense: 'مصروف مشروع', office_expense: 'مصروف مكتبي', owner_deposit: 'توريد صاحب المكتب', owner_withdrawal: 'سحب صاحب المكتب', supervision: 'إشراف مشروع', income: 'إيراد', expense: 'مصروف', deposit: 'عربون', withdrawal: 'سحب' }; return map[type] || type; }
};

// ─── CRUD ───
const Crud = {
  async save(table, data, id) {
    if (id) { await API.request(table, 'PATCH', data, '?id=eq.' + id); return { id, ...data }; }
    else { return API.request(table, 'POST', data); }
  },

  async bulkSave(table, rows) {
    if (!rows || rows.length === 0) throw new Error('لا يوجد بيانات');
    const clean = rows.map(r => {
      const c = {};
      for (const [k, v] of Object.entries(r)) {
        if (v !== null && v !== '') c[k] = v;
      }
      return c;
    }).filter(r => Object.keys(r).length > 0);
    if (clean.length === 0) throw new Error('لا يوجد بيانات صالحة');
    return API.request(table, 'POST', clean);
  },

  async softDelete(table, id) {
    await API.request(table, 'PATCH', { deleted_at: new Date().toISOString() }, '?id=eq.' + id);
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
    });
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
  async addProject() {
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
    Spreadsheet.open('إضافة مشاريع', cols, async (rows) => {
      const enriched = rows.map(r => {
        const client = clients.find(c => c.id === r.client_id);
        return { ...r, client_id: r.client_id || null, client_name: client ? client.name : null };
      });
      await this.bulkSave('projects', enriched);
      UI.toast(`تم حفظ ${rows.length} مشروع`);
      App.loadProjects();
    });
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
      UI.toast('تم التحديث'); App.loadProjects();
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
    const supervisionAmount = totalExpenses * (project.supervision_percentage || 0) / 100;
    const ledger = [];
    deposits.forEach(t => {
      const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '';
      ledger.push({ date: t.date || t.created_at, type: 'وارد', in: +t.amount || 0, out: 0, desc: (t.description || 'عربون من العميل') + (pm ? ` (${pm})` : '') });
    });
    expenses.forEach(t => ledger.push({ date: t.date || t.created_at, type: 'منصرف', in: 0, out: +t.amount || 0, desc: t.description || '-' }));
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
    const html = `<div style="margin-bottom:16px"><strong>المشروع:</strong> ${project.name}<br><strong>العميل:</strong> ${project.client_name || '-'}<br><strong>نسبة الإشراف:</strong> ${project.supervision_percentage || 0}%<br><strong>إجمالي الوارد:</strong> ${App.fmtMoney(totalIn)}<br><strong>إجمالي المنصرف:</strong> ${App.fmtMoney(totalExpenses)}<br><strong>إشراف:</strong> ${App.fmtMoney(supervisionAmount)}<br><strong style="color:var(--gold)">رصيد العميل:</strong> ${App.fmtMoney(balance)}</div><div style="margin-bottom:16px"><button class="btn btn-secondary" onclick="window.print()">🖨️ طباعة / PDF</button></div>${App.table(['التاريخ', 'النوع', 'وارد', 'منصرف', 'رصيد العميل', 'البيان'], rows)}`;
    UI.openModal('كشف حساب المشروع', html, null);
  },

  async clientStatement(id) {
    const [clientRows, projects, deposits, expenses] = await Promise.all([
      API.request('clients', 'GET', null, `?select=*&id=eq.${id}`),
      API.request('projects', 'GET', null, `?select=id,name,supervision_percentage&client_id=eq.${id}&deleted_at=is.null`),
      API.request('transactions', 'GET', null, `?select=project_id,amount,date,description&type=eq.project_deposit&deleted_at=is.null&order=date.asc`),
      API.request('transactions', 'GET', null, `?select=project_id,amount,date,description&type=eq.project_expense&deleted_at=is.null&order=date.asc`)
    ]);
    if (!clientRows.length) return;
    const client = clientRows[0];
    const projIds = projects.map(p => p.id);
    const clientDeposits = deposits.filter(t => projIds.includes(t.project_id));
    const clientExpenses = expenses.filter(t => projIds.includes(t.project_id));
    const expByProject = {};
    clientExpenses.forEach(t => { expByProject[t.project_id] = (expByProject[t.project_id] || 0) + (+t.amount || 0); });
    let totalSup = 0;
    projects.forEach(p => { totalSup += (expByProject[p.id] || 0) * (p.supervision_percentage || 0) / 100; });
    const totalDep = clientDeposits.reduce((s, t) => s + (+t.amount || 0), 0);
    const totalExp = clientExpenses.reduce((s, t) => s + (+t.amount || 0), 0);
    const balance = totalDep - totalExp - totalSup;
    const ledger = [];
    clientDeposits.forEach(t => {
      const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '';
      ledger.push({ date: t.date || t.created_at, type: 'وارد', in: +t.amount || 0, out: 0, desc: (t.description || '-') + (pm ? ` (${pm})` : '') });
    });
    clientExpenses.forEach(t => ledger.push({ date: t.date || t.created_at, type: 'منصرف', in: 0, out: +t.amount || 0, desc: t.description || '-' }));
    ledger.push({ date: new Date().toISOString(), type: 'إشراف', in: 0, out: totalSup, desc: `إجمالي إشراف المشاريع` });
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = 0;
    const rows = ledger.map(r => {
      running += r.in - r.out;
      return [App.fmtDate(r.date), r.type, App.fmtMoney(r.in), App.fmtMoney(r.out), App.fmtMoney(running), r.desc];
    });
    rows.push(['', '<strong>الإجمالي</strong>', `<strong>${App.fmtMoney(totalDep)}</strong>`, `<strong>${App.fmtMoney(totalExp + totalSup)}</strong>`, `<strong>${App.fmtMoney(balance)}</strong>`, '']);
    const html = `<div style="margin-bottom:16px"><strong>العميل:</strong> ${client.name}<br><strong>إجمالي الوارد:</strong> ${App.fmtMoney(totalDep)}<br><strong>إجمالي المصروفات:</strong> ${App.fmtMoney(totalExp)}<br><strong>إجمالي الإشراف:</strong> ${App.fmtMoney(totalSup)}<br><strong style="color:var(--gold)">رصيد العميل:</strong> ${App.fmtMoney(balance)}</div><div style="margin-bottom:16px"><button class="btn btn-secondary" onclick="window.print()">🖨️ طباعة / PDF</button></div>${App.table(['التاريخ', 'النوع', 'وارد', 'منصرف', 'رصيد العميل', 'البيان'], rows)}`;
    UI.openModal('كشف حساب العميل', html, null);
  },

  delProject(id) {
    UI.confirm('هل أنت متأكد من حذف هذا المشروع؟', async () => { await this.softDelete('projects', id); UI.toast('تم الحذف'); App.loadProjects(); });
  },

  // ─── VENDORS ───
  addVendor() {
    const cols = [
      { key: 'name', label: 'اسم المورد *', req: true },
      { key: 'contact_person', label: 'الشخص المسؤول' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد' },
      { key: 'address', label: 'العنوان' },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة موردين', cols, async (rows) => {
      await this.bulkSave('vendors', rows);
      UI.toast(`تم حفظ ${rows.length} مورد`);
      App.loadVendors();
    });
  },

  async editVendor(id) {
    const rows = await API.request('vendors', 'GET', null, '?select=*&id=eq.' + id);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم المورد', req: true },
      { name: 'contact_person', label: 'الشخص المسؤول' },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد' },
      { name: 'address', label: 'العنوان' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل مورد', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('vendors', { name: fd.get('name'), contact_person: fd.get('contact_person') || null, phone: fd.get('phone') || null, email: fd.get('email') || null, address: fd.get('address') || null, notes: fd.get('notes') || null }, id);
      UI.toast('تم التحديث'); App.loadVendors();
    });
  },

  delVendor(id) {
    UI.confirm('هل أنت متأكد من حذف هذا المورد؟', async () => { await this.softDelete('vendors', id); UI.toast('تم الحذف'); App.loadVendors(); });
  },

  async vendorStatement(id) {
    const [vendorRows, procs] = await Promise.all([
      API.request('vendors', 'GET', null, `?select=*&id=eq.${id}`),
      API.request('procurements', 'GET', null, `?select=*&vendor_id=eq.${id}&deleted_at=is.null&order=date.asc`)
    ]);
    if (!vendorRows.length) return;
    const vendor = vendorRows[0];
    let running = 0;
    const rows = procs.map(p => {
      running += (+p.total_price || 0);
      return [App.fmtDate(p.date), p.project_name || '-', p.item_name || '-', p.quantity || '-', App.fmtMoney(p.unit_price), App.fmtMoney(p.total_price), p.expense_type || '-', App.fmtMoney(running)];
    });
    const total = procs.reduce((s, p) => s + (+p.total_price || 0), 0);
    if (rows.length) rows.push(['', '', '', '', '<strong>الإجمالي</strong>', `<strong>${App.fmtMoney(total)}</strong>`, '', `<strong>${App.fmtMoney(running)}</strong>`]);
    const html = `<div style="margin-bottom:16px"><strong>المورد:</strong> ${vendor.name}<br><strong>الشخص المسؤول:</strong> ${vendor.contact_person || '-'}<br><strong>الهاتف:</strong> ${vendor.phone || '-'}<br><strong>إجمالي المشتريات:</strong> ${App.fmtMoney(total)}</div><div style="margin-bottom:16px"><button class="btn btn-secondary" onclick="window.print()">🖨️ طباعة / PDF</button></div>${rows.length ? App.table(['التاريخ', 'المشروع', 'البند', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'التصنيف', 'الرصيد'], rows) : '<p style="color:var(--text3)">لا توجد مشتريات</p>'}`;
    UI.openModal('كشف حساب المورد', html, null);
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
    });
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

  // ─── TRANSACTIONS: 4 Types ───
  async addProjectDeposit() {
    const [clients, projects] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
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
    });
  },

  async addProjectExpense() {
    const projects = await API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc');
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name }));
    const cols = [
      { key: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('🔨 مصروف مشروع', cols, async (rows) => {
      const enriched = rows.map(r => {
        const project = projects.find(p => p.id === r.project_id);
        return { type: 'project_expense', amount: r.amount, client_id: project ? project.client_id : null, party_id: project ? project.client_id : null, party_name: project ? project.client_name : null, party_type: 'client', project_id: r.project_id, project_name: project ? project.name : null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} مصروف`);
      App.loadTransactions(); App.loadOffice();
    });
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
        API.request('projects', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
      ]);
      const fields = [
        { name: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clients.map(c => ({ v: c.id, l: c.name }))] },
        { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name }))] },
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'payment_method', label: 'طريقة الدفع', type: 'select', opts: [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }, { v: 'transfer', l: 'تحويل' }] },
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      UI.openModal('تعديل عربون مشروع', `<form>${UI.form(fields, { ...tx, client_id: tx.client_id || '' })}</form>`, async (form) => {
        const fd = new FormData(form);
        const client = clients.find(c => c.id === fd.get('client_id'));
        const project = projects.find(p => p.id === fd.get('project_id'));
        await this.save('transactions', { type: 'project_deposit', amount: +fd.get('amount') || 0, client_id: fd.get('client_id'), party_id: fd.get('client_id'), party_name: client ? client.name : null, party_type: 'client', project_id: fd.get('project_id'), project_name: project ? project.name : null, payment_method: fd.get('payment_method') || null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
    } else if (tx.type === 'project_expense') {
      const projects = await API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc');
      const fields = [
        { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name }))] },
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      UI.openModal('تعديل مصروف مشروع', `<form>${UI.form(fields, { ...tx, project_id: tx.project_id || '' })}</form>`, async (form) => {
        const fd = new FormData(form);
        const project = projects.find(p => p.id === fd.get('project_id'));
        await this.save('transactions', { type: 'project_expense', amount: +fd.get('amount') || 0, client_id: project ? project.client_id : null, party_id: project ? project.client_id : null, party_name: project ? project.client_name : null, party_type: 'client', project_id: fd.get('project_id'), project_name: project ? project.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
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
    });
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
  }
};
