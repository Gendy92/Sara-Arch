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

  // ─── DATA LOADING ───
  async loadDashboard() {
    try {
      const [clients, projects, employees, txs, vendorExpenses, vendorProcs, allProjTxs, vendors] = await Promise.all([
        API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null&limit=1000'),
        API.request('employees', 'GET', null, '?select=id&is_active=eq.true&deleted_at=is.null&limit=1000'),
        API.request('transactions', 'GET', null, '?select=type,amount,date,project_id,client_id,expense_category,sector_name,created_at&deleted_at=is.null&order=created_at.desc&limit=200'),
        API.request('transactions', 'GET', null, '?select=vendor_id,amount,paid_amount,payment_term&type=eq.project_expense&deleted_at=is.null&limit=1000'),
        API.request('procurements', 'GET', null, '?select=vendor_id,total_price,paid_amount,payment_term&deleted_at=is.null&limit=1000'),
        API.request('transactions', 'GET', null, '?select=client_id,amount,type&deleted_at=is.null&type=in.(project_deposit,project_expense)&limit=1000'),
        API.request('vendors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
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
      // ─── Monthly Office Revenue vs Expenses Chart (last 6 months) ───
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        months.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleString('ar-EG', { month: 'short' }) });
      }
      const monthlyRev = {}; const monthlyExp = {};
      months.forEach(m => { monthlyRev[m.key] = 0; monthlyExp[m.key] = 0; });
      // Office income: owner_deposits + supervision (calculated like loadOffice)
      const projectExpenses = txs.filter(t => t.type === 'project_expense');
      const _expByProject = {}; const _designByProject = {};
      projectExpenses.forEach(t => {
        const amt = +t.amount || 0;
        _expByProject[t.project_id] = (_expByProject[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') {
          _designByProject[t.project_id] = (_designByProject[t.project_id] || 0) + amt;
        }
      });
      projects.forEach(p => {
        const exp = _expByProject[p.id] || 0;
        const design = _designByProject[p.id] || 0;
        const supAmt = (exp - design) * (p.supervision_percentage || 0) / 100;
        if (supAmt > 0 && p.created_at) {
          const mk = p.created_at.slice(0, 7);
          if (months.some(m => m.key === mk)) monthlyRev[mk] += supAmt;
        }
      });
      txs.forEach(t => {
        if (!t.date) return;
        const mk = t.date.slice(0, 7);
        if (months.some(m => m.key === mk)) {
          if (t.type === 'owner_deposit') monthlyRev[mk] += (+t.amount || 0);
          if (['office_expense','withdrawal'].includes(t.type)) monthlyExp[mk] += (+t.amount || 0);
        }
      });
      const maxVal = Math.max(...months.map(m => Math.max(monthlyRev[m.key], monthlyExp[m.key])), 1);
      const barChartHtml = `<div class="bar-chart">${months.map(m => {
        const rh = Math.round((monthlyRev[m.key] / maxVal) * 120);
        const eh = Math.round((monthlyExp[m.key] / maxVal) * 120);
        return `<div class="bar-chart-group"><div class="bar-chart-bars"><div class="bar-chart-bar revenue" style="height:${rh}px" title="إيرادات: ${this.fmtMoney(monthlyRev[m.key])}"></div><div class="bar-chart-bar expense" style="height:${eh}px" title="مصروفات: ${this.fmtMoney(monthlyExp[m.key])}"></div></div><div class="bar-chart-label">${m.label}</div></div>`;
      }).join('')}</div><div class="bar-chart-legend"><span><span class="dot" style="background:var(--green)"></span> إيرادات المكتب</span><span><span class="dot" style="background:var(--red)"></span> مصروفات المكتب</span></div>`;
      document.getElementById('monthly-chart').innerHTML = barChartHtml;
      // ─── Office Expense Breakdown by Sector (Pie Chart) ───
      const officeExp = txs.filter(t => t.type === 'office_expense');
      const expBySector = {};
      officeExp.forEach(t => {
        const sector = t.sector_name || 'غير مصنف';
        expBySector[sector] = (expBySector[sector] || 0) + (+t.amount || 0);
      });
      const sectorRows = Object.entries(expBySector).sort((a, b) => b[1] - a[1]);
      const pieColors = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00acc1', '#fdd835', '#6d4c41', '#26a69a', '#ef5350'];
      let pieHtml = '<p style="color:var(--text3)">لا توجد مصروفات مكتبية</p>';
      if (sectorRows.length) {
        const total = sectorRows.reduce((s, r) => s + r[1], 0);
        const size = 160, cx = size / 2, cy = size / 2, r = size / 2 - 4;
        let startAngle = 0;
        const paths = sectorRows.map(([label, amt], i) => {
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
        const legend = sectorRows.map(([label, amt], i) => {
          const pct = Math.round((amt / total) * 100);
          return `<div class="pie-legend-item"><span class="pie-legend-color" style="background:${pieColors[i % pieColors.length]}"></span><span>${label}</span><span>${pct}% · ${this.fmtMoney(amt)}</span></div>`;
        }).join('');
        pieHtml = `<div class="pie-chart-wrap"><div class="pie-chart"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg></div><div class="pie-legend">${legend}<div class="pie-legend-item" style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px;font-weight:600;color:var(--text)"><span style="width:12px"></span><span>الإجمالي</span><span>${this.fmtMoney(total)}</span></div></div></div>`;
      }
      document.getElementById('expense-chart').innerHTML = pieHtml;
      // ─── Top 10 Vendor Outstanding Balances ───
      const balanceMap = this._vendorBalanceMap(vendors, vendorExpenses, vendorProcs);
      const vendorBalances = vendors.map(v => {
        const balance = balanceMap[v.id] || 0;
        if (balance <= 0) return null;
        return { name: v.name, balance };
      }).filter(Boolean).sort((a, b) => b.balance - a.balance).slice(0, 10).map(v => [v.name, `<span style="color:var(--red);font-weight:700">${this.fmtMoney(v.balance)}</span>`]);
      document.getElementById('dash-vendors').innerHTML = vendorBalances.length
        ? this.table(['المورد', 'المبلغ المستحق'], vendorBalances)
        : '<p style="color:var(--text3)">لا توجد مستحقات للموردين</p>';
      // ─── Top 5 Active Customer Balances ───
      const clientMap = {};
      clients.forEach(c => clientMap[c.id] = c.name);
      const activeClientIds = new Set(projects.filter(p => p.status === 'active').map(p => p.client_id));
      const clientDeposits = {};
      const clientExpenses = {};
      allProjTxs.forEach(t => {
        if (!t.client_id) return;
        if (t.type === 'project_deposit') clientDeposits[t.client_id] = (clientDeposits[t.client_id] || 0) + (+t.amount || 0);
        if (t.type === 'project_expense') clientExpenses[t.client_id] = (clientExpenses[t.client_id] || 0) + (+t.amount || 0);
      });
      const clientBalances = Object.keys(clientMap)
        .filter(cid => activeClientIds.has(cid))
        .map(cid => {
          const dep = clientDeposits[cid] || 0;
          const exp = clientExpenses[cid] || 0;
          const balance = dep - exp;
          return { name: clientMap[cid], balance, dep, exp };
        })
        .filter(c => c.balance !== 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10)
        .map(c => [c.name, this.fmtMoney(c.dep), this.fmtMoney(c.exp), `<span style="color:${c.balance >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${this.fmtMoney(c.balance)}</span>`]);
      document.getElementById('dash-clients').innerHTML = clientBalances.length
        ? this.table(['العميل', 'الإيداعات', 'المصروفات', 'الرصيد'], clientBalances)
        : '<p style="color:var(--text3)">لا يوجد عملاء نشطون</p>';
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
          return [p.name, p.address || '-', this.fmtMoney(p.value), this.fmtMoney(exp), balBadge, (p.supervision_percentage || 0) + '%', this.fmtMoney(supAmt), `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${p.status}</span>`, pActions];
        });
        const projTable = cProjects.length ? this.table(['المشروع', 'العنوان', 'القيمة', 'مصروفات', 'الرصيد', 'إشراف %', 'إشراف', 'الحالة', 'الإجراءات'], projRows) : '<p style="color:var(--text3);padding:8px 0">لا توجد مشاريع لهذا العميل</p>';
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
      document.getElementById('clients-list').innerHTML = html + this._paginationHtml('clients', page, limit, totalClients);
      this.attachSearch('clients-list', '🔍 بحث في العملاء أو المشاريع...');
    } catch (e) {
      console.error(e);
      UI.toast('Clients load failed: ' + e.message, 'error');
      document.getElementById('clients-list').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل العملاء</p><button class="btn btn-secondary" onclick="App.loadClients()">🔄 إعادة المحاولة</button>`;
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
        return [v.name, typeBadge, v.sector || '-', v.contact_person || '-', v.phone || '-', balanceCell, actions];
      })) : `<p style="color:var(--text3);padding:16px">لا يوجد موردين</p>${Auth.can('vendors','add')?'<button class="btn btn-primary" onclick="Crud.addVendor()">+ إضافة أول مورد</button>':''}`;
      document.getElementById('vendors-tbl').innerHTML = html + (data.length ? this._paginationHtml('vendors', page, limit, total) : '');
      this.attachSearch('vendors-tbl', '🔍 بحث في الموردين...');
    } catch (e) {
      console.error(e);
      UI.toast('Vendors load failed: ' + e.message, 'error');
      document.getElementById('vendors-tbl').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل الموردين</p><button class="btn btn-secondary" onclick="App.loadVendors()">🔄 إعادة المحاولة</button>`;
    }
  },

  async loadTransactions() {
    try {
      const [recentTxs, projects, projectExpenses, allProjTxs] = await Promise.all([
        API.request('transactions', 'GET', null, "?select=*&type=in.(project_deposit,project_expense)&deleted_at=is.null&order=created_at.desc&limit=50"),
        API.request('projects', 'GET', null, '?select=*&deleted_at=is.null'),
        API.request('transactions', 'GET', null, `?select=*&type=eq.project_expense&deleted_at=is.null&order=date.desc&offset=${App.txExpenseOffset}&limit=${App.txExpenseLimit}`),
        API.request('transactions', 'GET', null, '?select=type,amount,project_id,expense_category&type=in.(project_deposit,project_expense)&deleted_at=is.null')
      ]);
      // KPIs (from lightweight allProjTxs)
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
      // Table (from recent 50 with full columns)
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
      document.getElementById('tx-tbl').innerHTML = allTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف', 'الجهة', 'العميل', 'المشروع', 'طريقة الدفع', 'الإجراءات'], allTxs.map(t => {
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
      this.attachSearch('tx-tbl', '🔍 بحث في معاملات المشاريع...');

      // Expenses-only tab with full details
      if (App.txExpenseOffset === 0) App.txExpenseLoaded = projectExpenses;
      else App.txExpenseLoaded = [...App.txExpenseLoaded, ...projectExpenses];
      const totalExpCount = allProjectExpenses.length;
      const displayedExpCount = App.txExpenseLoaded.length;
      const pmLabels = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' };
      const expenseRows = [...App.txExpenseLoaded].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
      const loadMoreBtn = displayedExpCount < totalExpCount
        ? `<div style="margin-top:16px;text-align:center"><button class="btn btn-secondary" onclick="App.loadMoreExpenses()">تحميل المزيد (+${Math.min(App.txExpenseLimit, totalExpCount - displayedExpCount)})</button></div>`
        : '';
      const counterHtml = `<div style="margin-bottom:12px;font-size:13px;color:var(--text2)">عرض ${displayedExpCount} من ${totalExpCount} مصروف</div>`;
      document.getElementById('tx-expenses-tbl').innerHTML = counterHtml + (expenseRows.length ? this.table(['#', 'العميل', 'المشروع', 'المورد', 'القسم', 'البند', 'المبلغ', 'طريقة الدفع', 'المدفوع', 'الباقي', 'التاريخ', 'الإجراءات'], expenseRows.map((t, idx) => {
        const isNew = t.payment_term !== undefined && t.payment_term !== null;
        const paid = isNew ? (+t.paid_amount || 0) : (+t.amount || 0);
        const bal = (+t.amount || 0) - paid;
        const balColor = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--green)' : 'var(--text3)';
        const balLabel = bal > 0 ? 'متبقي' : bal < 0 ? 'زيادة' : 'تسوية';
        const sectionLabel = t.section_name || (t.expense_category === 'design' ? 'تصميم' : 'تشطيب');
        const itemLabel = t.item_name || '-';
        const pmBadge = t.payment_method ? `<span class="badge badge-gray" style="font-size:10px">${pmLabels[t.payment_method] || t.payment_method}</span>` : '-';
        return [idx + 1, t.party_name || '-', t.project_name || '-', t.vendor_name || '-', sectionLabel, itemLabel, this.fmtMoney(t.amount), pmBadge, this.fmtMoney(paid), `<span style="color:${balColor};font-weight:600;font-size:12px">${this.fmtMoney(Math.abs(bal))}</span> <span style="font-size:10px;color:var(--text3)">${balLabel}</span>`, this.fmtDate(t.date || t.created_at), UI.actions(t.id, 'Crud.editTx', 'Crud.delTx')];
      })) : '<p style="color:var(--text3)">لا توجد مصروفات</p>') + loadMoreBtn;
      this.attachSearch('tx-expenses-tbl', '🔍 بحث في المصروفات...');
    } catch (e) {
      console.error(e);
      UI.toast('Transactions load failed: ' + e.message, 'error');
      document.getElementById('tx-tbl').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل المعاملات</p><button class="btn btn-secondary" onclick="App.loadTransactions()">🔄 إعادة المحاولة</button>`;
      document.getElementById('tx-expenses-tbl').innerHTML = '';
    }
  },


  async loadMoreExpenses() {
    App.txExpenseOffset += App.txExpenseLimit;
    await App.loadTransactions();
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف المكتب');
    XLSX.writeFile(wb, `كشف-حساب-المكتب-${new Date().toISOString().slice(0,10)}.xlsx`);
    UI.toast('تم التحميل');
  },

  async loadOffice() {
    try {
      const [incomeTxs, expenseTxs, projects, projectExpenses] = await Promise.all([
        API.request('transactions', 'GET', null, "?select=amount,created_at,type,description,sector_name,employee_name&type=eq.owner_deposit&deleted_at=is.null&order=created_at.desc&limit=200"),
        API.request('transactions', 'GET', null, "?select=amount,created_at,type,description,sector_name,employee_name&type=in.(office_expense,withdrawal)&deleted_at=is.null&order=created_at.desc&limit=200"),
        API.request('projects', 'GET', null, '?select=id,name,client_id,client_name,supervision_percentage,created_at,status&deleted_at=is.null'),
        API.request('transactions', 'GET', null, "?select=amount,project_id,expense_category&type=eq.project_expense&deleted_at=is.null")
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
      this._officeData = allTxs;
      document.getElementById('office-tbl').innerHTML = allTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الموظف', 'التصنيف', 'الوصف', 'الإجراءات'], allTxs.map(t => {
        const badgeColor = ['owner_deposit','supervision'].includes(t.type) ? 'green' : 'red';
        const actions = t.id ? UI.actions(t.id, 'Crud.editTx', 'Crud.delTx') : '-';
        return [this.fmtDate(t.created_at), `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`, this.fmtMoney(t.amount), t.employee_name || '-', t.sector_name || '-', t.description || '-', actions];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      this.attachSearch('office-tbl', '🔍 بحث في معاملات المكتب...');
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
        return [e.name, e.job_title || '-', this.fmtMoney(e.salary), custodyBadge, actions];
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
    const keyStatus = localStorage.getItem('sara_service_key') ? '✅ مخصص (مخزن محلياً)' : '⚠️ افتراضي — غير آمن';
    const settingsHtml = `<div class="card" style="margin-top:16px;border:1px solid var(--red)">
      <h3 style="color:var(--red)">🔐 مفتاح Admin (Service Role)</h3>
      <p style="color:var(--text2);font-size:13px;margin-bottom:12px">للأمان، ضع مفتاح Service Role هنا بدلاً من تركه في الكود. بعد التدوير في Supabase، الصق المفتاح الجديد:</p>
      <div class="form-group"><input type="password" id="settings-service-key" placeholder="الصق مفتاح Service Role الجديد" style="width:100%;max-width:400px" /></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="App.saveServiceKey()">💾 حفظ المفتاح</button>
        <button class="btn btn-red" onclick="App.clearServiceKey()">🗑️ مسح المفتاح</button>
      </div>
      <p style="font-size:12px;margin-top:8px">الحالة: <strong>${keyStatus}</strong></p>
    </div>`;
    const container = document.querySelector('.main-content');
    if (container && !document.getElementById('settings-security-card')) {
      const div = document.createElement('div');
      div.id = 'settings-security-card';
      div.innerHTML = settingsHtml;
      container.appendChild(div);
    }
  },

  async saveServiceKey() {
    let key = document.getElementById('settings-service-key')?.value || '';
    // Clean: remove ALL whitespace including newlines that often sneak in when copying from Supabase UI
    key = key.replace(/\s/g, '');
    if (!key) { UI.toast('Paste the key first', 'error'); return; }
    if (!key.startsWith('eyJ')) { UI.toast('Key looks wrong — Supabase keys start with "eyJ". Make sure you copied the SERVICE_ROLE key, not the anon key.', 'error'); return; }

    UI.toast('Testing key against Supabase...', 'info');
    try {
      const testRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
      });
      if (testRes.status === 401 || testRes.status === 403) {
        UI.toast('Key is INVALID (401/403). Go to Supabase → Project Settings → API → copy the SERVICE_ROLE key (starts with eyJ...), not the anon key.', 'error');
        return;
      }
      if (!testRes.ok) {
        UI.toast(`Key test failed: HTTP ${testRes.status}. Check your internet or Supabase status.`, 'error');
        return;
      }
    } catch (e) {
      UI.toast('Network error testing key. Check your connection.', 'error');
      return;
    }

    localStorage.setItem('sara_service_key', key);
    UI.toast('Key is VALID and saved — reloading now...', 'success');
    setTimeout(() => location.reload(), 1200);
  },

  clearServiceKey() {
    localStorage.removeItem('sara_service_key');
    UI.toast('Key cleared — reloading now...', 'success');
    setTimeout(() => location.reload(), 800);
  },

  async loadUsers() {
    try {
      let authUsers = [];
      let authFailed = false;
      try {
        const authData = await API.authListUsers();
        authUsers = authData.users || [];
      } catch (authErr) {
        authFailed = true;
        console.log('[Users] authListUsers failed:', authErr.message);
      }
      const profiles = await API.request('profiles', 'GET', null, '?select=*&order=created_at.desc');
      const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
      // Build user list from auth first; fallback to profiles only if auth unavailable
      const users = authUsers.length
        ? authUsers.map(u => {
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
          })
        : profiles.map(p => ({
            id: p.id,
            email: p.username || p.id.slice(0, 8),
            name: p.name || p.id.slice(0, 8),
            role: p.role || 'user',
            email_confirmed_at: null,
            created_at: p.created_at
          }));
      let noKeyWarning = '';
      if (authFailed) {
        if (SUPABASE_SERVICE_KEY) {
          noKeyWarning = '<p style="color:var(--text3);font-size:12px;margin-bottom:12px">⚠️ Admin key is INVALID (401). Go to Settings, clear the old key, paste your new SERVICE_ROLE key from Supabase, save, and let it reload.</p>';
        } else {
          noKeyWarning = '<p style="color:var(--text3);font-size:12px;margin-bottom:12px">ℹ️ No admin key stored — showing profiles only. To see auth emails, add your SERVICE_ROLE key in Settings.</p>';
        }
      }
      document.getElementById('users-tbl').innerHTML = noKeyWarning + (users.length ? this.table(['المستخدم', 'الاسم', 'الدور', 'الحالة', 'تاريخ الإنشاء', 'الإجراءات'], users.map(u => [
        Auth.fromEmail(u.email),
        u.name,
        u.role === 'admin' ? '<span class="badge badge-green">مدير</span>' : '<span class="badge badge-gray">موظف</span>',
        u.email_confirmed_at ? '<span class="badge badge-green">مفعل</span>' : '<span class="badge badge-red">غير مفعل</span>',
        this.fmtDate(u.created_at),
        `<button class="btn btn-sm btn-secondary" onclick="Crud.editUser('${u.id}')">تعديل الاسم</button>`
      ])) : '<p style="color:var(--text3)">لا يوجد مستخدمين</p>');
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
      const serviceKey = localStorage.getItem('sara_service_key');
      localStorage.clear();
      sessionStorage.clear();
      if (token) localStorage.setItem('sara_token', token); // preserve login
      if (serviceKey) localStorage.setItem('sara_service_key', serviceKey); // preserve admin key
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
        s.name, s.notes || s.description || '-', UI.actions(s.id, 'Crud.editWorkSection', 'Crud.delWorkSection', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : `<p style="color:var(--text3);padding:16px">لا يوجد أقسام</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addWorkSection()">+ إضافة أول قسم</button>':''}`;
      this.attachSearch('work-sections-tbl', '🔍 بحث في الأقسام...');
      document.getElementById('work-items-tbl').innerHTML = workItems.length ? this.table(['البند', 'القسم', 'ملاحظات', 'الإجراءات'], workItems.map(i => [
        i.name, sectionMap[i.section_id] || '-', i.notes || i.description || '-', UI.actions(i.id, 'Crud.editWorkItem', 'Crud.delWorkItem', Auth.can('master', 'edit'), Auth.can('master', 'delete'))
      ])) : `<p style="color:var(--text3);padding:16px">لا توجد بنود</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addWorkItem()">+ إضافة أول بند</button>':''}`;
      this.attachSearch('work-items-tbl', '🔍 بحث في البنود...');
    } catch (e) {
      console.error(e);
      UI.toast('Master data load failed: ' + e.message, 'error');
      document.getElementById('sectors-tbl').innerHTML = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل البيانات الأساسية</p><button class="btn btn-secondary" onclick="App.loadMasterData()">🔄 إعادة المحاولة</button>`;
    }
  },

});
