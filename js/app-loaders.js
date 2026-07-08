// App Screen Loaders
Object.assign(App, {
  // ─── PAGINATION HELPERS ───
  _paginationHtml(table, page, perPage, total, loader) {
    const safeTotal = Number.isFinite(total) ? total : 0;
    const totalPages = Math.max(1, Math.ceil(safeTotal / perPage));
    const loaderName = loader || `load${table.charAt(0).toUpperCase() + table.slice(1)}`;
    const prev = `App.pageState['${table}']=${Math.max(1, page - 1)};App.${loaderName}()`;
    const next = `App.pageState['${table}']=${Math.min(totalPages, page + 1)};App.${loaderName}()`;
    return `<div class="pagination-bar" style="display:flex;justify-content:center;gap:10px;margin-top:16px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" ${page <= 1 ? 'disabled' : ''} onclick="${prev}">← السابق</button>
      <span style="font-size:13px;color:var(--text2)">صفحة ${page} من ${totalPages} (${safeTotal} سجل)</span>
      <button class="btn btn-sm btn-secondary" ${page >= totalPages ? 'disabled' : ''} onclick="${next}">التالي →</button>
    </div>`;
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
    const paths = rows.map(([_label, amt], i) => {
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

  _renderBar(rows, width = 420, height = 220, emptyMsg = 'لا توجد بيانات') {
    if (!rows || !rows.length) return `<p style="color:var(--text3)">${emptyMsg}</p>`;
    const max = Math.max(...rows.map(r => Math.max(+r[1] || 0, +r[2] || 0)));
    if (max <= 0) return `<p style="color:var(--text3)">${emptyMsg}</p>`;
    const padLeft = 44, padRight = 12, padBottom = 44, padTop = 16;
    const chartW = width - padLeft - padRight;
    const chartH = height - padBottom - padTop;
    const groupW = chartW / rows.length;
    const barW = groupW * 0.32;
    const zeroY = padTop + chartH;
    const scale = chartH / max;
    const gridLines = 4;
    let grid = '';
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + chartH - (i * chartH / gridLines);
      const val = Math.round(i * max / gridLines);
      grid += `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--border)" stroke-dasharray="2,2"/>`;
      grid += `<text x="${padLeft - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text3)">${this.fmtMoney(val)}</text>`;
    }
    let bars = '';
    let labels = '';
    rows.forEach((r, i) => {
      const rev = +r[1] || 0;
      const exp = +r[2] || 0;
      const x = padLeft + i * groupW + groupW / 2;
      const revH = rev * scale;
      const expH = exp * scale;
      bars += `<rect x="${x - barW - 1}" y="${zeroY - revH}" width="${barW}" height="${revH}" fill="var(--green)" rx="2"/>`;
      bars += `<rect x="${x + 1}" y="${zeroY - expH}" width="${barW}" height="${expH}" fill="var(--red)" rx="2"/>`;
      labels += `<text x="${x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="var(--text2)">${App.esc(r[0] || '')}</text>`;
      if (rev > 0) bars += `<text x="${x - barW / 2 - 1}" y="${zeroY - revH - 4}" text-anchor="middle" font-size="9" fill="var(--green)">${this.fmtMoney(rev)}</text>`;
      if (exp > 0) bars += `<text x="${x + barW / 2 + 1}" y="${zeroY - expH - 4}" text-anchor="middle" font-size="9" fill="var(--red)">${this.fmtMoney(exp)}</text>`;
    });
    const legend = `<div class="pie-legend"><div class="pie-legend-item"><span class="pie-legend-color" style="background:var(--green)"></span><span>إيرادات</span></div><div class="pie-legend-item"><span class="pie-legend-color" style="background:var(--red)"></span><span>مصروفات</span></div></div>`;
    return `<div class="bar-chart-wrap" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto">${grid}<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${zeroY}" stroke="var(--text3)" stroke-width="1"/>${bars}${labels}</svg>${legend}</div>`;
  },

  // ─── DATA LOADING ───
  async loadDashboard() {
    if (!document.getElementById('kpis')) return;
    const t0 = performance.now();
    try {
      // Server-side aggregation: small, fast RPCs instead of hauling entire tables.
      const [[kpi], vendorBalances, clientBalances, monthly, officeSectors, custodyAlerts] = await Promise.all([
        API.rpc('dashboard_kpis'),
        API.rpc('dashboard_top_vendors', { limit_count: 10 }),
        API.rpc('dashboard_active_client_balances', { limit_count: 10 }),
        API.rpc('dashboard_monthly_revenue_expenses', { months_back: 6 }),
        API.rpc('dashboard_office_expense_sectors'),
        API.request('custody_records', 'GET', null, "?select=*,employees(name)&status=in.(active,partial)&deleted_at=is.null&order=date.desc&limit=10")
      ]);
      const k = kpi || {};
      const netPosition = (+k.total_income || 0) - (+k.total_expense || 0);
      const kpiClick = (screen, html) => `<div class="kpi-card" style="cursor:pointer" onclick="App.go('${screen}')">${html}</div>`;
      document.getElementById('kpis').innerHTML = `
        ${kpiClick('clients', '<div class="kpi-icon">👥</div><div class="kpi-label">العملاء</div><div class="kpi-value">' + (k.client_count || 0) + '</div>')}
        ${kpiClick('clients', '<div class="kpi-icon">📁</div><div class="kpi-label">المشاريع</div><div class="kpi-value">' + (k.project_count || 0) + '</div>')}
        ${kpiClick('clients', '<div class="kpi-icon">✅</div><div class="kpi-label">النشطة</div><div class="kpi-value" style="color:var(--green)">' + (k.active_project_count || 0) + '</div>')}
        ${kpiClick('transactions', '<div class="kpi-icon">💰</div><div class="kpi-label">إجمالي الحركة</div><div class="kpi-value" style="color:var(--gold)">' + this.fmtMoney(k.total_movement || 0) + '</div>')}
        ${kpiClick('office', '<div class="kpi-icon">🏢</div><div class="kpi-label">صافي المركز</div><div class="kpi-value" style="color:' + (netPosition >= 0 ? 'var(--green)' : 'var(--red)') + '">' + this.fmtMoney(netPosition) + '</div>')}`;
      // ─── Office Income vs Expense (Pie Chart) ───
      const officeTotalRows = [
        ['إيرادات مكتب', +k.office_income || 0],
        ['مصروفات مكتب', +k.office_expense || 0]
      ].filter(r => r[1] > 0);
      document.getElementById('office-income-expense-total-chart').innerHTML = this._renderPie(officeTotalRows, 160, 'لا توجد إيرادات أو مصروفات للمكتب');
      // ─── Monthly Project Revenue vs Expense Bar Chart ───
      const projectMonthlyRows = (monthly || []).map(m => [m.month_key, +m.project_revenue || 0, +m.project_expense || 0]).reverse();
      document.getElementById('dash-project-monthly-chart').innerHTML = projectMonthlyRows.length
        ? this._renderBar(projectMonthlyRows, 420, 220)
        : '<p style="color:var(--text3)">لا توجد بيانات شهرية للمشاريع</p>';
      // ─── Monthly Office Revenue vs Expense Bar Chart ───
      const officeMonthlyRows = (monthly || []).map(m => [m.month_key, +m.office_revenue || 0, +m.office_expense || 0]).reverse();
      document.getElementById('dash-office-monthly-chart').innerHTML = officeMonthlyRows.length
        ? this._renderBar(officeMonthlyRows, 420, 220)
        : '<p style="color:var(--text3)">لا توجد بيانات شهرية للمكتب</p>';
      // ─── Office Expense Sectors Pie Chart ───
      const sectorRows = (officeSectors || [])
        .filter(s => (s.amount || 0) > 0)
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 8)
        .map(s => [App.esc(s.sector || '-'), +s.amount || 0]);
      document.getElementById('dash-office-sectors').innerHTML = sectorRows.length
        ? this._renderPie(sectorRows, 160, 'لا توجد مصروفات مكتبية')
        : '<p style="color:var(--text3)">لا توجد مصروفات مكتبية</p>';
      // ─── Vendor balances & alerts (merged) ───
      const vendorRows = (vendorBalances || [])
        .filter(v => (v.balance || 0) > 0)
        .sort((a, b) => (b.balance || 0) - (a.balance || 0))
        .slice(0, 10)
        .map(v => [{html: `<a href="#" onclick="Crud.vendorStatement('${v.vendor_id}');return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(v.vendor_name || '-')}</a>`}, {html: '<span class="badge badge-red">مستحق</span>'}, {html: `<span style="color:var(--red);font-weight:700">${this.fmtMoney(v.balance || 0)}</span>`}]);
      document.getElementById('dash-vendors').innerHTML = vendorRows.length
        ? this.table(['المورد', 'الحالة', 'المبلغ'], vendorRows) + '<div style="text-align:left;margin-top:8px"><a href="#" onclick="App.go(\'vendors\');return false;" style="font-size:12px;color:var(--gold)">عرض كل الموردين →</a></div>'
        : '<p style="color:var(--text3)">لا توجد مستحقات للموردين</p>';
      // ─── Top 10 Active Customer Balances ───
      const clientRows = (clientBalances || [])
        .map(c => [{html: `<a href="#" onclick="Crud.clientStatement('${c.client_id}');return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(c.client_name || '-')}</a>`}, this.fmtMoney(c.deposits || 0), this.fmtMoney(c.expenses || 0), {html: `<span style="color:${(c.balance || 0) >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${this.fmtMoney(c.balance || 0)}</span>`}]);
      document.getElementById('dash-clients').innerHTML = clientRows.length
        ? this.table(['العميل', 'الإيداعات', 'المصروفات', 'الرصيد'], clientRows) + '<div style="text-align:left;margin-top:8px"><a href="#" onclick="App.go(\'clients\');return false;" style="font-size:12px;color:var(--gold)">عرض كل العملاء →</a></div>'
        : '<p style="color:var(--text3)">لا يوجد عملاء نشطون</p>';
      // ─── Custody Alerts ───
      const custodyAlertRows = (custodyAlerts || [])
        .map(r => {
          const remaining = +r.remaining_balance || 0;
          return [{html: `<a href="#" onclick="Crud.custodyExpenses('${r.id}');return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(r.employees?.name || r.employee_name || '-')}</a>`}, this.fmtMoney(r.amount || 0), {html: `<span style="color:var(--red);font-weight:700">${this.fmtMoney(remaining)}</span>`}, {html: `<span class="badge badge-${r.status === 'active' ? 'green' : 'orange'}">${r.status === 'active' ? 'نشطة' : 'جزئي'}</span>`}];
        });
      document.getElementById('dash-custody-alerts').innerHTML = custodyAlertRows.length
        ? this.table(['الموظف', 'المبلغ', 'المتبقي', 'الحالة'], custodyAlertRows)
        : '<p style="color:var(--text3)">لا توجد عهد مفتوحة</p>';
      this._perfLog('loadDashboard', t0);
    } catch (e) {
      UI.toast('Dashboard load failed: ' + e.message, 'error');
      App.loadErrorHtml('kpis', 'تعذر تحميل البيانات', 'App.loadDashboard()', e);
    }
  },

  async loadClients() {
    try {
      const page = this.pageState.clients || 1;
      const limit = this.PAGE_SIZE;
      const offset = (page - 1) * limit;
      const searchTerm = App.searchState.clients || '';
      const searchFilter = App.ilikeOr(['name','phone','address'], searchTerm);
      const [clients, totalClients, clientBalances] = await Promise.all([
        API.request('clients', 'GET', null, `?select=*&deleted_at=is.null${searchFilter}&order=created_at.desc&limit=${limit}&offset=${offset}`),
        API.count('clients', '?deleted_at=is.null' + searchFilter),
        API.request('client_balances', 'GET', null, '?select=*')
      ]);
      const balByClient = Object.fromEntries(clientBalances.map(b => [b.client_id, b]));

      if (!clients.length) {
        document.getElementById('clients-list').innerHTML = `<p style="color:var(--text3);padding:16px">لا يوجد عملاء</p>${Auth.can('clients','add')?'<button class="btn btn-primary" onclick="Crud.addClient()">+ إضافة أول عميل</button>':''}`;
        return;
      }

      const clientIds = clients.map(c => c.id).join(',');
      const [projects, projectBalances] = await Promise.all([
        API.request('projects', 'GET', null, `?select=*&client_id=in.(${clientIds})&deleted_at=is.null&order=created_at.desc`),
        API.request('project_balances', 'GET', null, `?select=*&client_id=in.(${clientIds})`)
      ]);
      const projByClient = {};
      projects.forEach(p => { projByClient[p.client_id] = projByClient[p.client_id] || []; projByClient[p.client_id].push(p); });
      const balByProject = Object.fromEntries(projectBalances.map(b => [b.project_id, b]));

      const html = clients.map(c => {
        const cProjects = projByClient[c.id] || [];
        const cb = balByClient[c.id] || {};
        const clientActions = UI.actions(c.id, 'Crud.editClient', 'Crud.delClient', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.clientStatement('${c.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.addClientReturn('${c.id}')">⬅️ مرتجع</button>`;
        const projRows = cProjects.map(p => {
          const pb = balByProject[p.id] || {};
          const balance = pb.balance || 0;
          const balColor = balance >= 0 ? 'var(--green)' : 'var(--red)';
          const balBadge = `<span style="color:${balColor};font-weight:700;font-size:12px">${this.fmtMoney(balance)}</span>`;
          const pActions = UI.actions(p.id, 'Crud.editProject', 'Crud.delProject', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${p.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.loadProjectTasks('${p.id}')">📋 مهام</button>`;
          return [{html: `<a href="#" onclick="App.go('project',{projectId:'${p.id}'});return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(p.name)}</a>`}, App.esc(p.address || '-'), this.fmtMoney(p.value), this.fmtMoney(pb.expenses || 0), {html: balBadge}, this.fmtMoney(pb.supervision || 0), {html: `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${App.esc(p.status)}</span>`}, {html: pActions}];
        });
        const projTable = cProjects.length ? this.table(['المشروع', 'العنوان', 'القيمة', 'مصروفات', 'الرصيد', 'الإشراف', 'الحالة', 'الإجراءات'], projRows) : '<p style="color:var(--text3);padding:8px 0">لا توجد مشاريع لهذا العميل</p>';
        const clientBalColor = (cb.balance || 0) >= 0 ? 'var(--green)' : 'var(--red)';
        return `<div class="card client-card" style="margin-bottom:16px">
          <div class="client-card-header">
            <div class="client-card-info">
              <h3 style="margin-bottom:4px"><a href="#" onclick="App.go('client',{clientId:'${c.id}'});return false;" style="color:var(--gold);text-decoration:none">${App.esc(c.name)}</a></h3>
              <div class="client-meta">${App.esc(c.phone || '-')} · ${App.esc(c.email || '-')} · ${App.esc(c.address || '-')}</div>
              <div class="client-summary">إيداعات: ${this.fmtMoney(cb.total_deposits || 0)} · مصروفات: ${this.fmtMoney(cb.total_expenses || 0)} · إشراف: ${this.fmtMoney(cb.total_supervision || 0)} · رصيد: <span style="color:${clientBalColor};font-weight:700">${this.fmtMoney(cb.balance || 0)}</span></div>
            </div>
            <div class="client-card-actions">${clientActions}</div>
          </div>
          <div style="margin-bottom:12px"><button class="btn btn-sm btn-secondary" onclick="Crud.addProject('${c.id}')">+ إضافة مشروع</button></div>
          ${projTable}
        </div>`;
      }).join('');
      document.getElementById('clients-list').innerHTML = html + this._paginationHtml('clients', page, limit, totalClients);
      this.attachSearch('clients-list', '🔍 بحث في العملاء أو المشاريع...', (term) => {
        App.searchState.clients = term;
        App.pageState.clients = 1;
        App.loadClients();
      });
      const searchInput = document.getElementById('clients-list-search');
      if (searchInput) searchInput.value = App.searchState.clients || '';
    } catch (e) {
      UI.toast('Clients load failed: ' + e.message, 'error');
      App.loadErrorHtml('clients-list', 'تعذر تحميل العملاء', 'App.loadClients()', e);
    }
  },

  async loadClient(clientId) {
    try {
      const [clientRows, projects, projectBalances] = await Promise.all([
        API.request('clients', 'GET', null, `?select=*&id=eq.${clientId}&deleted_at=is.null`),
        API.request('projects', 'GET', null, `?select=*&client_id=eq.${clientId}&deleted_at=is.null&order=created_at.desc`),
        API.request('project_balances', 'GET', null, `?select=*&client_id=eq.${clientId}`)
      ]);
      const client = clientRows[0];
      if (!client) { document.getElementById('client-detail').innerHTML = '<p style="color:var(--red);padding:16px">⚠️ العميل غير موجود</p>'; return; }

      const balByProject = Object.fromEntries(projectBalances.map(b => [b.project_id, b]));
      const totalProjects = projects.length;
      const totalValue = projectBalances.reduce((s, b) => s + (+b.value || 0), 0);
      const totalDep = projectBalances.reduce((s, b) => s + (+b.deposits || 0), 0);
      const totalExp = projectBalances.reduce((s, b) => s + (+b.expenses || 0), 0);
      const totalSup = projectBalances.reduce((s, b) => s + (+b.supervision || 0), 0);

      const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المشاريع</div><div class="kpi-value">${totalProjects}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي القيم</div><div class="kpi-value">${this.fmtMoney(totalValue)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإيداعات</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(totalDep)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(totalExp)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإشراف</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(totalSup)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الرصيد</div><div class="kpi-value">${this.fmtMoney(totalDep - totalExp - totalSup)}</div></div>
      </div>`;

      const clientActions = UI.actions(client.id, 'Crud.editClient', 'Crud.delClient', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.clientStatement('${client.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.addClientReturn('${client.id}')">⬅️ مرتجع</button>`;
      const projRows = projects.map(p => {
        const pb = balByProject[p.id] || {};
        const balance = pb.balance || 0;
        const balColor = balance >= 0 ? 'var(--green)' : 'var(--red)';
        const balBadge = `<span style="color:${balColor};font-weight:700;font-size:12px">${this.fmtMoney(balance)}</span>`;
        const pActions = UI.actions(p.id, 'Crud.editProject', 'Crud.delProject', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${p.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.loadProjectTasks('${p.id}')">📋 مهام</button>`;
        return [{html: `<a href="#" onclick="App.go('project',{projectId:'${p.id}'});return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(p.name)}</a>`}, App.esc(p.address || '-'), this.fmtMoney(p.value), this.fmtMoney(pb.expenses || 0), {html: balBadge}, this.fmtMoney(pb.supervision || 0), {html: `<span class="badge badge-${p.status === 'active' ? 'green' : 'gray'}">${App.esc(p.status)}</span>`}, {html: pActions}];
      });
      const projTable = projects.length ? this.table(['المشروع', 'العنوان', 'القيمة', 'مصروفات', 'الرصيد', 'الإشراف', 'الحالة', 'الإجراءات'], projRows) : '<p style="color:var(--text3);padding:8px 0">لا توجد مشاريع لهذا العميل</p>';

      const html = `<div class="card client-card" style="margin-bottom:16px">
        <div class="client-card-header">
          <div class="client-card-info">
            <h3 style="margin-bottom:4px">${App.esc(client.name)}</h3>
            <div class="client-meta">${App.esc(client.phone || '-')} · ${App.esc(client.email || '-')} · ${App.esc(client.address || '-')}</div>
          </div>
          <div class="client-card-actions">${clientActions}</div>
        </div>
        <div style="margin-bottom:12px"><button class="btn btn-sm btn-secondary" onclick="Crud.addProject('${client.id}')">+ إضافة مشروع</button></div>
        ${projTable}
      </div>`;

      document.getElementById('client-detail-name').textContent = '👤 ' + client.name;
      document.getElementById('client-detail').innerHTML = summary + html;
      this.attachSearch('client-detail', '🔍 بحث في المشاريع...');
    } catch (e) {
      UI.toast('فشل تحميل تفاصيل العميل: ' + e.message, 'error');
      App.loadErrorHtml('client-detail', 'تعذر تحميل البيانات', `App.loadClient('${clientId}')`, e);
    }
  },

  async loadProject(projectId) {
    try {
      const [projectRows, pbRows, txs, tasks, sectionRates, closes] = await Promise.all([
        API.request('projects', 'GET', null, `?select=*,clients(name)&id=eq.${projectId}&deleted_at=is.null`),
        API.request('project_balances', 'GET', null, `?select=*&project_id=eq.${projectId}`),
        API.request('transactions', 'GET', null, `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=date.desc&limit=100`),
        API.request('project_tasks', 'GET', null, `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=due_date.asc&limit=50`),
        API.request('project_section_supervision', 'GET', null, `?select=section_id,percentage,work_sections(name)&project_id=eq.${projectId}`),
        API.request('project_period_closes', 'GET', null, `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=period_end.desc`)
      ]);
      const project = projectRows[0];
      if (!project) { document.getElementById('project-detail').innerHTML = '<p style="color:var(--red);padding:16px">⚠️ المشروع غير موجود</p>'; return; }

      const pb = pbRows[0] || {};
      const deposits = pb.deposits || 0;
      const expenses = pb.expenses || 0;
      const supervision = pb.supervision || 0;
      const retentionWithheld = pb.retention_withheld || 0;
      const retentionReleased = pb.retention_released || 0;
      const balance = pb.balance || 0;
      const netDeposit = deposits - retentionWithheld + retentionReleased;

      const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">القيمة</div><div class="kpi-value">${this.fmtMoney(project.value)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإيداعات</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(deposits)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإيداعات الصافية</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(netDeposit)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expenses)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإشراف</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(supervision)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">ضمان محجوز</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(retentionWithheld)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">ضمان مُرجع</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(retentionReleased)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الرصيد</div><div class="kpi-value">${this.fmtMoney(balance)}</div></div>
      </div>`;

      const isAdmin = Auth.isAdmin();
      const retentionBtn = (isAdmin || Auth.can('transactions', 'add')) && (+project.retention_percentage || 0) > 0
        ? ` <button class="btn btn-sm btn-secondary" onclick="Crud.releaseRetention('${project.id}', '${project.client_id}', '${App.esc(project.name)}', '${App.esc(project.clients?.name || project.client_name || '')}')">🔓 إرجاع ضمان</button>` : '';
      const closePeriodBtn = isAdmin
        ? ` <button class="btn btn-sm btn-secondary" onclick="Crud.closeProjectPeriod('${project.id}')">🔒 قفل دورة إشراف</button>` : '';
      const actions = UI.actions(project.id, 'Crud.editProject', 'Crud.delProject', Auth.can('clients', 'edit'), Auth.can('clients', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.projectStatement('${project.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.loadProjectTasks('${project.id}')">📋 مهام</button> <button class="btn btn-sm btn-secondary" onclick="Crud.addClientReturn('${project.client_id}', '${project.id}')">⬅️ مرتجع</button>${retentionBtn}${closePeriodBtn}`;
      const ratesHtml = sectionRates.length ? `<div style="margin-bottom:16px"><h4 style="margin:0 0 8px;color:var(--text2)">نسب الإشراف حسب القسم</h4><div style="display:flex;gap:8px;flex-wrap:wrap">` +
        sectionRates.map(r => `<span class="badge badge-gray">${App.esc(r.work_sections?.name || r.section_id)}: ${r.percentage || 0}%</span>`).join('') +
        `</div></div>` : '';
      const info = `<div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <h3 style="margin-bottom:4px">${App.esc(project.name)}</h3>
            <div style="font-size:12px;color:var(--text2)">العميل: <a href="#" onclick="App.go('client',{clientId:'${project.client_id}'});return false;" style="color:var(--gold);text-decoration:none">${App.esc(project.clients?.name || project.client_name || '-')}</a> · ${App.esc(project.address || '-')}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div>
        </div>
        ${ratesHtml}
      </div>`;

      const txRows = txs.map((t, i) => [i+1, t.date || '-', App.fmtTxType(t.type) + (t.system_generated ? ' 🔒' : ''), t.description || '-', this.fmtMoney(t.amount)]);
      const txTable = txRows.length ? '<h4 style="margin:12px 0 8px;color:var(--text2)">💰 المعاملات</h4>' + this.table(['#', 'التاريخ', 'النوع', 'البيان', 'المبلغ'], txRows) : '';
      const closeRows = closes.filter(c => !c.reopened_at).map((c, i) => {
        const reopen = isAdmin ? ` <button class="btn btn-sm btn-red" onclick="Crud.reopenProjectPeriod('${c.id}', '${project.id}')">إعادة فتح</button>` : '';
        return [i+1, c.period_start || '-', c.period_end || '-', this.fmtMoney(c.supervision_transaction_id ? (txs.find(t => t.id === c.supervision_transaction_id)?.amount || 0) : 0), {html: reopen}];
      });
      const closesTable = closeRows.length ? '<h4 style="margin:12px 0 8px;color:var(--text2)">🔒 دورات إشراف مقفلة</h4>' + this.table(['#', 'من', 'إلى', 'إشراف', ''], closeRows) : '';

      const statusBadge = (s) => {
        const colors = { pending: 'gray', in_progress: 'blue', done: 'green' };
        const labels = { pending: 'معلق', in_progress: 'قيد التنفيذ', done: 'منتهي' };
        return `<span class="badge badge-${colors[s] || 'gray'}">${labels[s] || App.esc(s)}</span>`;
      };
      const priorityBadge = (p) => {
        const colors = { low: 'gray', medium: 'orange', high: 'red' };
        const labels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        return `<span class="badge badge-${colors[p] || 'gray'}">${labels[p] || App.esc(p)}</span>`;
      };
      const taskRows = tasks.map((t, i) => [i+1, App.esc(t.name), App.esc(t.assignee || '-'), t.start_date || '-', t.due_date || '-', {html: statusBadge(t.status)}, {html: priorityBadge(t.priority)}]);
      const taskTable = taskRows.length ? '<h4 style="margin:12px 0 8px;color:var(--text2)">📋 المهام</h4>' + this.table(['#', 'المهمة', 'المسؤول', 'تاريخ البدء', 'تاريخ الاستحقاق', 'الحالة', 'الأولوية'], taskRows) : '';

      document.getElementById('project-detail-name').textContent = '🏗️ ' + project.name;
      document.getElementById('project-detail').innerHTML = summary + info + closesTable + txTable + taskTable;
    } catch (e) {
      UI.toast('فشل تحميل تفاصيل المشروع: ' + e.message, 'error');
      App.loadErrorHtml('project-detail', 'تعذر تحميل البيانات', `App.loadProject('${projectId}')`, e);
    }
  },

  async loadVendors() {
    try {
      const page = this.pageState.vendors || 1;
      const limit = this.PAGE_SIZE;
      const offset = (page - 1) * limit;
      const searchTerm = App.searchState.vendors || '';
      const searchFilter = App.ilikeOr(['name','sector','contact_person','phone'], searchTerm);
      const [data, total, vendorBalances] = await Promise.all([
        API.request('vendors', 'GET', null, `?select=*&deleted_at=is.null${searchFilter}&order=created_at.desc&limit=${limit}&offset=${offset}`),
        API.count('vendors', '?deleted_at=is.null' + searchFilter),
        API.request('vendor_balances', 'GET', null, '?select=*')
      ]);
      const balanceMap = Object.fromEntries(vendorBalances.map(b => [b.vendor_id, b]));
      const html = data.length ? this.table(['الاسم', 'النوع', 'التخصص', 'الشخص المسؤول', 'الهاتف', 'الرصيد', 'الإجراءات'], data.map(v => {
        const typeBadge = v.vendor_type === 'merchandise' ? '<span class="badge badge-gold">بضاعة</span>' : '<span class="badge badge-gray">خدمات</span>';
        const officeBadge = v.is_office ? ' <span class="badge badge-blue">مكتب</span>' : '';
        const vb = balanceMap[v.id] || {};
        const balance = vb.balance || 0;
        const balColor = balance > 0 ? 'var(--red)' : balance < 0 ? 'var(--green)' : 'var(--text3)';
        const balLabel = balance > 0 ? 'مستحق' : balance < 0 ? 'زيادة' : 'تسوية';
        const balanceCell = `<span style="color:${balColor};font-weight:700;font-size:12px">${this.fmtMoney(Math.abs(balance))}</span> <span style="font-size:10px;color:var(--text3)">${balLabel}</span>`;
        const actions = UI.actions(v.id, 'Crud.editVendor', 'Crud.delVendor', Auth.can('vendors', 'edit'), Auth.can('vendors', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.vendorStatement('${v.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.vendorPurchases('${v.id}')">💰 مشتريات</button>${Auth.can('transactions','add') ? ` <button class="btn btn-sm btn-secondary" onclick="Crud.addVendorPayment('${v.id}')">💰 دفع</button>` : ''}`;
        return [{html: `<a href="#" onclick="App.go('vendor',{vendorId:'${v.id}'});return false;" style="color:var(--gold);text-decoration:none;font-weight:600">${App.esc(v.name)}</a>${officeBadge}`}, {html: typeBadge}, App.esc(v.sector || '-'), App.esc(v.contact_person || '-'), App.esc(v.phone || '-'), {html: balanceCell}, {html: actions}];
      })) : `<p style="color:var(--text3);padding:16px">لا يوجد موردين</p>${Auth.can('vendors','add')?'<button class="btn btn-primary" onclick="Crud.addVendor()">+ إضافة أول مورد</button>':''}`;
      document.getElementById('vendors-tbl').innerHTML = html + (data.length ? this._paginationHtml('vendors', page, limit, total) : '');
      this.attachSearch('vendors-tbl', '🔍 بحث في الموردين...', (term) => {
        App.searchState.vendors = term;
        App.pageState.vendors = 1;
        App.loadVendors();
      });
      const searchInput = document.getElementById('vendors-tbl-search');
      if (searchInput) searchInput.value = App.searchState.vendors || '';
    } catch (e) {
      UI.toast('Vendors load failed: ' + e.message, 'error');
      App.loadErrorHtml('vendors-tbl', 'تعذر تحميل الموردين', 'App.loadVendors()', e);
    }
  },

  async loadVendor(vendorId) {
    try {
      const [vendorRows, vbRows, txs, procs] = await Promise.all([
        API.request('vendors', 'GET', null, `?select=*&id=eq.${vendorId}&deleted_at=is.null`),
        API.request('vendor_balances', 'GET', null, `?select=*&vendor_id=eq.${vendorId}`),
        API.request('transactions', 'GET', null, `?select=*,projects(name)&vendor_id=eq.${vendorId}&type=eq.project_expense&deleted_at=is.null&order=date.desc&limit=100`),
        API.request('procurements', 'GET', null, `?select=*,projects(name)&vendor_id=eq.${vendorId}&deleted_at=is.null&order=date.desc&limit=100`)
      ]);
      const vendor = vendorRows[0];
      if (!vendor) { document.getElementById('vendor-detail').innerHTML = '<p style="color:var(--red);padding:16px">⚠️ المورد غير موجود</p>'; return; }

      const vb = vbRows[0] || {};
      const totalOwed = vb.total_owed || 0;
      const totalPaid = vb.total_paid || 0;
      const netBalance = vb.balance || 0;

      const balHtml = (bal) => {
        const color = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--green)' : 'var(--text3)';
        const label = bal > 0 ? 'مستحق' : bal < 0 ? 'زيادة' : 'تسوية';
        return `<span style="color:${color};font-weight:700;font-size:12px">${App.fmtMoney(Math.abs(bal))}</span> <span style="font-size:10px;color:var(--text3)">${label}</span>`;
      };

      const txRows = txs.map((t, i) => {
        const isNew = t.payment_term !== undefined && t.payment_term !== null;
        const amount = +t.amount || 0;
        const paid = isNew ? (+t.paid_amount || 0) : amount;
        return [i+1, t.date || '-', App.fmtTxType(t.type), t.projects?.name || t.project_name || '-', t.description || '-', App.fmtMoney(amount), App.fmtMoney(paid), {html: balHtml(amount - paid)}];
      });
      const procRows = procs.map((p, i) => {
        const isNew = p.payment_term !== undefined && p.payment_term !== null;
        const total = +p.total_price || 0;
        const paid = isNew ? (+p.paid_amount || 0) : total;
        return [i+1, p.date || '-', p.item_name || '-', p.quantity || 1, App.fmtMoney(+p.unit_price || 0), App.fmtMoney(total), App.fmtMoney(paid), {html: balHtml(total - paid)}, p.projects?.name || p.project_name || '-'];
      });

      const balColor = netBalance > 0 ? 'var(--red)' : netBalance < 0 ? 'var(--green)' : 'var(--text3)';
      const balLabel = netBalance > 0 ? 'مستحق' : netBalance < 0 ? 'زيادة' : 'تسوية';

      const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي المستحق</div><div class="kpi-value" style="color:var(--red)">${App.fmtMoney(totalOwed)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي المدفوع</div><div class="kpi-value" style="color:var(--green)">${App.fmtMoney(totalPaid)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الرصيد (${balLabel})</div><div class="kpi-value" style="color:${balColor}">${App.fmtMoney(Math.abs(netBalance))}</div></div>
      </div>`;

      const typeBadge = vendor.vendor_type === 'merchandise' ? '<span class="badge badge-gold">بضاعة</span>' : '<span class="badge badge-gray">خدمات</span>';
      const actions = UI.actions(vendor.id, 'Crud.editVendor', 'Crud.delVendor', Auth.can('vendors', 'edit'), Auth.can('vendors', 'delete')) + ` <button class="btn btn-sm btn-primary" onclick="Crud.vendorStatement('${vendor.id}')">كشف حساب</button> <button class="btn btn-sm btn-secondary" onclick="Crud.vendorPurchases('${vendor.id}')">💰 مشتريات</button> <button class="btn btn-sm btn-secondary" onclick="Crud.addVendorPayment('${vendor.id}')">💰 دفع</button>${Auth.can('transactions','add') ? ` <button class="btn btn-sm btn-secondary" onclick="Crud.addVendorSettlement('${vendor.id}')">💰 تسديد لمشروع</button>` : ''}`;
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
      UI.toast('فشل تحميل تفاصيل المورد: ' + e.message, 'error');
      App.loadErrorHtml('vendor-detail', 'تعذر تحميل البيانات', `App.loadVendor('${vendorId}')`, e);
    }
  },

    async loadTransactions() {
    if (!document.getElementById('tx-kpis')) return;
    try {
      const txPage = this.pageState.transactions || 1;
      const txPerPage = 10;

      // KPIs from project_balances view
      const projectBalances = await API.request('project_balances', 'GET', null, '?select=deposits,expenses,supervision,balance,retention_withheld,retention_released');
      const deposits = projectBalances.reduce((s, b) => s + (+b.deposits || 0), 0);
      const expenses = projectBalances.reduce((s, b) => s + (+b.expenses || 0), 0);
      const supervision = projectBalances.reduce((s, b) => s + (+b.supervision || 0), 0);
      const retentionWithheld = projectBalances.reduce((s, b) => s + (+b.retention_withheld || 0), 0);
      const retentionReleased = projectBalances.reduce((s, b) => s + (+b.retention_released || 0), 0);
      const balance = projectBalances.reduce((s, b) => s + (+b.balance || 0), 0);
      document.getElementById('tx-kpis').innerHTML = `
        <div class="kpi-card"><div class="kpi-label">إجمالي الوارد</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(deposits)}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي المصروفات</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(expenses)}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي الإشراف</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(supervision)}</div></div>
        <div class="kpi-card"><div class="kpi-label">ضمان محجوز</div><div class="kpi-value" style="color:var(--red)">${this.fmtMoney(retentionWithheld)}</div></div>
        <div class="kpi-card"><div class="kpi-label">ضمان مُرجع</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(retentionReleased)}</div></div>
        <div class="kpi-card"><div class="kpi-label">رصيد المشروعات</div><div class="kpi-value" style="color:var(--blue)">${this.fmtMoney(balance)}</div></div>`;

      // Main table: server-side paginated project transactions view
      let typeFilter = '';
      if (App.txTypeFilter === 'deposit') typeFilter = '&type=in.(project_deposit,supervision)';
      else if (App.txTypeFilter === 'expense') typeFilter = '&type=eq.project_expense';
      const txOffset = (txPage - 1) * txPerPage;
      const txSearchTerm = App.searchState.transactions || '';
      const txSearchFilter = App.ilikeOr(['description','project_name','vendor_name','party_name'], txSearchTerm);
      const [pagedTxs, totalTxCount] = await Promise.all([
        API.request('project_transactions_view', 'GET', null, `?select=*${typeFilter}${txSearchFilter}&order=created_at.desc&limit=${txPerPage}&offset=${txOffset}`),
        API.count('project_transactions_view', `?select=*${typeFilter}${txSearchFilter}`)
      ]);
      const totalTxPages = Math.max(1, Math.ceil(totalTxCount / txPerPage));
      const safeTxPage = Math.min(Math.max(1, txPage), totalTxPages);
      this.pageState.transactions = safeTxPage;

      const txHtml = pagedTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الوصف', 'الجهة', 'العميل', 'المشروع', 'طريقة الدفع', 'الإجراءات'], pagedTxs.map(t => {
        const badgeColor = t.type === 'project_deposit' ? 'green' : 'red';
        let party;
        if (t.type === 'project_expense') {
          party = App.esc(t.vendor_name || '-');
          if (t.item_name) party += ' <span class="badge badge-gray" style="font-size:10px">' + App.esc(t.item_name) + '</span>';
          else if (t.section_name) party += ' <span class="badge badge-gray" style="font-size:10px">' + App.esc(t.section_name) + '</span>';
          else if (t.expense_category === 'design') party += ' <span class="badge badge-gray" style="font-size:10px">تصميم</span>';
        } else if (t.type === 'supervision') {
          party = '-';
        } else {
          party = App.esc(t.vendor_name || t.employee_name || t.sector_name || '-');
        }
        const clientName = App.esc(t.party_name || '-');
        const pmRaw = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || (t.payment_method || '-');
        const pm = App.esc(pmRaw);
        const termLabels = { immediate: 'فوري', credit: 'اجل', settlement: 'تسديد' };
        let pt = t.payment_method ? `<span class="badge badge-gray" style="font-size:10px">${pm}</span>` : '-';
        if (t.type === 'project_expense') {
          const termRaw = t.payment_term ? (termLabels[t.payment_term] || t.payment_term) : null;
          const termEsc = termRaw ? App.esc(termRaw) : null;
          pt = t.payment_method ? `<span class="badge badge-gray" style="font-size:10px">${pm}</span>` : (termEsc ? `<span class="badge badge-${t.payment_term === 'immediate' ? 'green' : t.payment_term === 'credit' ? 'orange' : 'blue'}" style="font-size:10px">${termEsc}</span>` : '-');
        }
        const paid = t.paid_amount !== undefined && t.paid_amount !== null ? +t.paid_amount : +t.amount;
        const balance = (+t.amount || 0) - paid;
        const balColor = balance > 0 ? 'var(--red)' : balance < 0 ? 'var(--green)' : 'var(--text3)';
        const balLabel = balance > 0 ? 'متبقي' : balance < 0 ? 'زيادة' : 'تسوية';
        const actions = t.type === 'supervision' && !t.id ? '-' : UI.actions(t.id, 'Crud.editTx', 'Crud.delTx');
        const amountCell = {html: `<div style="line-height:1.4"><div>${this.fmtMoney(t.amount)}</div><div style="font-size:10px;color:var(--text3)">مدفوع: ${this.fmtMoney(paid)}</div><div style="font-size:10px;color:${balColor}">${balLabel}: ${this.fmtMoney(Math.abs(balance))}</div></div>`};
        return [this.fmtDate(t.created_at), {html: `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`}, amountCell, App.esc(t.description || '-'), {html: party}, clientName, App.esc(t.project_name || '-'), {html: pt}, {html: actions}];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      document.getElementById('tx-tbl').innerHTML = txHtml + this._paginationHtml('transactions', safeTxPage, txPerPage, totalTxCount);
      this.attachSearch('tx-tbl', '🔍 بحث في معاملات المشاريع...', (term) => {
        App.searchState.transactions = term;
        App.pageState.transactions = 1;
        App.loadTransactions();
      });
      const txSearchInput = document.getElementById('tx-tbl-search');
      if (txSearchInput) txSearchInput.value = App.searchState.transactions || '';
    } catch (e) {
      UI.toast('Transactions load failed: ' + e.message, 'error');
      App.loadErrorHtml('tx-tbl', 'تعذر تحميل المعاملات', 'App.loadTransactions()', e);
    }
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
    if (!document.getElementById('office-kpis')) return;
    try {
      const txPage = this.pageState.officeTransactions || 1;
      const txPerPage = 10;
      const custodyPage = this.pageState.officeCustody || 1;
      const custodyPerPage = 10;

      const txSearchTerm = App.searchState.officeTransactions || '';
      const txSearchFilter = App.ilikeOr(['description','employee_name','sector_name','vendor_name'], txSearchTerm);
      const custodySearchTerm = App.searchState.officeCustody || '';
      const custodySearchFilter = App.ilikeOr(['employees.name','employee_name','sector_name','project_name','notes'], custodySearchTerm);
      const [officeBal, officeTxs, totalOfficeTxs, custodyRecords, totalCustody, custodySumsRaw, officeExpenseRows] = await Promise.all([
        API.request('office_balance', 'GET', null, '?select=*'),
        API.request('office_transactions_view', 'GET', null, `?select=*${txSearchFilter}&order=created_at.desc&limit=${txPerPage}&offset=${(txPage - 1) * txPerPage}`),
        API.count('office_transactions_view', '?select=count' + txSearchFilter),
        API.request('custody_records', 'GET', null, `?select=*,employees(name)&deleted_at=is.null${custodySearchFilter}&order=date.desc&limit=${custodyPerPage}&offset=${(custodyPage - 1) * custodyPerPage}`),
        API.count('custody_records', '?deleted_at=is.null' + custodySearchFilter),
        API.fetchAll('custody_records', '?select=amount,returned_amount,returned_cash_amount&deleted_at=is.null'),
        API.fetchAll('transactions', '?select=amount&type=eq.office_expense&deleted_at=is.null')
      ]);
      const ob = officeBal[0] || {};
      const cashBalance = ob.cash_balance || 0;
      const bankBalance = ob.bank_balance || 0;
      const liquidBalance = ob.liquid_balance || cashBalance + bankBalance;
      const officeBalance = ob.total_balance || 0;
      const totalOfficeExpense = officeExpenseRows.reduce((s, r) => s + (+r.amount || 0), 0);

      const custodySums = (custodySumsRaw || []);
      const totalCustodyAmt = custodySums.reduce((s, r) => s + (+r.amount || 0), 0);
      const totalExpensesAmt = custodySums.reduce((s, r) => s + (+r.returned_amount || 0), 0);
      const totalReturnedCashAmt = custodySums.reduce((s, r) => s + (+r.returned_cash_amount || 0), 0);
      const custodyRemaining = totalCustodyAmt - totalExpensesAmt - totalReturnedCashAmt;

      document.getElementById('office-kpis').innerHTML = `
        <div class="kpi-card" style="border-top:4px solid var(--green)"><div class="kpi-label">رصيد نقدي + بنكي</div><div class="kpi-value" style="color:var(--green)">${this.fmtMoney(liquidBalance)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--gold)"><div class="kpi-label">رصيد المكتب الإجمالي</div><div class="kpi-value" style="color:var(--gold)">${this.fmtMoney(officeBalance)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--red);cursor:pointer" onclick="Crud.addOfficeExpense()" title="إضافة مصروف مكتبي"><div class="kpi-label">➕ مصروف مكتبي</div><div class="kpi-value" style="color:var(--red);font-size:22px">${this.fmtMoney(totalOfficeExpense)}</div></div>
        <div class="kpi-card" style="border-top:4px solid var(--blue)"><div class="kpi-label">العهد النقدية</div><div class="kpi-value" style="color:var(--blue)">${this.fmtMoney(custodyRemaining)}</div><div style="font-size:12px;color:var(--text3);margin-top:6px">إجمالي: ${this.fmtMoney(totalCustodyAmt)} &nbsp;|&nbsp; مصروف: ${this.fmtMoney(totalExpensesAmt)} &nbsp;|&nbsp; مرتجع: ${this.fmtMoney(totalReturnedCashAmt)}</div></div>`;

      const totalTxPages = Math.max(1, Math.ceil((totalOfficeTxs || 0) / txPerPage));
      const safeTxPage = Math.min(Math.max(1, txPage), totalTxPages);
      this.pageState.officeTransactions = safeTxPage;
      this._officeData = officeTxs;
      const pmLabels = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' };
      const txHtml = officeTxs.length ? this.table(['التاريخ', 'النوع', 'المبلغ', 'الحساب', 'المورد / الموظف', 'التصنيف', 'الوصف', 'الإجراءات'], officeTxs.map(t => {
        const badgeColor = t.type === 'owner_deposit' ? 'green' : 'red';
        const actions = t.id ? UI.actions(t.id, 'Crud.editTx', 'Crud.delTx') : '-';
        const party = t.vendor_name || t.employee_name || '-';
        const pmRaw = pmLabels[t.payment_method] || (t.payment_method || 'نقدي');
        const pm = App.esc(pmRaw);
        return [this.fmtDate(t.created_at), {html: `<span class="badge badge-${badgeColor}">${this.fmtTxType(t.type)}</span>`}, this.fmtMoney(t.amount), {html: `<span class="badge badge-gray" style="font-size:10px">${pm}</span>`}, party, t.sector_name || '-', t.description || '-', {html: actions}];
      })) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
      document.getElementById('office-tbl').innerHTML = txHtml + this._paginationHtml('officeTransactions', safeTxPage, txPerPage, totalOfficeTxs);
      this.attachSearch('office-tbl', '🔍 بحث في معاملات المكتب...', (term) => {
        App.searchState.officeTransactions = term;
        App.pageState.officeTransactions = 1;
        App.loadOffice();
      });
      const txSearchInput = document.getElementById('office-tbl-search');
      if (txSearchInput) txSearchInput.value = App.searchState.officeTransactions || '';

      // Custody table
      const totalCustodyPages = Math.max(1, Math.ceil(totalCustody / custodyPerPage));
      const safeCustodyPage = Math.min(Math.max(1, custodyPage), totalCustodyPages);
      this.pageState.officeCustody = safeCustodyPage;
      const statusLabels = { active: 'نشطة', settled: 'مقفلة', partial: 'جزئي' };
      const custodyRows = custodyRecords.map((r, i) => {
        const bal = +r.remaining_balance || 0;
        const balColor = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--green)' : 'var(--text3)';
        const typeBadge = r.custody_type === 'project' ? '<span class="badge badge-blue">مشروع</span>' : '<span class="badge badge-gold">مكتب</span>';
        const related = r.custody_type === 'project' ? (r.project_name || '-') : (r.sector_name || '-');
        return [(safeCustodyPage - 1) * custodyPerPage + i + 1, r.date || '-', {html: typeBadge}, r.employees?.name || r.employee_name || '-', related, this.fmtMoney(r.amount), this.fmtMoney((+r.returned_amount || 0) + (+r.returned_cash_amount || 0)), {html: `<span style="color:${balColor};font-weight:600">${this.fmtMoney(Math.abs(bal))}</span>`}, statusLabels[r.status] || r.status, {html: UI.actions(r.id, 'Crud.editCustody', 'Crud.delCustody') + ` <button class="btn btn-sm btn-secondary" onclick="Crud.custodyExpenses('${r.id}')">مصروفات</button>`}];
      });
      document.getElementById('office-custody-tbl').innerHTML = custodyRows.length ? this.table(['#', 'التاريخ', 'النوع', 'الموظف', 'التصنيف / المشروع', 'المبلغ', 'المسوّى', 'الباقي', 'الحالة', ''], custodyRows) + this._paginationHtml('officeCustody', safeCustodyPage, custodyPerPage, totalCustody) : '<p style="color:var(--text3)">لا توجد عهد نقدية</p>';
      this.attachSearch('office-custody-tbl', '🔍 بحث في العهد النقدية...', (term) => {
        App.searchState.officeCustody = term;
        App.pageState.officeCustody = 1;
        App.loadOffice();
      });
      const custodySearchInput = document.getElementById('office-custody-tbl-search');
      if (custodySearchInput) custodySearchInput.value = App.searchState.officeCustody || '';
    } catch (e) {
      UI.toast('Office load failed: ' + e.message, 'error');
      App.loadErrorHtml('office-kpis', 'تعذر تحميل بيانات المكتب', 'App.loadOffice()', e);
    }
  },

  loadOfficeTransactions() { return this.loadOffice(); },
  loadOfficeCustody() { return this.loadOffice(); },

  async loadEmployees() {
    try {
      const page = this.pageState.employees || 1;
      const limit = this.PAGE_SIZE;
      const offset = (page - 1) * limit;
      const searchTerm = App.searchState.employees || '';
      const searchFilter = App.ilikeOr(['name','job_title'], searchTerm);
      const [data, total] = await Promise.all([
        API.request('employees', 'GET', null, `?select=*&is_active=eq.true&deleted_at=is.null${searchFilter}&order=created_at.desc&limit=${limit}&offset=${offset}`),
        API.count('employees', '?is_active=eq.true&deleted_at=is.null' + searchFilter)
      ]);
      const html = data.length ? this.table(['الاسم', 'الوظيفة', 'الإجراءات'], data.map(e => {
        const actions = UI.actions(e.id, 'Crud.editEmp', 'Crud.delEmp', Auth.can('employees', 'edit'), Auth.can('employees', 'delete')) + ` <button class="btn btn-sm btn-secondary" onclick="Crud.employeeTransactions('${e.id}')">المعاملات</button>`;
        return [App.esc(e.name), App.esc(e.job_title || '-'), {html: actions}];
      })) : `<p style="color:var(--text3);padding:16px">لا يوجد موظفين</p><button class="btn btn-primary" onclick="Crud.addEmp()">+ إضافة أول موظف</button>`;
      document.getElementById('emp-tbl').innerHTML = html + (data.length ? this._paginationHtml('employees', page, limit, total) : '');
      this.attachSearch('emp-tbl', '🔍 بحث في الموظفين...', (term) => {
        App.searchState.employees = term;
        App.pageState.employees = 1;
        App.loadEmployees();
      });
      const searchInput = document.getElementById('emp-tbl-search');
      if (searchInput) searchInput.value = App.searchState.employees || '';
      await this.loadEmpTransactions();
    } catch (e) {
      UI.toast('Employees load failed: ' + e.message, 'error');
      App.loadErrorHtml('emp-tbl', 'تعذر تحميل الموظفين', 'App.loadEmployees()', e);
    }
  },

  async loadEmpTransactions() {
    try {
      const page = this.pageState.empTransactions || 1;
      const limit = this.PAGE_SIZE;
      const offset = (page - 1) * limit;
      const searchTerm = App.searchState.empTransactions || '';
      const searchFilter = App.ilikeOr(['employee_name','notes'], searchTerm);
      const [data, total] = await Promise.all([
        API.request('employee_transactions', 'GET', null, `?select=*,employees(name)&deleted_at=is.null${searchFilter}&order=date.desc&limit=${limit}&offset=${offset}`),
        API.count('employee_transactions', '?deleted_at=is.null' + searchFilter)
      ]);
      const typeLabels = { advance: 'سلفة', penalty: 'جزاء', bonus: 'مكافأة', other: 'أخرى' };
      const typeColors = { advance: 'blue', penalty: 'red', bonus: 'green', other: 'gray' };
      const html = data.length ? this.table(['التاريخ', 'الموظف', 'النوع', 'المبلغ', 'ملاحظات', 'الإجراءات'], data.map(t => [
        t.date || '-',
        App.esc(t.employees?.name || t.employee_name || '-'),
        {html: `<span class="badge badge-${typeColors[t.type] || 'gray'}">${App.esc(typeLabels[t.type] || t.type)}</span>`},
        this.fmtMoney(t.amount),
        App.esc(t.notes || '-'),
        {html: UI.actions(t.id, 'Crud.editEmpTransaction', 'Crud.delEmpTransaction')}
      ])) : '<p style="color:var(--text3);padding:16px">لا توجد معاملات موظفين</p>';
      document.getElementById('emp-tx-tbl').innerHTML = html + (data.length ? this._paginationHtml('empTransactions', page, limit, total) : '');
      this.attachSearch('emp-tx-tbl', '🔍 بحث في معاملات الموظفين...', (term) => {
        App.searchState.empTransactions = term;
        App.pageState.empTransactions = 1;
        App.loadEmpTransactions();
      });
      const searchInput = document.getElementById('emp-tx-tbl-search');
      if (searchInput) searchInput.value = App.searchState.empTransactions || '';
    } catch (e) {
      App.loadErrorHtml('emp-tx-tbl', 'تعذر تحميل المعاملات', 'App.loadEmpTransactions()', e);
    }
  },

  async loadEmpSalaryHistory() {
    try {
      const page = this.pageState.empSalaryHistory || 1;
      const limit = this.PAGE_SIZE;
      const offset = (page - 1) * limit;
      const searchTerm = App.searchState.empSalaryHistory || '';
      const searchFilter = App.ilikeOr(['employee_name','notes'], searchTerm);
      const [data, total] = await Promise.all([
        API.request('employee_salary_history', 'GET', null, `?select=*,employees(name)&deleted_at=is.null${searchFilter}&order=effective_date.desc&limit=${limit}&offset=${offset}`),
        API.count('employee_salary_history', '?deleted_at=is.null' + searchFilter)
      ]);
      const html = data.length ? this.table(['التاريخ', 'الموظف', 'الراتب القديم', 'الراتب الجديد', 'الفرق', 'ملاحظات', 'الإجراءات'], data.map(h => {
        const oldSal = +h.old_salary || 0;
        const newSal = +h.new_salary || 0;
        const diff = newSal - oldSal;
        const diffColor = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text3)';
        return [
          h.effective_date || '-',
          App.esc(h.employees?.name || h.employee_name || '-'),
          this.fmtMoney(oldSal),
          this.fmtMoney(newSal),
          {html: `<span style="color:${diffColor};font-weight:600">${diff > 0 ? '+' : ''}${this.fmtMoney(diff)}</span>`},
          App.esc(h.notes || '-'),
          {html: UI.actions(h.id, 'Crud.editSalaryHistory', 'Crud.delSalaryHistory')}
        ];
      })) : '<p style="color:var(--text3);padding:16px">لا يوجد تاريخ رواتب</p>';
      document.getElementById('emp-salary-history-tbl').innerHTML = html + (data.length ? this._paginationHtml('empSalaryHistory', page, limit, total) : '');
      this.attachSearch('emp-salary-history-tbl', '🔍 بحث في تاريخ الرواتب...', (term) => {
        App.searchState.empSalaryHistory = term;
        App.pageState.empSalaryHistory = 1;
        App.loadEmpSalaryHistory();
      });
      const searchInput = document.getElementById('emp-salary-history-tbl-search');
      if (searchInput) searchInput.value = App.searchState.empSalaryHistory || '';
    } catch (e) {
      App.loadErrorHtml('emp-salary-history-tbl', 'تعذر تحميل تاريخ الرواتب', 'App.loadEmpSalaryHistory()', e);
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
            else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) {
              const [d, m, y] = s.split(/[/-]/);
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
        const checkIn = rawIn ? String(rawIn).trim() : null;
        const checkOut = rawOut ? String(rawOut).trim() : null;
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
        idx + 1, p.rawName, {html: p.matched ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">✗</span>'},
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
      preview.innerHTML = '<p style="color:var(--red)">خطأ في قراءة الملف: ' + App.esc(e.message || '') + '</p>';
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
    } catch (e) { UI.toast('خطأ في الحفظ: ' + e.message, 'error'); }
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
        return map[s] || '<span class="badge badge-gray">' + App.esc(s) + '</span>';
      };
      const rows = employees.map(e => {
        const p = payrollMap[e.id];
        if (!p) return [e.name, App.fmtMoney(e.salary), '-', '-', '-', '-', '-', '-', '-', {html: '<span class="badge badge-gray">غير مولد</span>'}, '-'];
        const actions = p.status === 'draft'
          ? `<button class="btn btn-sm btn-primary" onclick="Crud.editPayroll('${p.id}')">تعديل</button> <button class="btn btn-sm btn-secondary" onclick="Crud.approvePayroll('${p.id}')">اعتماد</button>`
          : p.status === 'approved'
            ? `<button class="btn btn-sm btn-primary" onclick="Crud.payPayroll('${p.id}')">💰 دفع</button> <button class="btn btn-sm btn-secondary" onclick="Crud.editPayroll('${p.id}')">تعديل</button>`
            : `<button class="btn btn-sm btn-secondary" onclick="Crud.editPayroll('${p.id}')">تعديل</button>`;
        const delBtn = `<button class="btn btn-sm btn-red" onclick="Crud.delPayroll('${p.id}')">حذف</button>`;
        return [e.name, App.fmtMoney(p.base_salary), p.days_present, p.days_absent, p.days_late, App.fmtMoney(p.deductions), App.fmtMoney(p.bonuses), App.fmtMoney(p.penalties), App.fmtMoney(p.net_salary), {html: statusBadge(p.status)}, {html: actions + ' ' + delBtn}];
      });
      document.getElementById('emp-payroll-tbl').innerHTML = rows.length ? App.table(['الموظف', 'الراتب الأساسي', 'حاضر', 'غائب', 'متأخر', 'الخصومات', 'المكافآت', 'الجزاءات', 'الصافي', 'الحالة', 'الإجراءات'], rows) : '<p style="color:var(--text3)">لا يوجد بيانات</p>';
    } catch (e) {
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
      const [employees, attendance, empTxs, existingPayrolls] = await Promise.all([
        API.request('employees', 'GET', null, '?select=*&is_active=eq.true&deleted_at=is.null&order=name.asc'),
        API.request('attendance_records', 'GET', null, `?date=gte.${year}-${String(month).padStart(2,'0')}-01&date=lte.${year}-${String(month).padStart(2,'0')}-${lastDay}&deleted_at=is.null`),
        API.request('employee_transactions', 'GET', null, `?date=gte.${year}-${String(month).padStart(2,'0')}-01&date=lte.${year}-${String(month).padStart(2,'0')}-${lastDay}&deleted_at=is.null`),
        API.request('payroll_records', 'GET', null, `?month=eq.${month}&year=eq.${year}&deleted_at=is.null`)
      ]);
      const attByEmp = {};
      attendance.forEach(a => { attByEmp[a.employee_id] = attByEmp[a.employee_id] || []; attByEmp[a.employee_id].push(a); });
      const bonusByEmp = {};
      const penaltyByEmp = {};
      empTxs.forEach(t => {
        if (t.type === 'bonus') bonusByEmp[t.employee_id] = (bonusByEmp[t.employee_id] || 0) + (+t.amount || 0);
        if (t.type === 'penalty') penaltyByEmp[t.employee_id] = (penaltyByEmp[t.employee_id] || 0) + (+t.amount || 0);
      });
      const existingMap = Object.fromEntries(existingPayrolls.map(p => [p.employee_id, p]));
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
      const payrollExpensePayload = (rec) => ({
        type: 'office_expense',
        amount: +rec.net_salary || 0,
        description: `راتب ${rec.employee_name} - ${rec.month}/${rec.year}`,
        employee_id: rec.employee_id || null,
        employee_name: rec.employee_name || null,
        date: `${rec.year}-${String(rec.month).padStart(2, '0')}-01`
      });
      let created = 0, updated = 0, skipped = 0;
      for (const r of records) {
        const existing = existingMap[r.employee_id];
        if (!existing) {
          const inserted = await API.request('payroll_records', 'POST', r);
          const payrollId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
          if (payrollId) {
            try {
              const exp = await API.request('transactions', 'POST', payrollExpensePayload(r));
              const expId = Array.isArray(exp) ? exp[0]?.id : exp?.id;
              if (expId) await API.request('payroll_records', 'PATCH', { office_expense_id: expId }, `?id=eq.${payrollId}`);
            } catch (expErr) { /* link failure is non-fatal; expense stays unlinked */ }
          }
          created++;
        } else if (existing.status === 'draft' || existing.status === 'approved' || existing.status === 'paid') {
          // Regeneration always returns the record to draft so it can be reviewed/edited again.
          await API.request('payroll_records', 'PATCH', { base_salary: r.base_salary, days_present: r.days_present, days_absent: r.days_absent, days_late: r.days_late, days_half: r.days_half, days_leave: r.days_leave, deductions: r.deductions, bonuses: r.bonuses, penalties: r.penalties, net_salary: r.net_salary, status: 'draft' }, `?id=eq.${existing.id}`);
          if (existing.office_expense_id) {
            try {
              await API.request('transactions', 'PATCH', { amount: +r.net_salary || 0, description: `راتب ${r.employee_name} - ${r.month}/${r.year}`, employee_name: r.employee_name || null, date: `${r.year}-${String(r.month).padStart(2, '0')}-01` }, `?id=eq.${existing.office_expense_id}`);
            } catch (expErr) { /* update failure is non-fatal */ }
          } else {
            try {
              const exp = await API.request('transactions', 'POST', payrollExpensePayload(r));
              const expId = Array.isArray(exp) ? exp[0]?.id : exp?.id;
              if (expId) await API.request('payroll_records', 'PATCH', { office_expense_id: expId }, `?id=eq.${existing.id}`);
            } catch (expErr) { /* create failure is non-fatal */ }
          }
          updated++;
        } else {
          skipped++;
        }
      }
      UI.toast(`تم توليد رواتب ${records.length} موظف (جديد ${created} / تحديث ${updated}${skipped ? ` / تخطي ${skipped}` : ''})`);
      this.loadEmpPayroll();
    } catch (e) { UI.toast('خطأ في توليد الرواتب: ' + e.message, 'error'); }
  },

  async loadSettings() {
    await App.loadServerSettings();
    const s = App.settings || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val === null || val === undefined) ? '' : val; };
    setVal('setting-company-name', s.company_name);
    setVal('setting-company-address', s.company_address);
    setVal('setting-company-phone', s.company_phone);
    setVal('setting-company-tax', s.company_tax);
    setVal('setting-default-supervision', s.default_supervision);
    setVal('setting-currency-label', s.currency_label);
    const verEl = document.getElementById('settings-version');
    if (verEl) verEl.textContent = localStorage.getItem('sara_app_version') || '-';
    const backupEl = document.getElementById('settings-last-backup');
    if (backupEl) {
      const last = localStorage.getItem('sara_last_backup');
      backupEl.textContent = last ? new Date(last).toLocaleString('ar-EG') : '-';
    }
  },

  async saveSettings() {
    const form = document.getElementById('settings-form');
    if (!form) return;
    const fd = new FormData(form);
    App.settings.company_name = fd.get('company_name') || 'سارة أبو العلا';
    App.settings.company_address = fd.get('company_address') || '';
    App.settings.company_phone = fd.get('company_phone') || '';
    App.settings.company_tax = fd.get('company_tax') || '';
    App.settings.default_supervision = +fd.get('default_supervision') || 0;
    App.settings.currency_label = fd.get('currency_label') || 'ج.م';
    try {
      await App.saveServerSettings();
      App.saveLocalSettings();
      const msg = document.getElementById('settings-msg');
      if (msg) { msg.textContent = '✅ تم حفظ الإعدادات'; setTimeout(() => msg.textContent = '', 3000); }
      UI.toast('تم حفظ الإعدادات');
    } catch (e) {
      UI.toast('خطأ: ' + (e.message || 'فشل حفظ الإعدادات'), 'error');
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
        email: p.email || '-',
        role: p.role || 'user',
        created_at: p.created_at
      }));
      document.getElementById('users-tbl').innerHTML = users.length ? this.table(['المستخدم', 'الاسم', 'البريد الإلكتروني', 'الدور', 'تاريخ الإنشاء', 'الإجراءات'], users.map(u => [
        App.esc(u.username),
        App.esc(u.name),
        App.esc(u.email),
        {html: u.role === 'admin' ? '<span class="badge badge-green">مدير</span>' : '<span class="badge badge-gray">موظف</span>'},
        this.fmtDate(u.created_at),
        {html: `<button class="btn btn-sm btn-secondary" onclick="Crud.editUser('${u.id}')">تعديل</button>${Auth.isAdmin() ? ` <button class="btn btn-sm btn-red" onclick="Crud.resetUserPassword('${u.id}')">إعادة تعيين كلمة المرور</button>${u.email && u.email.includes('@') ? ` <button class="btn btn-sm btn-primary" onclick="Crud.emailNewPassword('${u.id}','${App.esc(u.email)}')">إرسال كلمة مرور بالبريد</button>` : ''}` : ''}`}
      ])) : '<p style="color:var(--text3)">لا يوجد مستخدمين</p>';
      this.attachSearch('users-tbl', '🔍 بحث في المستخدمين...');
    } catch (e) {
      App.loadErrorHtml('users-tbl', 'خطأ في تحميل المستخدمين', 'App.loadUsers()', e);
    }
  },

  async loadBackup() {
    try {
      const last = localStorage.getItem('sara_last_backup');
      document.getElementById('backup-last').innerHTML = last
        ? `آخر نسخة يدوية: <strong>${new Date(last).toLocaleString('ar-EG')}</strong>`
        : 'لم يتم عمل نسخة يدوية بعد';
      const tables = ['clients','projects','employees','vendors','items','sectors','transactions','procurements','employee_transactions','employee_salary_history','custody_records','custody_expenses','attendance_records','payroll_records','work_sections','work_items','profiles','audit_logs','user_permissions','project_tasks','app_settings'];
      // Check which tables actually exist
      const results = await Promise.all(tables.map(async t => {
        try { await API.request(t, 'GET', null, '?select=id&limit=1'); return { table: t, ok: true }; }
        catch (e) { return { table: t, ok: false }; }
      }));
      const okTables = results.filter(r => r.ok).map(r => r.table);
      const missingTables = results.filter(r => !r.ok).map(r => r.table);
      const statusHtml = `<ul style="list-style:none;padding:0;font-size:13px">${results.map(r => `<li style="padding:4px 0;border-bottom:1px solid var(--border)">${r.ok ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--text3)">○</span>'} ${r.table}.json</li>`).join('')}</ul><p style="font-size:12px;color:var(--text3);margin-top:8px">✓ متاح: ${okTables.length} &nbsp;|&nbsp; ○ غير منشأ بعد: ${missingTables.length}</p>`;
      document.getElementById('backup-status').innerHTML = statusHtml;
    } catch (e) { document.getElementById('backup-status').innerHTML = '<p style="color:var(--red)">خطأ في التحميل</p>'; }
  },

  async _backupToZip(options = {}) {
    const tables = ['clients','projects','employees','vendors','items','sectors','transactions','procurements','employee_transactions','employee_salary_history','custody_records','custody_expenses','attendance_records','payroll_records','work_sections','work_items','profiles','audit_logs','user_permissions','project_tasks','app_settings'];
    const zip = new JSZip();
    const folder = zip.folder('Sara_Backup_' + new Date().toISOString().slice(0,10));
    let version = 'unknown';
    try { version = (await (await fetch('version.json')).json()).version; } catch (e) { /* ignore */ }
    const manifest = { version, timestamp: new Date().toISOString(), counts: {}, source: 'browser', auto: !!options.auto };
    let ok = 0, skip = 0, fail = 0;
    const failed = [];
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    for (const table of tables) {
      try {
        const data = await API.fetchAll(table, '?select=*');
        folder.file(`${table}.json`, JSON.stringify(data, null, 2));
        manifest.counts[table] = data.length;
        ok++;
      } catch (e) {
        const msg = (e?.message || '').toLowerCase();
        const isMissing = msg.includes('does not exist') || msg.includes('relation') || msg.includes('pgrst116');
        manifest.counts[table] = isMissing ? 'missing' : `error: ${e.message}`;
        if (isMissing) {
          skip++;
        } else {
          fail++;
          failed.push(table);
        }
      }
      onProgress({ ok, skip, fail });
    }
    folder.file('manifest.json', JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, manifest, ok, skip, fail, failed };
  },

  async downloadLocalBackup() {
    const progress = document.getElementById('backup-progress');
    progress.innerHTML = '<p style="color:var(--gold)">⏳ جاري جمع البيانات...</p>';
    try {
      const { blob, manifest, ok, skip, fail, failed } = await this._backupToZip({
        onProgress: ({ ok, skip, fail }) => {
          progress.innerHTML = `<p style="color:var(--gold)">⏳ تم ${ok} جداول${skip ? ` (تخطي ${skip})` : ''}${fail ? ` — فشل ${fail}` : ''}...</p>`;
        }
      });
      progress.innerHTML = '<p style="color:var(--gold)">⏳ جاري ضغط الملف...</p>';
      const fileName = `Sara_Backup_${new Date().toISOString().slice(0,10)}_${Date.now()}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      localStorage.setItem('sara_last_backup', new Date().toISOString());
      if (typeof BackupManager !== 'undefined') {
        await BackupManager.logBackup({ manifest, status: fail ? 'partial' : 'success', fileName });
      }
      const skipMsg = skip > 0 ? ` (تم تخطي ${skip} جدول غير منشأ)` : '';
      const failMsg = fail > 0 ? ` <span style="color:var(--red)">(${fail} جدول فشل: ${failed.join(', ')})</span>` : '';
      progress.innerHTML = `<p style="color:${fail ? 'var(--red)' : 'var(--green)'}">${fail ? '⚠️' : '✅'} تم التحميل — ${ok} جدول${skipMsg}${failMsg}</p>`;
      this.loadBackup();
    } catch (e) {
      progress.innerHTML = `<p style="color:var(--red)">⚠️ فشل النسخ الاحتياطي: ${App.esc(e.message)}</p>`;
      if (typeof BackupManager !== 'undefined') {
        await BackupManager.logBackup({ status: 'error', error: e.message });
      }
    }
  },

  // ─── RESTORE FROM BACKUP ───
  _restoreOrder: [
    'app_settings', 'clients', 'employees', 'vendors', 'sectors', 'items',
    'work_sections', 'work_items', 'projects', 'transactions', 'procurements',
    'employee_transactions', 'employee_salary_history', 'custody_records', 'custody_expenses',
    'attendance_records', 'payroll_records', 'project_tasks', 'audit_logs', 'user_permissions', 'profiles'
  ],
  _restoreData: null,

  async previewRestoreBackup() {
    const input = document.getElementById('restore-file');
    const preview = document.getElementById('restore-preview');
    const btn = document.getElementById('restore-btn');
    if (!input || !input.files[0]) { UI.toast('اختر ملف ZIP أولاً', 'error'); return; }
    preview.innerHTML = '<p style="color:var(--gold)">⏳ جاري قراءة الملف...</p>';
    btn.style.display = 'none';
    try {
      const zip = await JSZip.loadAsync(input.files[0]);
      const files = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.json'));
      const data = {};
      for (const f of files) {
        const name = f.name.split('/').pop().replace('.json', '');
        const json = await f.async('string');
        try { data[name] = JSON.parse(json); } catch (e) { data[name] = []; }
      }
      this._restoreData = data;
      const rows = Object.entries(data).map(([table, rows]) => `<tr><td>${App.esc(table)}</td><td>${(Array.isArray(rows) ? rows.length : 0)}</td></tr>`).join('');
      preview.innerHTML = `<table class="data-table"><thead><tr><th>الجدول</th><th>عدد السجلات</th></tr></thead><tbody>${rows}</tbody></table>`;
      btn.style.display = 'inline-block';
    } catch (e) {
      preview.innerHTML = `<p style="color:var(--red)">خطأ في قراءة الملف: ${App.esc(e.message)}</p>`;
    }
  },

  async restoreFromBackup() {
    if (!this._restoreData) { UI.toast('استعرض الملف أولاً', 'error'); return; }
    const progress = document.getElementById('restore-progress');
    const btn = document.getElementById('restore-btn');
    btn.disabled = true;
    progress.innerHTML = '<p style="color:var(--gold)">⏳ جاري الاستعادة...</p>';
    let ok = 0, fail = 0;
    const failTables = [];
    const chunkSize = 100;
    for (const table of this._restoreOrder) {
      const rows = this._restoreData[table];
      if (!Array.isArray(rows) || !rows.length) continue;
      const onConflict = table === 'app_settings' ? 'key' : 'id';
      try {
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          await API.upsert(table, chunk, onConflict);
        }
        ok++;
      } catch (e) {
        fail++;
        failTables.push(`${table}: ${e.message}`);
      }
    }
    btn.disabled = false;
    const failMsg = fail ? ` <br><span style="color:var(--red)">فشل: ${App.esc(failTables.join(' | '))}</span>` : '';
    progress.innerHTML = `<p style="color:${fail ? 'var(--red)' : 'var(--green)'}">${fail ? '⚠️' : '✅'} تم استعادة ${ok} جدول${fail ? ` (فشل ${fail})` : ''}${failMsg}</p>`;
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
    } catch (e) { UI.toast('خطأ في الحفظ: ' + e.message, 'error'); }
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
        {html: `<span style="color:${actionColors[l.action] || 'var(--text)'};font-weight:600">${actionLabels[l.action] || l.action}</span>`},
        (l.record_id || '').slice(0, 8) + '...',
        l.new_data ? JSON.stringify(l.new_data).slice(0, 60) + '...' : '-'
      ])) : '<p style="color:var(--text3)">لا توجد سجلات</p>';
    } catch (e) {
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
      const pageSize = this.PAGE_SIZE;

      // Sectors
      const sectorsPage = this.pageState.masterSectors || 1;
      const sectorsSearch = App.searchState.sectors || '';
      const sectorsFilter = App.ilikeOr(['name'], sectorsSearch);
      const [sectors, totalSectors] = await Promise.all([
        API.request('sectors', 'GET', null, `?select=*&deleted_at=is.null${sectorsFilter}&order=name.asc&limit=${pageSize}&offset=${(sectorsPage - 1) * pageSize}`),
        API.count('sectors', '?deleted_at=is.null' + sectorsFilter)
      ]);
      const totalSectorsPages = Math.max(1, Math.ceil(totalSectors / pageSize));
      const safeSectorsPage = Math.min(Math.max(1, sectorsPage), totalSectorsPages);
      this.pageState.masterSectors = safeSectorsPage;
      document.getElementById('sectors-tbl').innerHTML = sectors.length ? this.table(['التصنيف', 'الوصف', 'الإجراءات'], sectors.map(s => [
        s.name, s.description || '-', {html: UI.actions(s.id, 'Crud.editSector', 'Crud.delSector', Auth.can('master', 'edit'), Auth.can('master', 'delete'))}
      ])) + this._paginationHtml('masterSectors', safeSectorsPage, pageSize, totalSectors, 'loadMasterData') : `<p style="color:var(--text3);padding:16px">لا توجد تصنيفات</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addSector()">+ إضافة أول تصنيف</button>':''}`;
      this.attachSearch('sectors-tbl', '🔍 بحث في التصنيفات...', (term) => {
        App.searchState.sectors = term;
        App.pageState.masterSectors = 1;
        App.loadMasterData();
      });
      const sectorsSearchInput = document.getElementById('sectors-tbl-search');
      if (sectorsSearchInput) sectorsSearchInput.value = App.searchState.sectors || '';

      // Work Sections
      let workSections = [];
      try {
        const wsPage = this.pageState.masterWorkSections || 1;
        const wsSearch = App.searchState.workSections || '';
        const wsFilter = App.ilikeOr(['name'], wsSearch);
        const [wsRows, totalWs] = await Promise.all([
          API.request('work_sections', 'GET', null, `?select=*&deleted_at=is.null${wsFilter}&order=name.asc&limit=${pageSize}&offset=${(wsPage - 1) * pageSize}`),
          API.count('work_sections', '?deleted_at=is.null' + wsFilter)
        ]);
        const totalWsPages = Math.max(1, Math.ceil(totalWs / pageSize));
        const safeWsPage = Math.min(Math.max(1, wsPage), totalWsPages);
        this.pageState.masterWorkSections = safeWsPage;
        workSections = wsRows;
        document.getElementById('work-sections-tbl').innerHTML = workSections.length ? this.table(['القسم', 'ملاحظات', 'الإجراءات'], workSections.map(s => [
          App.esc(s.name), App.esc(s.notes || s.description || '-'), {html: UI.actions(s.id, 'Crud.editWorkSection', 'Crud.delWorkSection', Auth.can('master', 'edit'), Auth.can('master', 'delete'))}
        ])) + this._paginationHtml('masterWorkSections', safeWsPage, pageSize, totalWs, 'loadMasterData') : `<p style="color:var(--text3);padding:16px">لا يوجد أقسام</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addWorkSection()">+ إضافة أول قسم</button>':''}`;
        this.attachSearch('work-sections-tbl', '🔍 بحث في الأقسام...', (term) => {
          App.searchState.workSections = term;
          App.pageState.masterWorkSections = 1;
          App.loadMasterData();
        });
        const wsSearchInput = document.getElementById('work-sections-tbl-search');
        if (wsSearchInput) wsSearchInput.value = App.searchState.workSections || '';
      } catch (e) { /* work_sections may not be created yet */ }

      const sectionMap = Object.fromEntries(workSections.map(s => [s.id, s.name]));

      // Work Items
      try {
        const wiPage = this.pageState.masterWorkItems || 1;
        const wiSearch = App.searchState.workItems || '';
        const wiFilter = App.ilikeOr(['name'], wiSearch);
        const [wiRows, totalWi] = await Promise.all([
          API.request('work_items', 'GET', null, `?select=*&deleted_at=is.null${wiFilter}&order=name.asc&limit=${pageSize}&offset=${(wiPage - 1) * pageSize}`),
          API.count('work_items', '?deleted_at=is.null' + wiFilter)
        ]);
        const totalWiPages = Math.max(1, Math.ceil(totalWi / pageSize));
        const safeWiPage = Math.min(Math.max(1, wiPage), totalWiPages);
        this.pageState.masterWorkItems = safeWiPage;
        document.getElementById('work-items-tbl').innerHTML = wiRows.length ? this.table(['البند', 'القسم', 'ملاحظات', 'الإجراءات'], wiRows.map(i => [
          App.esc(i.name), App.esc(sectionMap[i.section_id] || '-'), App.esc(i.notes || i.description || '-'), {html: UI.actions(i.id, 'Crud.editWorkItem', 'Crud.delWorkItem', Auth.can('master', 'edit'), Auth.can('master', 'delete'))}
        ])) + this._paginationHtml('masterWorkItems', safeWiPage, pageSize, totalWi, 'loadMasterData') : `<p style="color:var(--text3);padding:16px">لا توجد بنود</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addWorkItem()">+ إضافة أول بند</button>':''}`;
        this.attachSearch('work-items-tbl', '🔍 بحث في البنود...', (term) => {
          App.searchState.workItems = term;
          App.pageState.masterWorkItems = 1;
          App.loadMasterData();
        });
        const wiSearchInput = document.getElementById('work-items-tbl-search');
        if (wiSearchInput) wiSearchInput.value = App.searchState.workItems || '';
      } catch (e) { /* work_items may not be created yet */ }

      // Items
      try {
        const itemsPage = this.pageState.masterItems || 1;
        const itemsSearch = App.searchState.items || '';
        const itemsFilter = App.ilikeOr(['name'], itemsSearch);
        const [itemsRows, totalItems] = await Promise.all([
          API.request('items', 'GET', null, `?select=*&deleted_at=is.null${itemsFilter}&order=name.asc&limit=${pageSize}&offset=${(itemsPage - 1) * pageSize}`),
          API.count('items', '?deleted_at=is.null' + itemsFilter)
        ]);
        const totalItemsPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const safeItemsPage = Math.min(Math.max(1, itemsPage), totalItemsPages);
        this.pageState.masterItems = safeItemsPage;
        document.getElementById('items-tbl').innerHTML = itemsRows.length ? this.table(['الصنف', 'المواصفات', 'العلامة', 'الوحدة', 'الإجراءات'], itemsRows.map(i => [
          App.esc(i.name), App.esc(i.specification || '-'), App.esc(i.brand || '-'), App.esc(i.unit || '-'), {html: UI.actions(i.id, 'Crud.editItem', 'Crud.delItem', Auth.can('master', 'edit'), Auth.can('master', 'delete'))}
        ])) + this._paginationHtml('masterItems', safeItemsPage, pageSize, totalItems, 'loadMasterData') : `<p style="color:var(--text3);padding:16px">لا توجد أصناف</p>${Auth.can('master','add')?'<button class="btn btn-primary" onclick="Crud.addItem()">+ إضافة أول صنف</button>':''}`;
        this.attachSearch('items-tbl', '🔍 بحث في الأصناف...', (term) => {
          App.searchState.items = term;
          App.pageState.masterItems = 1;
          App.loadMasterData();
        });
        const itemsSearchInput = document.getElementById('items-tbl-search');
        if (itemsSearchInput) itemsSearchInput.value = App.searchState.items || '';
      } catch (e) { /* items may not be created yet */ }
    } catch (e) {
      UI.toast('Master data load failed: ' + e.message, 'error');
      App.loadErrorHtml('sectors-tbl', 'تعذر تحميل البيانات الأساسية', 'App.loadMasterData()', e);
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
        return `<span class="badge badge-${colors[s] || 'gray'}">${labels[s] || App.esc(s)}</span>`;
      };
      const priorityBadge = (p) => {
        const colors = { low: 'gray', medium: 'orange', high: 'red' };
        const labels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        return `<span class="badge badge-${colors[p] || 'gray'}">${labels[p] || App.esc(p)}</span>`;
      };

      const rows = filtered.map((t, i) => [
        i+1,
        {html: `<a href="#" onclick="App.go('clients');return false;" style="color:var(--gold);text-decoration:none">${App.esc(projectMap[t.project_id] || t.projects?.name || '-')}</a>`},
        App.esc(t.name),
        t.assignee || '-',
        t.start_date || '-',
        t.due_date || '-',
        {html: statusBadge(t.status)},
        {html: priorityBadge(t.priority)},
        {html: `<button class="btn btn-sm btn-secondary" onclick="Crud.editProjectTask('${t.id}')">تعديل</button> <button class="btn btn-sm btn-red" onclick="Crud.delProjectTask('${t.id}')">حذف</button>`}
      ]);

      const table = rows.length ? App.table(['#', 'المشروع', 'المهمة', 'المسؤول', 'تاريخ البدء', 'تاريخ الاستحقاق', 'الحالة', 'الأولوية', 'الإجراءات'], rows) : '<p style="color:var(--text3);padding:16px">لا توجد مهام مسجلة</p>';
      document.getElementById('tasks-tbl').innerHTML = table;
      this.attachSearch('tasks-tbl', '🔍 بحث في المهام...');
    } catch (e) {
      UI.toast('فشل تحميل المهام: ' + e.message, 'error');
      App.loadErrorHtml('tasks-tbl', 'تعذر تحميل المهام', 'App.loadTasks()', e);
    }
  },

});
