// App Reports
Object.assign(App, {
  reportsTab: 'cashflow',
  reportsFrom: '',
  reportsTo: '',
  _reportData: { cashflow: [], pl: [], office: [] },
  _agingData: { clients: [], vendors: [] },

  setReportsTab(tab) {
    this.reportsTab = tab;
    this.go('reports');
  },

  _reportsDateFilterHtml() {
    const today = new Date().toISOString().slice(0, 10);
    const from = this.reportsFrom || today.slice(0, 7) + '-01';
    const to = this.reportsTo || today;
    return `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <label style="font-size:13px">من:</label>
          <input type="date" id="reports-from" value="${from}" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">
          <label style="font-size:13px">إلى:</label>
          <input type="date" id="reports-to" value="${to}" style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit">
          <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('reports-from','reports-to','today')">اليوم</button>
          <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('reports-from','reports-to','this_month')">الشهر الحالي</button>
          <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('reports-from','reports-to','last_month')">الشهر الماضي</button>
          <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('reports-from','reports-to','this_year')">السنة</button>
          <button class="btn btn-primary" onclick="App.loadReports()">تحديث</button>
        </div>
      </div>`;
  },

  _readReportsDates() {
    const fromEl = document.getElementById('reports-from');
    const toEl = document.getElementById('reports-to');
    this.reportsFrom = fromEl ? fromEl.value : '';
    this.reportsTo = toEl ? toEl.value : '';
    return { from: this.reportsFrom, to: this.reportsTo };
  },

  async loadReports() {
    const filterBar = document.getElementById('reports-filter-bar');
    if (filterBar) filterBar.innerHTML = this._reportsDateFilterHtml();
    const { from, to } = this._readReportsDates();

    const content = document.getElementById('reports-content');
    if (!content) return;

    try {
      if (this.reportsTab === 'cashflow') await this._loadCashFlowTab(content, from, to);
      else if (this.reportsTab === 'pl') await this._loadPLTab(content, from, to);
      else if (this.reportsTab === 'office') await this._loadOfficeCashFlowTab(content, from, to);
      else if (this.reportsTab === 'aging') await this._loadAgingTab(content);
    } catch (e) {
      App.loadErrorHtml('reports-content', 'تعذر تحميل التقرير', 'App.loadReports()', e);
    }
  },

  async _loadCashFlowTab(container, from, to) {
    const today = new Date().toISOString().slice(0, 10);
    const start = from || today.slice(0, 7) + '-01';
    const end = to || today;
    const startDate = new Date(start + '-01');
    const monthsBack = Math.max(1, Math.ceil((new Date(today.slice(0, 7) + '-01') - startDate) / (1000 * 60 * 60 * 24 * 30)) + 1);

    let rows = [];
    try {
      rows = await API.rpc('dashboard_monthly_revenue_expenses', { months_back: monthsBack });
    } catch (e) {
      rows = [];
    }

    const chartRows = (rows || [])
      .filter(r => r.month_key >= start.slice(0, 7) && r.month_key <= end.slice(0, 7))
      .reverse()
      .map(r => [
        r.month_key,
        (+r.project_revenue || 0) + (+r.office_revenue || 0),
        (+r.project_expense || 0) + (+r.office_expense || 0)
      ]);
    this._reportData.cashflow = chartRows;

    const totalIncome = chartRows.reduce((s, r) => s + r[1], 0);
    const totalExpense = chartRows.reduce((s, r) => s + r[2], 0);

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">إجمالي الإيرادات</div><div class="kpi-value" style="color:var(--green)">${App.fmtMoney(totalIncome)}</div></div>
        <div class="kpi-card"><div class="kpi-label">إجمالي المصروفات</div><div class="kpi-value" style="color:var(--red)">${App.fmtMoney(totalExpense)}</div></div>
        <div class="kpi-card"><div class="kpi-label">الصافي</div><div class="kpi-value">${App.fmtMoney(totalIncome - totalExpense)}</div></div>
      </div>
      <div class="card" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">الإيرادات vs المصروفات شهريًا</h3><button class="btn btn-sm btn-secondary" onclick="App.exportReportCashFlow()">📥 Excel</button></div>
        ${chartRows.length ? App._renderBar(chartRows, 560, 260) : '<p style="color:var(--text3);padding:16px">لا توجد بيانات في الفترة المحددة</p>'}
      </div>`;
  },

  async _loadPLTab(container, _from, _to) {
    const pbs = await API.request('project_balances', 'GET', null, '?select=*');
    const rows = (pbs || []).map(pb => {
      const profit = (+pb.deposits || 0) - (+pb.expenses || 0) - (+pb.supervision || 0);
      return {
        name: pb.project_name,
        deposits: +pb.deposits || 0,
        expenses: +pb.expenses || 0,
        supervision: +pb.supervision || 0,
        profit
      };
    }).filter(r => r.deposits || r.expenses || r.supervision)
      .sort((a, b) => b.profit - a.profit);
    this._reportData.pl = rows;

    const totalProfit = rows.reduce((s, r) => s + r.profit, 0);

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">إجمالي الربح الصافي</div>
          <div class="kpi-value" style="color:${totalProfit >= 0 ? 'var(--green)' : 'var(--red)'}">${App.fmtMoney(totalProfit)}</div></div>
      </div>
      <div class="card" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">الأرباح والخسائر لكل مشروع</h3><button class="btn btn-sm btn-secondary" onclick="App.exportReportPL()">📥 Excel</button></div>
        ${rows.length ? App.table(
          ['المشروع', 'الإيداعات', 'المصروفات', 'الإشراف', 'الربح'],
          rows.map(r => [
            App.esc(r.name),
            App.fmtMoney(r.deposits),
            App.fmtMoney(r.expenses),
            App.fmtMoney(r.supervision),
            { html: `<span style="color:${r.profit >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${App.fmtMoney(r.profit)}</span>` }
          ])
        ) : '<p style="color:var(--text3);padding:16px">لا توجد مشاريع بها حركة</p>'}
      </div>`;
  },

  async _loadOfficeCashFlowTab(container, from, to) {
    const today = new Date().toISOString().slice(0, 10);
    const start = from || today.slice(0, 7) + '-01';
    const end = to || today;
    const dateQ = `&created_at=gte.${start}T00:00:00&created_at=lte.${end}T23:59:59`;

    const [officeBal, txs] = await Promise.all([
      API.request('office_balance', 'GET', null, '?select=*').catch(() => [{}]),
      API.request('office_transactions_view', 'GET', null, `?select=*${dateQ}&order=created_at.desc&limit=200`).catch(() => [])
    ]);
    const ob = officeBal[0] || {};

    const typeLabels = {
      owner_deposit: 'توريد صاحب المكتب',
      office_expense: 'مصروف مكتبي',
      withdrawal: 'سحب صاحب المكتب',
      income: 'إيراد مكتبي',
      office_income: 'إيراد مكتبي (مورد)',
      supervision: 'إشراف',
      custody_return: 'رد عهدة',
      transfer: 'تحويل'
    };

    const rows = txs.map(t => ({
      date: t.created_at ? new Date(t.created_at).toLocaleDateString('ar-EG') : '-',
      type: typeLabels[t.type] || t.type,
      amount: +t.amount || 0,
      payment_method: t.payment_method || '-',
      party: t.vendor_name || t.employee_name || '-',
      sector: t.sector_name || '-',
      description: t.description || '-'
    }));
    this._reportData.office = rows;

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">الرصيد النقدي</div><div class="kpi-value">${App.fmtMoney(ob.cash_balance || 0)}</div></div>
        <div class="kpi-card"><div class="kpi-label">الرصيد البنكي</div><div class="kpi-value">${App.fmtMoney(ob.bank_balance || 0)}</div></div>
        <div class="kpi-card"><div class="kpi-label">الرصيد الإجمالي</div><div class="kpi-value" style="color:var(--gold)">${App.fmtMoney(ob.total_balance || 0)}</div></div>
      </div>
      <div class="card" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">معاملات المكتب</h3><button class="btn btn-sm btn-secondary" onclick="App.exportReportOffice()">📥 Excel</button></div>
        ${rows.length ? App.table(['التاريخ', 'النوع', 'المبلغ', 'الحساب', 'الجهة', 'التصنيف', 'البيان'], rows.map(r => [
          r.date,
          { html: `<span class="badge badge-${r.type === 'توريد صاحب المكتب' || r.type === 'إيراد مكتبي' || r.type === 'إيراد مكتبي (مورد)' || r.type === 'رد عهدة' ? 'green' : 'red'}">${App.esc(r.type)}</span>` },
          App.fmtMoney(r.amount),
          App.esc(r.payment_method),
          App.esc(r.party),
          App.esc(r.sector),
          App.esc(r.description)
        ])) : '<p style="color:var(--text3);padding:16px">لا توجد معاملات في الفترة المحددة</p>'}
      </div>`;
  },

  exportReportCashFlow() {
    const rows = this._reportData.cashflow || [];
    if (!rows.length) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    const data = [
      ['الشهر', 'الإيرادات', 'المصروفات', 'الصافي'],
      ...rows.map(r => [r[0], r[1], r[2], r[1] - r[2]])
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التدفق النقدي');
    XLSX.writeFile(wb, `تقرير-التدفق-النقدي-${new Date().toISOString().slice(0,10)}.xlsx`);
  },

  exportReportPL() {
    const rows = this._reportData.pl || [];
    if (!rows.length) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    const data = [
      ['المشروع', 'الإيداعات', 'المصروفات', 'الإشراف', 'الربح'],
      ...rows.map(r => [r.name, r.deposits, r.expenses, r.supervision, r.profit])
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأرباح والخسائر');
    XLSX.writeFile(wb, `تقرير-الأرباح-والخسائر-${new Date().toISOString().slice(0,10)}.xlsx`);
  },

  exportReportOffice() {
    const rows = this._reportData.office || [];
    if (!rows.length) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    const data = [
      ['التاريخ', 'النوع', 'المبلغ', 'الحساب', 'الجهة', 'التصنيف', 'البيان'],
      ...rows.map(r => [r.date, r.type, r.amount, r.payment_method, r.party, r.sector, r.description])
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تدفق المكتب');
    XLSX.writeFile(wb, `تقرير-تدفق-المكتب-${new Date().toISOString().slice(0,10)}.xlsx`);
  },

  async _loadAgingTab(container) {
    const [arRows, apRows] = await Promise.all([
      API.request('report_aging_ar', 'GET', null, '?select=*&order=total_due.desc').catch(() => []),
      API.request('report_aging_ap', 'GET', null, '?select=*&order=amount_due.desc').catch(() => [])
    ]);

    const clients = (arRows || []).map(r => ({
      name: r.client_name,
      totalDue: +r.total_due || 0,
      current: +r.bucket_current || 0,
      b1_30: +r.bucket_1_30 || 0,
      b31_60: +r.bucket_31_60 || 0,
      b61_90: +r.bucket_61_90 || 0,
      over90: +r.bucket_over_90 || 0,
      lastDate: r.last_date,
      days: +r.days_overdue || 0
    }));
    const vendors = (apRows || []).map(r => ({
      name: r.vendor_name,
      totalDue: +r.amount_due || 0,
      current: +r.bucket_current || 0,
      b1_30: +r.bucket_1_30 || 0,
      b31_60: +r.bucket_31_60 || 0,
      b61_90: +r.bucket_61_90 || 0,
      over90: +r.bucket_over_90 || 0,
      lastDate: r.last_date,
      days: +r.days_overdue || 0
    }));
    this._agingData = { clients, vendors };

    const arTotals = clients.reduce((s, r) => {
      s.total += r.totalDue; s.current += r.current; s.b1_30 += r.b1_30; s.b31_60 += r.b31_60; s.b61_90 += r.b61_90; s.over90 += r.over90;
      return s;
    }, { total: 0, current: 0, b1_30: 0, b31_60: 0, b61_90: 0, over90: 0 });
    const apTotals = vendors.reduce((s, r) => {
      s.total += r.totalDue; s.current += r.current; s.b1_30 += r.b1_30; s.b31_60 += r.b31_60; s.b61_90 += r.b61_90; s.over90 += r.over90;
      return s;
    }, { total: 0, current: 0, b1_30: 0, b31_60: 0, b61_90: 0, over90: 0 });

    const agingHeaders = ['الجهة', 'المبلغ الإجمالي', 'حالي (≤30)', '31-60', '61-90', '91-120', '+120', 'آخر معاملة', 'أيام التأخير'];
    const fmtRow = r => [
      App.esc(r.name),
      App.fmtMoney(r.totalDue),
      App.fmtMoney(r.current),
      App.fmtMoney(r.b1_30),
      App.fmtMoney(r.b31_60),
      App.fmtMoney(r.b61_90),
      App.fmtMoney(r.over90),
      r.lastDate ? new Date(r.lastDate).toLocaleDateString('ar-EG') : '-',
      r.days || '-'
    ];
    const fmtTotal = t => [
      { html: '<strong>الإجمالي</strong>' },
      { html: `<strong>${App.fmtMoney(t.total)}</strong>` },
      { html: `<strong>${App.fmtMoney(t.current)}</strong>` },
      { html: `<strong>${App.fmtMoney(t.b1_30)}</strong>` },
      { html: `<strong>${App.fmtMoney(t.b31_60)}</strong>` },
      { html: `<strong>${App.fmtMoney(t.b61_90)}</strong>` },
      { html: `<strong>${App.fmtMoney(t.over90)}</strong>` },
      '-', '-'
    ];

    container.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-sm btn-secondary" onclick="App.exportAgingReport()">📥 Excel</button></div>
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">مستحقات العملاء (A/R)</h3></div>
        ${clients.length ? App.table(agingHeaders, [...clients.map(fmtRow), fmtTotal(arTotals)]) : '<p style="color:var(--text3);padding:16px">لا توجد مستحقات عملاء</p>'}
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">مستحقات الموردين (A/P)</h3></div>
        ${vendors.length ? App.table(agingHeaders, [...vendors.map(fmtRow), fmtTotal(apTotals)]) : '<p style="color:var(--text3);padding:16px">لا توجد مستحقات موردين</p>'}
      </div>`;
  },

  exportAgingReport() {
    const { clients, vendors } = this._agingData || {};
    if (!(clients || []).length && !(vendors || []).length) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    const headers = ['الجهة', 'المبلغ الإجمالي', 'حالي (≤30)', '31-60', '61-90', '91-120', '+120', 'آخر معاملة', 'أيام التأخير'];
    const wb = XLSX.utils.book_new();
    if ((clients || []).length) {
      const data = [headers, ...clients.map(r => [
        r.name, r.totalDue, r.current, r.b1_30, r.b31_60, r.b61_90, r.over90,
        r.lastDate ? new Date(r.lastDate).toLocaleDateString('ar-EG') : '-', r.days || '-'
      ])];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, 'مستحقات العملاء');
    }
    if ((vendors || []).length) {
      const data = [headers, ...vendors.map(r => [
        r.name, r.totalDue, r.current, r.b1_30, r.b31_60, r.b61_90, r.over90,
        r.lastDate ? new Date(r.lastDate).toLocaleDateString('ar-EG') : '-', r.days || '-'
      ])];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, 'مستحقات الموردين');
    }
    XLSX.writeFile(wb, `تقرير-المستحقات-${new Date().toISOString().slice(0,10)}.xlsx`);
  }
});
