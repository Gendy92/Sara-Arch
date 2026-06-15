// App Screen Loaders
Object.assign(App, {
  // ─── PAGINATION HELPERS ───
  _paginationHtml(table, page, perPage, total) {
    const safeTotal = Number.isFinite(total) ? total : 0;
    const totalPages = Math.max(1, Math.ceil(safeTotal / perPage));
    const prev = `App.pageState['${table}']=${Math.max(1, page - 1)};App.load${table.charAt(0).toUpperCase() + table.slice(1)}()`;
    const next = `App.pageState['${table}']=${Math.min(totalPages, page + 1)};App.load${table.charAt(0).toUpperCase() + table.slice(1)}()`;
    return `<div class="pagination-bar" style="display:flex;justify-content:center;gap:10px;margin-top:16px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" ${page <= 1 ? 'disabled' : ''} onclick="${prev}">← السابق</button>
      <span style="font-size:13px;color:var(--text2)">صفحة ${page} من ${totalPages} (${safeTotal} سجل)</span>
      <button class="btn btn-sm btn-secondary" ${page >= totalPages ? 'disabled' : ''} onclick="${next}">التالي →</button>
    </div>`;
  },

  _vendorBalanceMap(vendors, vendorExpenses, vendorProcs) {
    const serviceCostByVendor = {};
    const servicePaidByVendor = {};
    vendorExpenses.forEach(t => {
      if (!t.vendor_id) return;
      const amt = +t.amount || 0;
      const isNew = t.payment_term !== undefined && t.payment_term !== null;
      const paid = isNew ? (+t.paid_amount || 0) : amt;
      serviceCostByVendor[t.vendor_id] = (serviceCostByVendor[t.vendor_id] || 0) + amt;
      servicePaidByVendor[t.vendor_id] = (servicePaidByVendor[t.vendor_id] || 0) + paid;
    });
    const merchByVendor = {};
    const merchPaidByVendor = {};
    vendorProcs.forEach(p => {
      if (!p.vendor_id) return;
      const amt = +p.total_price || 0;
      const isNew = p.payment_term !== undefined && p.payment_term !== null;
      const paid = isNew ? (+p.paid_amount || 0) : amt;
      merchByVendor[p.vendor_id] = (merchByVendor[p.vendor_id] || 0) + amt;
      merchPaidByVendor[p.vendor_id] = (merchPaidByVendor[p.vendor_id] || 0) + paid;
    });
    const map = {};
    vendors.forEach(v => {
      const serviceCost = serviceCostByVendor[v.id] || 0;
      const servicePaid = servicePaidByVendor[v.id] || 0;
      const merchandise = merchByVendor[v.id] || 0;
      const merchPaid = merchPaidByVendor[v.id] || 0;
      map[v.id] = (serviceCost + merchandise) - (servicePaid + merchPaid);
    });
    return map;
  },

  _perfLog(label, start) {
    if (typeof PERF_LOG !== 'undefined' && PERF_LOG) {
      console.log(`[Perf] ${label}: ${(performance.now() - start).toFixed(1)}ms`);
    }
  },

  _renderPie(rows, size = 160, emptyMsg = 'لا توجد بيانات') {
    if (!rows || !rows.length) return `<p style="color:var(--text3)">${emptyMsg}</p>`;
    const total = rows.reduce((s, r) => s + (+r[1] || 0), 0);
    if (total <= 0) return `<p style="color:var(--text3)">${emptyMsg}</p>`;
    const cx = size / 2, cy = size / 2, r = size / 2 - 4;
    let startAngle = 0;
    const pieColors = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00acc1', '#fdd835', '#6d4c41', '#26a69a', '#ef5350'];
    const paths = rows.map(([label, amt], i) => {
      const angle = (amt / total) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(startAngle + angle);
      const y2 = cy + r * Math.sin(startAngle + angle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const color = pieColors[i % pieColors.length];
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      startAngle += angle;
      return `<path d="${d}" fill="${color}" stroke="var(--card)" stroke-width="2"/>`;
    }).join('');
    const legend = rows.map(([label, amt], i) => {
      const pct = Math.round((amt / total) * 100);
      return `<div class="pie-legend-item"><span class="pie-legend-color" style="background:${pieColors[i % pieColors.length]}"></span><span>${App.esc(label)}</span><span>${pct}% · ${this.fmtMoney(amt)}</span></div>`;
    }).join('');
    return `<div class="pie-chart-wrap"><div class="pie-chart"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg></div><div class="pie-legend">${legend}<div class="pie-legend-item" style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px;font-weight:600;color:var(--text)"><span style="width:12px"></span><span>الإجمالي</span><span>${this.fmtMoney(total)}</span></div></div></div>`;
  },

  // ─── DATA LOADING ───
  async loadDashboard() {
    const t0 = performance.now();
    try {
      // Server-side aggregation: small, fast RPCs instead of hauling entire tables.
      const [[kpi], monthly, sectors, incomeExpense, vendorBalances, clientBalances] = await Promise.all([
        API.rpc('dashboard_kpis'),
        API.rpc('dashboard_monthly_revenue_expenses', { months_back: 6 }),
        API.rpc('dashboard_office_expense_sectors'),
        API.rpc('dashboard_office_income_expense_sectors'),
        API.rpc('dashboard_top_vendors', { limit_count: 10 }),
        API.rpc('dashboard_active_client_balances', { limit_count: 10 })
      ]);
      const k = kpi || {};
      document.getElementById('kpis').innerHTML = `
        <div class="kpi-card"><div class="kpi-icon">👥</div><div class="kpi-label">العملاء</div><div class="kpi-value">${k.client_count || 0}</div></div>
        <div class="kpi-card"><div class="kpi-icon">📁</div><div class="kpi-label">المشاريع</div><div class="kpi-value">${k.project_count || 0}</div></div>
        <div class="kpi-card"><div class="kpi-icon">✅</div><div class="kpi-label">النشطة</div><div class="kpi-value" style="color:var(--green)">${k.active_project_count || 0}</div></div>
        <div class="kpi-card"><div class="kpi-icon">🧑‍💼</div><div class="kpi-label">الموظفين</div><div class="kpi-value">${k.employee_count || 0}</div></div>
        <div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-label">إجمالي الحركة</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(k.total_movement || 0)}</div></div>`;
      // ─── Monthly Office Revenue vs Expenses Chart (last 6 months) ───
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        months.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleString('ar-EG', { month: 'short' }) });
      }
      const monthlyRev = {}; const monthlyExp = {};
      months.forEach(m => { monthlyRev[m.key] = 0; monthlyExp[m.key] = 0; });
      (monthly || []).forEach(r => {
        if (!r.month_key) return;
        monthlyRev[r.month_key] = +r.revenue || 0;
        monthlyExp[r.month_key] = +r.expense || 0;
      });
      const maxVal = Math.max(...months.map(m => Math.max(monthlyRev[m.key], monthlyExp[m.key])), 1);
      const barChartHtml = `<div class="bar-chart">${months.map(m => {
        const rh = Math.round((monthlyRev[m.key] / maxVal) * 120);
        const eh = Math.round((monthlyExp[m.key] / maxVal) * 120);
        return `<div class="bar-chart-group"><div class="bar-chart-bars"><div class="bar-chart-bar revenue" style="height:${rh}px" title="إيرادات: ${this.fmtMoney(monthlyRev[m.key])}"></div><div class="bar-chart-bar expense" style="height:${eh}px" title="مصروفات: ${this.fmtMoney(monthlyExp[m.key])}"></div></div><div class="bar-chart-label">${m.label}</div></div>`;
      }).join('')}</div><div class="bar-chart-legend"><span><span class="dot" style="background:var(--green)"></span> إيرادات المكتب</span><span><span class="dot" style="background:var(--red)"></span> مصروفات المكتب</span></div>`;
      document.getElementById('monthly-chart').innerHTML = barChartHtml;
      // ─── Office Expense Breakdown by Sector (Pie Chart) ───
      const sectorRows = (sectors || []).map(s => [s.sector || 'غير مصنف', +s.amount || 0]).sort((a, b) => b[1] - a[1]);
      document.getElementById('expense-chart').innerHTML = this._renderPie(sectorRows, 160, 'لا توجد مصروفات مكتبية');
      // ─── Office Income vs Expenses (Pie Chart) ───
      const ieRows = (incomeExpense || [])
        .filter(r => (+r.amount || 0) > 0)
        .map(r => [r.label || 'غير مصنف', +r.amount])
        .sort((a, b) => b[1] - a[1]);
      document.getElementById('income-expense-chart').innerHTML = this._renderPie(ieRows, 160, 'لا توجد إيرادات أو مصروفات مكتبية');
      // ─── Top 10 Vendor Outstanding Balances ───
      const vendorRows = (vendorBalances || [])
        .filter(v => (v.balance || 0) > 0)
        .sort((a, b) => (b.balance || 0) - (a.balance || 0))
        .slice(0, 10)
        .map(v => [App.esc(v.vendor_name || '-'), `<span style="color:var(--red);font-weight:700">${this.fmtMoney(v.balance || 0)}</span>`]);
      document.getElementById('dash-vendors').innerHTML = vendorRows.length
        ? this.table(['المورد', 'المبلغ المستحق'], vendorRows)
        : '<p style="color:var(--text3)">لا توجد مستحقات للموردين</p>';
      // ─── Top 10 Active Customer Balances ───
      const clientRows = (clientBalances || [])
        .map(c => [App.esc(c.client_name || '-'), this.fmtMoney(c.deposits || 0), this.fmtMoney(c.expenses || 0), `<span style="color:${(c.balance || 0) >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${this.fmtMoney(c.balance || 0)}</span>`]);
      document.getElementById('dash-clients').innerHTML = clientRows.length
        ? this.table(['العميل', 'الإيداعات', 'المصروفات', 'الرصيد'], clientRows)
        : '<p style="color:var(--text3)">لا يوجد عملاء نشطون</p>';
      this._perfLog('loadDashboard', t0);
    } catch (e) {
      console.error(e);
      UI.toast('Dashboard load failed: ' + e.message, 'error');
      const err = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل البيانات</p><button class="btn btn-secondary" onclick="App.loadDashboard()">🔄 إعادة المحاولة</button>`;
      document.getElementById('kpis').innerHTML = err;
    }
  },

  async loadClients() {
    try {
      const page = this.pageState.clients || 1;
      const limit = this.PAGE_SIZE;
      const offset = (page - 1) * limit;
      const [clients, projects, expenses, deposits, totalClients] = await Promise.all([
        API.request('clients', 'GET', null, `?select=*&deleted_at=is.null&order=created_at.desc&limit=${limit}&offset=${offset}`),
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&order=created_at.desc'),
        API.request('transactions', 'GET', null, "?select=*&type=eq.project_expense&deleted_at=is.null"),
        API.request('transactions', 'GET', null, "?select=project_id,amount&type=eq.project_deposit&deleted_at=is.null"),
        API.count('clients', '?deleted_at=is.null')
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
        document.getElementById('clients-list').innerHTML = `<p style="color:var(--text3);padding:16px">لا يوجد عملاء</p>${Auth.can('clients','add')?'<button class="btn btn-primary" onclick="Crud.addClient()">+ إضافة أول عميل</button>':''}`;
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
          const balance = dep - exp;
          const supAmt = constr * (p.supervision_percentage || 0) / 100;
          const balColor = balance >= 0 ? 'var(--green)' : 'var(--red)';
          const balBadge = `<span style="color:${balColor};font-weight:700;font-size:12px">${this.fmtMoney(balance)}</span>`;
          const pActions = UI.actions(p.id, 'Crud.editProject', 'Crud.delProject', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${p.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.projectBudget('${p.id}')">📊 ميزانية</button> <button class="btn btn-sm btn-secondary" onclick="Crud.loadProjectTasks('${p.id}')">📋 مهام</button>`;
          return [`<a href="#" onclick="App.go('project',{projectId:'${p.id}'});return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(p.name)}</a>`, App.esc(p.address || '-'), this.fmtMoney(p.value), this.fmtMoney(exp), balBadge, (p.supervision_percentage || 0) + '%', this.fmtMoney(supAmt), `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${p.status}</span>`, pActions];
        });
        const projTable = cProjects.length ? this.table(['المشروع', 'العنوان', 'القيمة', 'مصروفات', 'الرصيد', 'إشراف %', 'إشراف', 'الحالة', 'الإجراءات'], projRows) : '<p style="color:var(--text3);padding:8px 0">لا توجد مشاريع لهذا العميل</p>';
        return `<div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div>
              <h3 style="margin-bottom:4px"><a href="#" onclick="App.go('client',{clientId:'${c.id}'});return false;" style="color:var(--gold);text-decoration:none">${App.esc(c.name)}</a></h3>
              <div style="font-size:12px;color:var(--text2)">${App.esc(c.phone || '-')} · ${App.esc(c.email || '-')} · ${App.esc(c.address || '-')}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${clientActions}</div>
          </div>
          <div style="margin-bottom:12px"><button class="btn btn-sm btn-secondary" onclick="Crud.addProject('${c.id}')">+ إضافة مشروع</button></div>
          ${projTable}
        </div>`;
      }).join('');
      document.getElementById('clients-list').innerHTML = html + this._paginationHtml('clients', page, limit, totalClients);
      this.attachSearch('clients-list', '🔍 بحث في العملاء أو المشاريع...');
    } catch (e) {
      console.error(e);
      UI.toast('Clients load failed: ' + e.message, 'error');
      document.getElementById('clients-list').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل العملاء</p><button class="btn btn-secondary" onclick="App.loadClients()">🔄 إعادة المحاولة</button>`;
    }
  },

  async loadClient(clientId) {
    try {
      const [clientRows, projects, expenses, deposits] = await Promise.all([
        API.request('clients', 'GET', null, `?select=*&id=eq.${clientId}&deleted_at=is.null`),
        API.request('projects', 'GET', null, `?select=*&client_id=eq.${clientId}&deleted_at=is.null&order=created_at.desc`),
        API.request('transactions', 'GET', null, `?select=*&type=eq.project_expense&deleted_at=is.null`),
        API.request('transactions', 'GET', null, `?select=project_id,amount&type=eq.project_deposit&deleted_at=is.null`)
      ]);
      const client = clientRows[0];
      if (!client) { document.getElementById('client-detail').innerHTML = '<p style="color:var(--red);padding:16px">⚠️ العميل غير موجود</p>'; return; }

      const expByProject = {};
      const designByProject = {};
      expenses.forEach(t => {
        const amt = +t.amount || 0;
        expByProject[t.project_id] = (expByProject[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') designByProject[t.project_id] = (designByProject[t.project_id] || 0) + amt;
      });
      const depByProject = {};
      deposits.forEach(t => { depByProject[t.project_id] = (depByProject[t.project_id] || 0) + (+t.amount || 0); });

      const totalProjects = projects.length;
      const totalValue = projects.reduce((s, p) => s + (+p.value || 0), 0);
      const totalExp = projects.reduce((s, p) => s + (expByProject[p.id] || 0), 0);
      const totalDep = projects.reduce((s, p) => s + (depByProject[p.id] || 0), 0);

      const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المشاريع</div><div class="kpi-value">${totalProjects}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي القيم</div><div class="kpi-value">${this.fmtMoney(totalValue)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإيداعات</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(totalDep)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(totalExp)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الرصيد</div><div class="kpi-value">${this.fmtMoney(totalDep - totalExp)}</div></div>
      </div>`;

      const clientActions = UI.actions(client.id, 'Crud.editClient', 'Crud.delClient', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.clientStatement('${client.id}')">كشف حساب</button>`;
      const projRows = projects.map(p => {
        const exp = expByProject[p.id] || 0;
        const design = designByProject[p.id] || 0;
        const constr = exp - design;
        const dep = depByProject[p.id] || 0;
        const balance = dep - exp;
        const supAmt = constr * (p.supervision_percentage || 0) / 100;
        const balColor = balance >= 0 ? 'var(--green)' : 'var(--red)';
        const balBadge = `<span style="color:${balColor};font-weight:700;font-size:12px">${this.fmtMoney(balance)}</span>`;
        const pActions = UI.actions(p.id, 'Crud.editProject', 'Crud.delProject', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${p.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.projectBudget('${p.id}')">📊 ميزانية</button> <button class="btn btn-sm btn-secondary" onclick="Crud.loadProjectTasks('${p.id}')">📋 مهام</button>`;
        return [`<a href="#" onclick="App.go('project',{projectId:'${p.id}'});return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(p.name)}</a>`, App.esc(p.address || '-'), this.fmtMoney(p.value), this.fmtMoney(exp), balBadge, (p.supervision_percentage || 0) + '%', this.fmtMoney(supAmt), `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${p.status}</span>`, pActions];
      });
      const projTable = projects.length ? this.table(['المشروع', 'العنوان', 'القيمة', 'مصروفات', 'الرصيد', 'إشراف %', 'إشراف', 'الحالة', 'الإجراءات'], projRows) : '<p style="color:var(--text3);padding:8px 0">لا توجد مشاريع لهذا العميل</p>';

      const html = `<div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <h3 style="margin-bottom:4px">${App.esc(client.name)}</h3>
            <div style="font-size:12px;color:var(--text2)">${App.esc(client.phone || '-')} · ${App.esc(client.email || '-')} · ${App.esc(client.address || '-')}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${clientActions}</div>
        </div>
        <div style="margin-bottom:12px"><button class="btn btn-sm btn-secondary" onclick="Crud.addProject('${client.id}')">+ إضافة مشروع</button></div>
        ${projTable}
      </div>`;

      document.getElementById('client-detail-name').textContent = '👤 ' + client.name;
      document.getElementById('client-detail').innerHTML = summary + html;
      this.attachSearch('client-detail', '🔍 بحث في المشاريع...');
    } catch (e) {
      console.error(e);
      UI.toast('فشل تحميل تفاصيل العميل: ' + e.message, 'error');
      document.getElementById('client-detail').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل البيانات</p><button class="btn btn-secondary" onclick="App.loadClient('${clientId}')">🔄 إعادة المحاولة</button>`;
    }
  },

  async loadProject(projectId) {
    try {
      const [projectRows, txs, tasks] = await Promise.all([
        API.request('projects', 'GET', null, `?select=*,clients(name)&id=eq.${projectId}&deleted_at=is.null`),
        API.request('transactions', 'GET', null, `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=date.desc&limit=100`),
        API.request('project_tasks', 'GET', null, `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=due_date.asc&limit=50`)
      ]);
      const project = projectRows[0];
      if (!project) { document.getElementById('project-detail').innerHTML = '<p style="color:var(--red);padding:16px">⚠️ المشروع غير موجود</p>'; return; }

      const deposits = txs.filter(t => t.type === 'project_deposit').reduce((s, t) => s + (+t.amount || 0), 0);
      const expenses = txs.filter(t => t.type === 'project_expense').reduce((s, t) => s + (+t.amount || 0), 0);
      const constr = txs.filter(t => t.type === 'project_expense' && t.expense_category !== 'design').reduce((s, t) => s + (+t.amount || 0), 0);
      const design = txs.filter(t => t.type === 'project_expense' && t.expense_category === 'design').reduce((s, t) => s + (+t.amount || 0), 0);
      const supervision = Math.max(0, constr) * (project.supervision_percentage || 0) / 100;
      const balance = deposits - expenses - supervision;

      const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">القيمة</div><div class="kpi-value">${this.fmtMoney(project.value)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإيداعات</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(deposits)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expenses)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإشراف (${project.supervision_percentage || 0}%)</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(supervision)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الرصيد</div><div class="kpi-value">${this.fmtMoney(balance)}</div></div>
      </div>`;

      const actions = UI.actions(project.id, 'Crud.editProject', 'Crud.delProject', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${project.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.projectBudget('${project.id}')">📊 ميزانية</button> <button class="btn btn-sm btn-secondary" onclick="Crud.loadProjectTasks('${project.id}')">📋 مهام</button>`;
      const info = `<div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <h3 style="margin-bottom:4px">${project.name}</h3>
            <div style="font-size:12px;color:var(--text2)">العميل: <a href="#" onclick="App.go('client',{clientId:'${project.client_id}'});return false;" style="color:var(--gold);text-decoration:none">${project.clients?.name || project.client_name || '-'}</a> · ${project.address || '-'} · الإشراف: ${project.supervision_percentage || 0}%</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div>
        </div>
      </div>`;

      const txRows = txs.map((t, i) => [i+1, t.date || '-', App.fmtTxType(t.type), t.description || '-', this.fmtMoney(t.amount)]);
      const txTable = txRows.length ? '<h4 style="margin:12px 0 8px;color:var(--text2)">💰 المعاملات</h4>' + this.table(['#', 'التاريخ', 'النوع', 'البيان', 'المبلغ'], txRows) : '';

      const statusBadge = (s) => {
        const colors = { pending: 'gray', in_progress: 'blue', done: 'green' };
        const labels = { pending: 'معلق', in_progress: 'قيد التنفيذ', done: 'منتهي' };
        return `<span class="badge badge-${colors[s] || 'gray'}">${labels[s] || s}</span>`;
      };
      const priorityBadge = (p) => {
        const colors = { low: 'gray', medium: 'orange', high: 'red' };
        const labels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        return `<span class="badge badge-${colors[p] || 'gray'}">${labels[p] || p}</span>`;
      };
      const taskRows = tasks.map((t, i) => [i+1, t.name, t.assignee || '-', t.start_date || '-', t.due_date || '-', statusBadge(t.status), priorityBadge(t.priority)]);
      const taskTable = taskRows.length ? '<h4 style="margin:12px 0 8px;color:var(--text2)">📋 المهام</h4>' + this.table(['#', 'المهمة', 'المسؤول', 'تاريخ البدء', 'تاريخ الاستحقاق', 'الحالة', 'الأولوية'], taskRows) : '';

      document.getElementById('project-detail-name').textContent = '🏗️ ' + project.name;
      document.getElementById('project-detail').innerHTML = summary + info + txTable + taskTable;
    } catch (e) {
      console.error(e);
      UI.toast('فشل تحميل تفاصيل المشروع: ' + e.message, 'error');
      document.getElementById('project-detail').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل البيانات</p><button class="btn btn-secondary" onclick="App.loadProject('${projectId}')">🔄 إعادة المحاولة</button>`;
    }
  },

  async loadVendors() {
    try {
      const page = this.pageState.vendors || 1;
      const limit = this.PAGE_SIZE;
      const offset = (page - 1) * limit;
      const [data, total, vendorExpenses, vendorProcs] = await Promise.all([
        API.request('vendors', 'GET', null, `?select=*&deleted_at=is.null&order=created_at.desc&limit=${limit}&offset=${offset}`),
        API.count('vendors', '?deleted_at=is.null'),
        API.request('transactions', 'GET', null, '?select=vendor_id,amount,paid_amount,payment_term&type=eq.project_expense&deleted_at=is.null&limit=1000'),
        API.request('procurements', 'GET', null, '?select=vendor_id,total_price,paid_amount,payment_term&deleted_at=is.null&limit=1000')
      ]);
      const balanceMap = this._vendorBalanceMap(data, vendorExpenses, vendorProcs);
      const html = data.length ? this.table(['الاسم', 'النوع', 'التخصص', 'الشخص المسؤول', 'الهاتف', 'الرصيد', 'الإجراءات'], data.map(v => {
        const typeBadge = v.vendor_type === 'merchandise' ? '<span class="badge badge-gold">بضاعة</span>' : '<span class="badge badge-gray">خدمات</span>';
        const balance = balanceMap[v.id] || 0;
        const balColor = balance > 0 ? 'var(--red)' : balance < 0 ? 'var(--green)' : 'var(--text3)';
        const balLabel = balance > 0 ? 'مستحق' : balance < 0 ? 'زيادة' : 'تسوية';
        const balanceCell = `<span style="color:${balColor};font-weight:700;font-size:12px">${this.fmtMoney(Math.abs(balance))}</span> <span style="font-size:10px;color:var(--text3)">${balLabel}</span>`;
        const actions = UI.actions(v.id, 'Crud.editVendor', 'Crud.delVendor', Auth.can('vendors', 'edit'), Auth.can('vendors', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.vendorStatement('${v.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.vendorPurchases('${v.id}')">💰 مشتريات</button>`;
        return [`<a href="#" onclick="App.go('vendor',{vendorId:'${v.id}'});return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(v.name)}</a>`, typeBadge, App.esc(v.sector || '-'), App.esc(v.contact_person || '-'), App.esc(v.phone || '-'), balanceCell, actions];
      })) : `<p style="color:var(--text3);padding:16px">لا يوجد موردين</p>${Auth.can('vendors','add')?'<button class="btn btn-primary" onclick="Crud.addVendor()">+ إضافة أول مورد</button>':''}`;
      document.getElementById('vendors-tbl').innerHTML = html + (data.length ? this._paginationHtml('vendors', page, limit, total) : '');
      this.attachSearch('vendors-tbl', '🔍 بحث في الموردين...');
    } catch (e) {
      console.error(e);
      UI.toast('Vendors load failed: ' + e.message, 'error');
      document.getElementById('vendors-tbl').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل الموردين</p><button class="btn btn-secondary" onclick="App.loadVendors()">🔄 إعادة المحاولة</button>`;
    }
  },

  async loadVendor(vendorId) {
    try {
      const [vendorRows, txs, procs] = await Promise.all([
        API.request('vendors', 'GET', null, `?select=*&id=eq.${vendorId}&deleted_at=is.null`),
        API.request('transactions', 'GET', null, `?select=*,projects(name)&vendor_id=eq.${vendorId}&type=eq.project_expense&deleted_at=is.null&order=date.desc&limit=100`),
        API.request('procurements', 'GET', null, `?select=*,projects(name)&vendor_id=eq.${vendorId}&deleted_at=is.null&order=date.desc&limit=100`)
      ]);
      const vendor = vendorRows[0];
      if (!vendor) { document.getElementById('vendor-detail').innerHTML = '<p style="color:var(--red);padding:16px">⚠️ المورد غير موجود</p>'; return; }

      const balHtml = (bal) => {
        const color = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--blue)' : 'var(--green)';
        const label = bal > 0 ? 'مستحق' : bal < 0 ? 'زيادة' : 'تسوية';
        return `<span style="color:${color};font-weight:700;font-size:12px">${App.fmtMoney(Math.abs(bal))}</span> <span style="font-size:10px;color:var(--text3)">${label}</span>`;
      };

      let totalOwed = 0, totalPaid = 0;
      const txRows = txs.map((t, i) => {
        const isNew = t.payment_term !== undefined && t.payment_term !== null;
        const amount = +t.amount || 0;
        const paid = isNew ? (+t.paid_amount || 0) : amount;
        totalOwed += amount; totalPaid += paid;
        return [i+1, t.date || '-', App.fmtTxType(t.type), t.projects?.name || t.project_name || '-', t.description || '-', App.fmtMoney(amount), App.fmtMoney(paid), balHtml(amount - paid)];
      });
      const procRows = procs.map((p, i) => {
        const isNew = p.payment_term !== undefined && p.payment_term !== null;
        const total = +p.total_price || 0;
        const paid = isNew ? (+p.paid_amount || 0) : total;
        totalOwed += total; totalPaid += paid;
        return [i+1, p.date || '-', p.item_name || '-', p.quantity || 1, App.fmtMoney(+p.unit_price || 0), App.fmtMoney(total), App.fmtMoney(paid), balHtml(total - paid), p.projects?.name || p.project_name || '-'];
      });

      const netBalance = totalOwed - totalPaid;
      const balColor = netBalance > 0 ? 'var(--red)' : netBalance < 0 ? 'var(--blue)' : 'var(--green)';
      const balLabel = netBalance > 0 ? 'مستحق' : netBalance < 0 ? 'زيادة مدفوعة' : 'تسوية';

      const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي المستحق</div><div class="kpi-value" style="color:var(--red)">${App.fmtMoney(totalOwed)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي المدفوع</div><div class="kpi-value" style="color:var(--green)">${App.fmtMoney(totalPaid)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الرصيد (${balLabel})</div><div class="kpi-value" style="color:${balColor}">${App.fmtMoney(Math.abs(netBalance))}</div></div>
      </div>`;

      const typeBadge = vendor.vendor_type === 'merchandise' ? '<span class="badge badge-gold">بضاعة</span>' : '<span class="badge badge-gray">خدمات</span>';
      const actions = UI.actions(vendor.id, 'Crud.editVendor', 'Crud.delVendor', Auth.can('vendors', 'edit'), Auth.can('vendors', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.vendorStatement('${vendor.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.vendorPurchases('${vendor.id}')">💰 مشتريات</button>`;
      const info = `<div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <h3 style="margin-bottom:4px">${App.esc(vendor.name)}</h3>
            <div style="font-size:12px;color:var(--text2)">${typeBadge} · ${App.esc(vendor.sector || '-')} · ${App.esc(vendor.contact_person || '-')} · ${App.esc(vendor.phone || '-')}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div>
        </div>
      </div>`;

      const txTable = txRows.length ? '<h4 style="margin:12px 0 8px;color:var(--text2)">📋 المعاملات</h4>' + App.table(['#', 'التاريخ', 'النوع', 'المشروع', 'البيان', 'المبلغ', 'المدفوع', 'الباقي'], txRows) : '';
      const procTable = procRows.length ? '<h4 style="margin:12px 0 8px;color:var(--text2)">🛒 المشتريات</h4>' + App.table(['#', 'التاريخ', 'الصنف', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'المدفوع', 'الباقي', 'المشروع'], procRows) : '';

      document.getElementById('vendor-detail-name').textContent = '🚚 ' + App.esc(vendor.name);
      document.getElementById('vendor-detail').innerHTML = summary + info + txTable + procTable;
    } catch (e) {
      console.error(e);
      UI.toast('فشل تحميل تفاصيل المورد: ' + e.message, 'error');
      document.getElementById('vendor-detail').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل البيانات</p><button class="btn btn-secondary" onclick="App.loadVendor('${vendorId}')">🔄 إعادة المحاولة</button>`;
    }
  },

  async loadTransactions() {
    try {
      const txPage = this.pageState.transactions || 1;
      const txPerPage = 10;
      const expPage = this.pageState.txExpenses || 1;
      const expPerPage = 10;

      const [recentTxs, projects, projectExpenses, allProjTxs, totalTxCount, totalExpCount] = await Promise.all([
        API.fetchAll('transactions', "?select=*&type=in.(project_deposit,project_expense)&deleted_at=is.null&order=created_at.desc"),
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null'),
        API.request('transactions', 'GET', null, `?select=*&type=eq.project_expense&deleted_at=is.null&order=date.desc&offset=${(expPage - 1) * expPerPage}&limit=${expPerPage}`),
        API.fetchAll('transactions', '?select=type,amount,project_id,expense_category&type=in.(project_deposit,project_expense)&deleted_at=is.null'),
        API.count('transactions', '?type=in.(project_deposit,project_expense)&deleted_at=is.null'),
        API.count('transactions', '?type=eq.project_expense&deleted_at=is.null')
      ]);
      // KPIs (from bounded allProjTxs)
      const deposits = allProjTxs.filter(t => t.type === 'project_deposit').reduce((s, t) => s + (+t.amount || 0), 0);
      const allProjectExpenses = allProjTxs.filter(t => t.type === 'project_expense');
      const expenses = allProjectExpenses.reduce((s, t) => s + (+t.amount || 0), 0);
      const expByProject = {};
      const designByProject = {};
      allProjectExpenses.forEach(t => {
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
      // Main table: combine, filter, paginate in memory
      const expByProj = {};
      const designByProj = {};
      allProjectExpenses.forEach(t => {
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
      let allTxs = [...recentTxs, ...supRows.flat()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (App.txTypeFilter === 'deposit') allTxs = allTxs.filter(t => t.type === 'project_deposit' || t.type === 'supervision');
      if (App.txTypeFilter === 'expense') allTxs = allTxs.filter(t => t.type === 'project_expense');

      const totalTxDisplay = allTxs.length;
      const totalTxPages = Math.max(1, Math.ceil(totalTxDisplay / txPerPage));
      const safeTxPage = Math.min(Math.max(1, txPage), totalTxPages);
      this.pageState.transactions = safeTxPage;
      const pagedTxs = allTxs.slice((safeTxPage - 1) * txPerPage, safeTxPage * txPerPage);

      const txHtml = pagedTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف', 'الجهة', 'العميل', 'المشروع', 'طريقة الدفع', 'الإجراءات'], pagedTxs.map(t => {
        const badgeColor = t.type === 'project_deposit' ? 'green' : 'red';
        let party;
        if (t.type === 'project_expense') {
          party = t.vendor_name || '-';
          if (t.item_name) party += ' <span class="badge badge-gray" style="font-size:10px">' + t.item_name + '</span>';
          else if (t.section_name) party += ' <span class="badge badge-gray" style="font-size:10px">' + t.section_name + '</span>';
          else if (t.expense_category === 'design') party += ' <span class="badge badge-gray" style="font-size:10px">تصميم</span>';
        } else {
          party = t.vendor_name || t.employee_name || t.sector_name || '-';
        }
        const clientName = t.party_name || '-';
        const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '-';
        const termLabels = { immediate: 'فوري', credit: 'اجل', settlement: 'تسديد' };
        let pt = t.payment_method ? `<span class="badge badge-gray" style="font-size:10px">${pm}</span>` : '-';
        if (t.type === 'project_expense') {
          pt = t.payment_method ? `<span class="badge badge-gray" style="font-size:10px">${pm}</span>` : (t.payment_term ? `<span class="badge badge-${t.payment_term === 'immediate' ? 'green' : t.payment_term === 'credit' ? 'orange' : 'blue'}" style="font-size:10px">${termLabels[t.payment_term] || t.payment_term}</span>` : '-');
        }
        const actions = t.type === 'supervision' && !t.id ? '-' : UI.actions(t.id, 'Crud.editTx', 'Crud.delTx');
        return [this.fmtDate(t.created_at), `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`, this.fmtMoney(t.amount), t.description || '-', party, clientName, t.project_name || '-', pt, actions];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      document.getElementById('tx-tbl').innerHTML = txHtml + this._paginationHtml('transactions', safeTxPage, txPerPage, totalTxDisplay);
      this.attachSearch('tx-tbl', '🔍 بحث في معاملات المشاريع...');

      // Expenses-only tab with page-based pagination
      const pmLabels = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' };
      const expenseRows = [...projectExpenses].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
      const expHtml = expenseRows.length ? this.table(['#', 'العميل', 'المشروع', 'المورد', 'القسم', 'البند', 'المبلغ', 'طريقة الدفع', 'المدفوع', 'الباقي', 'التاريخ', 'الإجراءات'], expenseRows.map((t, idx) => {
        const isNew = t.payment_term !== undefined && t.payment_term !== null;
        const paid = isNew ? (+t.paid_amount || 0) : (+t.amount || 0);
        const bal = (+t.amount || 0) - paid;
        const balColor = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--green)' : 'var(--text3)';
        const balLabel = bal > 0 ? 'متبقي' : bal < 0 ? 'زيادة' : 'تسوية';
        const sectionLabel = t.section_name || (t.expense_category === 'design' ? 'تصميم' : 'تشطيب');
        const itemLabel = t.item_name || '-';
        const pmBadge = t.payment_method ? `<span class="badge badge-gray" style="font-size:10px">${pmLabels[t.payment_method] || t.payment_method}</span>` : '-';
        return [idx + 1, t.party_name || '-', t.project_name || '-', t.vendor_name || '-', sectionLabel, itemLabel, this.fmtMoney(t.amount), pmBadge, this.fmtMoney(paid), `<span style="color:${balColor};font-weight:600;font-size:12px">${this.fmtMoney(Math.abs(bal))}</span> <span style="font-size:10px;color:var(--text3)">${balLabel}</span>`, this.fmtDate(t.date || t.created_at), UI.actions(t.id, 'Crud.editTx', 'Crud.delTx')];
      })) : '<p style="color:var(--text3)">لا توجد مصروفات</p>';
      document.getElementById('tx-expenses-tbl').innerHTML = expHtml + this._paginationHtml('txExpenses', expPage, expPerPage, totalExpCount);
      this.attachSearch('tx-expenses-tbl', '🔍 بحث في المصروفات...');
    } catch (e) {
      console.error(e);
      UI.toast('Transactions load failed: ' + e.message, 'error');
      document.getElementById('tx-tbl').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل المعاملات</p><button class="btn btn-secondary" onclick="App.loadTransactions()">🔄 إعادة المحاولة</button>`;
      document.getElementById('tx-expenses-tbl').innerHTML = '';
    }
  },

  async loadTxExpenses() {
    await this.loadTransactions();
  },

  exportOfficeExcel() {
    if (typeof XLSX === 'undefined') {
      UI.toast('مكتبة Excel لم يتم تحميلها — تأكد من اتصال الإنترنت', 'error');
      return;
    }
    const rows = (this._officeData || []).map(t => [
      t.created_at ? new Date(t.created_at).toLocaleDateString('ar-EG') : '-',
      App.fmtTxType(t.type),
      +t.amount || 0,
      t.employee_name || '-',
      t.sector_name || '-',
      t.description || '-'
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      ['كشف حساب المكتب'],
      ['التاريخ', 'النوع', 'المبلغ', 'الموظف', 'التصنيف', 'الوصف'],
      ...rows
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف المكتب');
    XLSX.writeFile(wb, `كشف-حساب-المكتب-${new Date().toISOString().slice(0,10)}.xlsx`);
    UI.toast('تم التحميل');
  },

  async loadOffice() {
    try {
      const [incomeTxs, expenseTxs, projects, projectExpenses, custodyRecords] = await Promise.all([
        API.request('transactions', 'GET', null, "?select=amount,created_at,type,description,sector_name,employee_name&type=eq.owner_deposit&deleted_at=is.null&order=created_at.desc&limit=200"),
        API.request('transactions', 'GET', null, "?select=amount,created_at,type,description,sector_name,employee_name&type=in.(office_expense,withdrawal)&deleted_at=is.null&order=created_at.desc&limit=200"),
        API.request('projects', 'GET', null, '?select=id,name,client_id,client_name,supervision_percentage,created_at,status&deleted_at=is.null'),
        API.request('transactions', 'GET', null, "?select=amount,project_id,expense_category&type=eq.project_expense&deleted_at=is.null"),
        API.request('custody_records', 'GET', null, "?select=*,employees(name)&deleted_at=is.null&order=date.desc&limit=200")
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

      // Custody totals
      const totalCustody = custodyRecords.reduce((s, r) => s + (+r.amount || 0), 0);
      const totalReturned = custodyRecords.reduce((s, r) => s + (+r.returned_amount || 0), 0);

      document.getElementById('office-kpis').innerHTML = `
        <div class="kpi-card" style="border-top:4px solid var(--green)"><div class="kpi-label">إيرادات المكتب</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(totalIncome)}</div><div style="font-size:12px;color:var(--text3);margin-top:6px">إشراف: ${this.fmtMoney(calcSupervision)} &nbsp;|&nbsp; توريدات: ${this.fmtMoney(txIncome)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--red)"><div class="kpi-label">مصروفات المكتب</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expense)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--gold)"><div class="kpi-label">رصيد المكتب</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(totalIncome - expense)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--blue)"><div class="kpi-label">العهد النقدية</div><div class="kpi-value" style="color:var(--blue)">${this.fmtMoney(totalCustody - totalReturned)}</div><div style="font-size:12px;color:var(--text3);margin-top:6px">إجمالي: ${this.fmtMoney(totalCustody)} &nbsp;|&nbsp; مرتجع: ${this.fmtMoney(totalReturned)}</div></div>`;
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
      this._officeData = allTxs;
      document.getElementById('office-tbl').innerHTML = allTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الموظف', 'التصنيف', 'الوصف', 'الإجراءات'], allTxs.map(t => {
        const badgeColor = ['owner_deposit','supervision'].includes(t.type) ? 'green' : 'red';
        const actions = t.id ? UI.actions(t.id, 'Crud.editTx', 'Crud.delTx') : '-';
        return [this.fmtDate(t.created_at), `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`, this.fmtMoney(t.amount), t.employee_name || '-', t.sector_name || '-', t.description || '-', actions];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      this.attachSearch('office-tbl', '🔍 بحث في معاملات المكتب...');

      // Custody table
      const statusLabels = { active: 'نشطة', settled: 'مقفلة', partial: 'جزئي' };
      const custodyRows = custodyRecords.map((r, i) => {
        const bal = (+r.amount || 0) - (+r.returned_amount || 0);
        const balColor = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--green)' : 'var(--text3)';
        const typeBadge = r.custody_type === 'project' ? '<span class="badge badge-blue">مشروع</span>' : '<span class="badge badge-gold">مكتب</span>';
        const related = r.custody_type === 'project' ? (r.project_name || '-') : (r.sector_name || '-');
        return [i+1, r.date || '-', typeBadge, r.employees?.name || r.employee_name || '-', related, this.fmtMoney(r.amount), this.fmtMoney(r.returned_amount || 0), `<span style="color:${balColor};font-weight:600">${this.fmtMoney(Math.abs(bal))}</span>`, statusLabels[r.status] || r.status, UI.actions(r.id, 'Crud.editCustody', 'Crud.delCustody')];
      });
      document.getElementById('office-custody-tbl').innerHTML = custodyRows.length ? this.table(['#', 'التاريخ', 'النوع', 'الموظف', 'التصنيف / المشروع', 'المبلغ', 'المرتجع', 'الباقي', 'الحالة', ''], custodyRows) : '<p style="color:var(--text3)">لا توجد عهد نقدية</p>';
      this.attachSearch('office-custody-tbl', '🔍 بحث في العهد النقدية...');
    } catch (e) {
      console.error(e);
      UI.toast('Office load failed: ' + e.message, 'error');
      document.getElementById('office-kpis').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل بيانات المكتب</p><button class="btn btn-secondary" onclick="App.loadOffice()">🔄 إعادة المحاولة</button>`;
    }
  },

  async loadEmployees() {
    try {
      const page = this.pageState.employees || 1;
      const limit = this.PAGE_SIZE;
      const offset = (page - 1) * limit;
      const [data, total] = await Promise.all([
        API.request('employees', 'GET', null, `?select=*&is_active=eq.true&deleted_at=is.null&order=created_at.desc&limit=${limit}&offset=${offset}`),
        API.count('employees', '?is_active=eq.true&deleted_at=is.null')
      ]);
      const empIds = data.map(e => e.id);
      let custodyData = [];
      if (empIds.length) {
        custodyData = await API.request('custody_records', 'GET', null, `?select=employee_id,amount,status&employee_id=in.(${empIds.join(',')})&deleted_at=is.null`);
      }
      const custodyByEmp = {};
      custodyData.forEach(c => { custodyByEmp[c.employee_id] = (custodyByEmp[c.employee_id] || 0) + (+c.amount || 0); });
      const html = data.length ? this.table(['الاسم', 'الوظيفة', 'الراتب', 'العهدة النشطة', 'الإجراءات'], data.map(e => {
        const cAmt = custodyByEmp[e.id] || 0;
        const custodyBadge = cAmt > 0 ? `<span class="badge badge-green">${this.fmtMoney(cAmt)}</span>` : '-';
        const actions = UI.actions(e.id, 'Crud.editEmp', 'Crud.delEmp', Auth.can('employees', 'edit'), Auth.can('employees', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.employeeCustody('${e.id}')">العهدة</button> <button class="btn btn-sm btn-secondary" onclick="Crud.employeeAttendance('${e.id}')">الحضور</button>`;
        return [App.esc(e.name), App.esc(e.job_title || '-'), this.fmtMoney(e.salary), custodyBadge, actions];
      })) : `<p style="color:var(--text3);padding:16px">لا يوجد موظفين</p><button class="btn btn-primary" onclick="Crud.addEmp()">+ إضافة أول موظف</button>`;
      document.getElementById('emp-tbl').innerHTML = html + (data.length ? this._paginationHtml('employees', page, limit, total) : '');
      this.attachSearch('emp-tbl', '🔍 بحث في الموظفين...');
      await this.loadEmpPayroll();
    } catch (e) {
      console.error(e);
      UI.toast('Employees load failed: ' + e.message, 'error');
      document.getElementById('emp-tbl').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل الموظفين</p><button class="btn btn-secondary" onclick="App.loadEmployees()">🔄 إعادة المحاولة</button>`;
    }
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
        preview.innerHTML = `<p style="color:var(--red)">لم يتم التعرف على الأعمدة المطلوبة. العناوين المكتشفة: ${App.esc(headers.join(' | '))}</p><p style="color:var(--text3);font-size:12px">المطلوب: عمود الاسم + عمود التاريخ (اختياري: دخول/خروج)</p>`;
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
          const [ih, im] = inTime.split(':').map(Number);
        const inMins = ih * 60 + im;
        if (inMins > 555) status = 'late';
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
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
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
      UI.toast('Payroll load failed: ' + e.message, 'error');
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
      const lastDay = new Date(year, month, 0).getDate();
      const [employees, attendance, empTxs] = await Promise.all([
        API.request('employees', 'GET', null, '?select=*&is_active=eq.true&deleted_at=is.null&order=name.asc'),
        API.request('attendance_records', 'GET', null, `?date=gte.${year}-${String(month).padStart(2,'0')}-01&date=lte.${year}-${String(month).padStart(2,'0')}-${lastDay}&deleted_at=is.null`),
        API.request('employee_transactions', 'GET', null, `?date=gte.${year}-${String(month).padStart(2,'0')}-01&date=lte.${year}-${String(month).padStart(2,'0')}-${lastDay}&deleted_at=is.null`)
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
              await API.request('payroll_records', 'PATCH', { base_salary: r.base_salary, days_present: r.days_present, days_absent: r.days_absent, days_late: r.days_late, days_half: r.days_half, days_leave: r.days_leave, deductions: r.deductions, bonuses: r.bonuses, penalties: r.penalties, net_salary: r.net_salary, status: 'draft' }, `?id=eq.${existing[0].id}`);
            }
          } else { throw e; }
        }
      }
      UI.toast(`تم توليد رواتب ${records.length} موظف`);
      this.loadEmpPayroll();
    } catch (e) { console.error(e); UI.toast('خطأ في توليد الرواتب: ' + e.message, 'error'); }
  },

  async loadSettings() {
    const settingsHtml = `<div class="card" style="margin-top:16px;border:1px solid var(--gold)" id="settings-security-card">
      <h3 style="color:var(--gold)">🔐 الأمان</h3>
      <p style="color:var(--text2);font-size:13px;margin-bottom:12px">لم يعد مفتاح Service Role يُخزّن في المتصفح أو يُرسل منه. لإدارة المستخدمين، يستخدم النظام التسجيل العام (public signup) من شاشة "تسجيل مستخدم جديد".</p>
      <p style="font-size:12px;color:var(--text3);margin-top:8px">لتدوير المفاتيح، اذهب إلى Supabase Dashboard → Project Settings → API.</p>
    </div>`;
    const container = document.querySelector('.main-content');
    if (container && !document.getElementById('settings-security-card')) {
      const div = document.createElement('div');
      div.innerHTML = settingsHtml;
      container.appendChild(div);
    }
  },

  // Deprecated: service-role keys are no longer stored in the browser.
  async saveServiceKey() {
    UI.toast('تخزين مفتاح Service Role في المتصفح متوقف لأسباب أمنية.', 'info');
  },

  clearServiceKey() {
    localStorage.removeItem('sara_service_key');
    UI.toast('تم مسح أي مفتاح قديم — سيتم إعادة التحميل', 'success');
    setTimeout(() => location.reload(), 800);
  },

  async loadUsers() {
    try {
      // Service-role admin endpoints are disabled in the browser for security.
      // User management is based on the profiles table.
      const profiles = await API.request('profiles', 'GET', null, '?select=*&order=created_at.desc');
      const users = profiles.map(p => ({
        id: p.id,
        username: p.username || p.id.slice(0, 8),
        name: p.name || p.id.slice(0, 8),
        role: p.role || 'user',
        created_at: p.created_at
      }));
      document.getElementById('users-tbl').innerHTML = users.length ? this.table(['المستخدم', 'الاسم', 'الدور', 'تاريخ الإنشاء', 'الإجراءات'], users.map(u => [
        App.esc(u.username),
        App.esc(u.name),
        u.role === 'admin' ? '<span class="badge badge-green">مدير</span>' : '<span class="badge badge-gray">موظف</span>',
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
      const tables = ['clients','projects','employees','vendors','items','sectors','transactions','procurements','employee_transactions','employee_salary_history','custody_records','custody_expenses','attendance_records','payroll_records','work_sections','work_items','profiles','audit_logs','user_permissions','project_tasks'];
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
    const tables = ['clients','projects','employees','vendors','items','sectors','transactions','procurements','employee_transactions','employee_salary_history','custody_records','custody_expenses','attendance_records','payroll_records','work_sections','work_items','profiles','audit_logs','user_permissions','project_tasks'];
    const progress = document.getElementById('backup-progress');
    progress.innerHTML = '<p style="color:var(--gold)">⏳ جاري جمع البيانات...</p>';
    const zip = new JSZip();
    const folder = zip.folder('Sara_Backup_' + new Date().toISOString().slice(0,10));
    let ok = 0, skip = 0, fail = 0;
    const failed = [];
    for (const table of tables) {
      try {
        const data = await API.fetchAll(table, '?select=*');
        folder.file(`${table}.json`, JSON.stringify(data, null, 2));
        ok++;
      } catch (e) {
        const msg = (e?.message || '').toLowerCase();
        const isMissing = msg.includes('does not exist') || msg.includes('relation') || msg.includes('pgrst116');
        if (isMissing) {
          skip++;
        } else {
          fail++;
          failed.push(table);
          console.error(`[Backup] failed for ${table}:`, e);
        }
      }
      progress.innerHTML = `<p style="color:var(--gold)">⏳ تم ${ok} جداول${skip ? ` (تخطي ${skip})` : ''}${fail ? ` — فشل ${fail}` : ''}...</p>`;
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
    const failMsg = fail > 0 ? ` <span style="color:var(--red)">(${fail} جدول فشل: ${failed.join(', ')})</span>` : '';
    progress.innerHTML = `<p style="color:${fail ? 'var(--red)' : 'var(--green)'}">${fail ? '⚠️' : '✅'} تم التحميل — ${ok} جدول${skipMsg}${failMsg}</p>`;
    this.loadBackup();
  },

  clearAppCache() {
    try {
      // Tokens are stored in sessionStorage; preserve login across cache clear.
      const token = sessionStorage.getItem('sara_token');
      // Service-role keys are no longer preserved in the browser.
      localStorage.removeItem('sara_service_key');
      localStorage.clear();
      sessionStorage.clear();
      if (token) sessionStorage.setItem('sara_token', token);
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
      UI.toast('Permissions load failed: ' + e.message, 'error');
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
      UI.toast('Audit log load failed: ' + e.message, 'error');
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
      const sectors = await API.request('sectors', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc');
      document.getElementById('sectors-tbl').innerHTML = sectors.length ? this.table(['التصنيف', 'الوصف', 'الإجراءات'], sectors.map(s => [
        s.name, s.description || '-', UI.actions(s.id, 'Crud.editSector', 'Crud.delSector', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : `<p style="color:var(--text3);padding:16px">لا توجد تصنيفات</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addSector()">+ إضافة أول تصنيف</button>':''}`;
      this.attachSearch('sectors-tbl', '🔍 بحث في التصنيفات...');

      let workSections = [], workItems = [];
      try {
        workSections = await API.request('work_sections', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc');
      } catch (e) { console.log('[MasterData] work_sections not ready:', e.message); }
      try {
        workItems = await API.request('work_items', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc');
      } catch (e) { console.log('[MasterData] work_items not ready:', e.message); }

      const sectionMap = Object.fromEntries(workSections.map(s => [s.id, s.name]));
      document.getElementById('work-sections-tbl').innerHTML = workSections.length ? this.table(['القسم', 'ملاحظات', 'الإجراءات'], workSections.map(s => [
        App.esc(s.name), App.esc(s.notes || s.description || '-'), UI.actions(s.id, 'Crud.editWorkSection', 'Crud.delWorkSection', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : `<p style="color:var(--text3);padding:16px">لا يوجد أقسام</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addWorkSection()">+ إضافة أول قسم</button>':''}`;
      this.attachSearch('work-sections-tbl', '🔍 بحث في الأقسام...');
      document.getElementById('work-items-tbl').innerHTML = workItems.length ? this.table(['البند', 'القسم', 'ملاحظات', 'الإجراءات'], workItems.map(i => [
        App.esc(i.name), App.esc(sectionMap[i.section_id] || '-'), App.esc(i.notes || i.description || '-'), UI.actions(i.id, 'Crud.editWorkItem', 'Crud.delWorkItem', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : `<p style="color:var(--text3);padding:16px">لا توجد بنود</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addWorkItem()">+ إضافة أول بند</button>':''}`;
      this.attachSearch('work-items-tbl', '🔍 بحث في البنود...');

      let items = [];
      try {
        items = await API.request('items', 'GET', null, '?select=*&deleted_at=is.null&order=name.asc');
      } catch (e) { console.log('[MasterData] items not ready:', e.message); }
      document.getElementById('items-tbl').innerHTML = items.length ? this.table(['الصنف', 'المواصفات', 'العلامة', 'الوحدة', 'الإجراءات'], items.map(i => [
        App.esc(i.name), App.esc(i.specification || '-'), App.esc(i.brand || '-'), App.esc(i.unit || '-'), UI.actions(i.id, 'Crud.editItem', 'Crud.delItem', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : `<p style="color:var(--text3);padding:16px">لا توجد أصناف</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addItem()">+ إضافة أول صنف</button>':''}`;
      this.attachSearch('items-tbl', '🔍 بحث في الأصناف...');
    } catch (e) {
      console.error(e);
      UI.toast('Master data load failed: ' + e.message, 'error');
      document.getElementById('sectors-tbl').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل البيانات الأساسية</p><button class="btn btn-secondary" onclick="App.loadMasterData()">🔄 إعادة المحاولة</button>`;
    }
  },

  async loadTasks() {
    try {
      const statusFilter = App.taskStatusFilter || 'all';
      const [tasks, projects] = await Promise.all([
        API.request('project_tasks', 'GET', null, `?select=*,projects(name)&deleted_at=is.null&order=due_date.asc&limit=200`),
        API.request('projects', 'GET', null, '?select=id,name&deleted_at=is.null')
      ]);
      const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

      const filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);

      const statusBadge = (s) => {
        const colors = { pending: 'gray', in_progress: 'blue', done: 'green' };
        const labels = { pending: 'معلق', in_progress: 'قيد التنفيذ', done: 'منتهي' };
        return `<span class="badge badge-${colors[s] || 'gray'}">${labels[s] || s}</span>`;
      };
      const priorityBadge = (p) => {
        const colors = { low: 'gray', medium: 'orange', high: 'red' };
        const labels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        return `<span class="badge badge-${colors[p] || 'gray'}">${labels[p] || p}</span>`;
      };

      const rows = filtered.map((t, i) => [
        i+1,
        `<a href="#" onclick="App.go('clients');return false;" style="color:var(--gold);text-decoration:none">${App.esc(projectMap[t.project_id] || t.projects?.name || '-')}</a>`,
        App.esc(t.name),
        t.assignee || '-',
        t.start_date || '-',
        t.due_date || '-',
        statusBadge(t.status),
        priorityBadge(t.priority),
        `<button class="btn btn-sm btn-secondary" onclick="Crud.editProjectTask('${t.id}')">تعديل</button> <button class="btn btn-sm btn-red" onclick="Crud.delProjectTask('${t.id}')">حذف</button>`
      ]);

      const table = rows.length ? App.table(['#', 'المشروع', 'المهمة', 'المسؤول', 'تاريخ البدء', 'تاريخ الاستحقاق', 'الحالة', 'الأولوية', 'الإجراءات'], rows) : '<p style="color:var(--text3);padding:16px">لا توجد مهام مسجلة</p>';
      document.getElementById('tasks-tbl').innerHTML = table;
      this.attachSearch('tasks-tbl', '🔍 بحث في المهام...');
    } catch (e) {
      console.error(e);
      UI.toast('فشل تحميل المهام: ' + e.message, 'error');
      document.getElementById('tasks-tbl').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل المهام</p><button class="btn btn-secondary" onclick="App.loadTasks()">🔄 إعادة المحاولة</button>`;
    }
  },

});
