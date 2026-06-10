// App Reports
Object.assign(App, {
  async loadAging() {
    try {
      const [clients, projects, transactions, procurements, vendors] = await Promise.all([
        API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('projects', 'GET', null, '?select=id,client_id,supervision_percentage&deleted_at=is.null'),
        API.request('transactions', 'GET', null, '?select=*&deleted_at=is.null'),
        API.request('procurements', 'GET', null, '?select=*&deleted_at=is.null'),
        API.request('vendors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
      ]);

      const projByClient = {};
      projects.forEach(p => { projByClient[p.client_id] = projByClient[p.client_id] || []; projByClient[p.client_id].push(p); });

      const deposits = transactions.filter(t => t.type === 'project_deposit');
      const expenses = transactions.filter(t => t.type === 'project_expense');

      const expByProject = {};
      const designByProject = {};
      const expenseDatesByProject = {};
      expenses.forEach(t => {
        const amt = +t.amount || 0;
        expByProject[t.project_id] = (expByProject[t.project_id] || 0) + amt;
        if (t.expense_category === 'design') {
          designByProject[t.project_id] = (designByProject[t.project_id] || 0) + amt;
        }
        const d = t.date || t.created_at;
        if (d) {
          if (!expenseDatesByProject[t.project_id] || d > expenseDatesByProject[t.project_id]) expenseDatesByProject[t.project_id] = d;
        }
      });

      const depByClient = {};
      const depositDatesByClient = {};
      deposits.forEach(t => {
        depByClient[t.client_id] = (depByClient[t.client_id] || 0) + (+t.amount || 0);
        const d = t.date || t.created_at;
        if (d) {
          if (!depositDatesByClient[t.client_id] || d > depositDatesByClient[t.client_id]) depositDatesByClient[t.client_id] = d;
        }
      });

      const clientRows = clients.map(c => {
        const clientProjects = projByClient[c.id] || [];
        if (!clientProjects.length) return null;
        let totalExp = 0;
        let totalSup = 0;
        let lastDate = depositDatesByClient[c.id] || '';
        clientProjects.forEach(p => {
          const exp = expByProject[p.id] || 0;
          const design = designByProject[p.id] || 0;
          const constr = exp - design;
          totalExp += exp;
          totalSup += constr * (p.supervision_percentage || 0) / 100;
          const pd = expenseDatesByProject[p.id];
          if (pd && pd > lastDate) lastDate = pd;
        });
        const dep = depByClient[c.id] || 0;
        const balance = dep - totalExp - totalSup;
        if (balance >= 0) return null;
        return {
          name: c.name,
          balance,
          lastDate,
          html: [c.name, `<span style="color:var(--red);font-weight:700">${this.fmtMoney(Math.abs(balance))}</span>`, this.fmtDate(lastDate)]
        };
      }).filter(Boolean);

      clientRows.sort((a, b) => a.balance - b.balance);
      const totalReceivable = clientRows.reduce((s, r) => s + Math.abs(r.balance), 0);
      document.getElementById('aging-clients-total').textContent = this.fmtMoney(totalReceivable);
      document.getElementById('aging-clients-tbl').innerHTML = clientRows.length
        ? this.table(['العميل', 'المبلغ المستحق', 'آخر معاملة'], clientRows.map(r => r.html))
        : '<p style="color:var(--text3)">لا توجد مستحقات من العملاء</p>';

      const serviceCostByVendor = {};
      const servicePaidByVendor = {};
      const serviceDatesByVendor = {};
      expenses.forEach(t => {
        if (!t.vendor_id) return;
        const amt = +t.amount || 0;
        const isNew = t.payment_term !== undefined && t.payment_term !== null;
        const paid = isNew ? (+t.paid_amount || 0) : amt;
        serviceCostByVendor[t.vendor_id] = (serviceCostByVendor[t.vendor_id] || 0) + amt;
        servicePaidByVendor[t.vendor_id] = (servicePaidByVendor[t.vendor_id] || 0) + paid;
        const d = t.date || t.created_at;
        if (d) {
          if (!serviceDatesByVendor[t.vendor_id] || d > serviceDatesByVendor[t.vendor_id]) serviceDatesByVendor[t.vendor_id] = d;
        }
      });

      const merchandiseByVendor = {};
      const merchPaidByVendor = {};
      const merchDatesByVendor = {};
      procurements.forEach(p => {
        if (!p.vendor_id) return;
        const amt = +p.total_price || 0;
        const isNew = p.payment_term !== undefined && p.payment_term !== null;
        const paid = isNew ? (+p.paid_amount || 0) : amt;
        merchandiseByVendor[p.vendor_id] = (merchandiseByVendor[p.vendor_id] || 0) + amt;
        merchPaidByVendor[p.vendor_id] = (merchPaidByVendor[p.vendor_id] || 0) + paid;
        const d = p.date || p.created_at;
        if (d) {
          if (!merchDatesByVendor[p.vendor_id] || d > merchDatesByVendor[p.vendor_id]) merchDatesByVendor[p.vendor_id] = d;
        }
      });

      const vendorRows = vendors.map(v => {
        const serviceCost = serviceCostByVendor[v.id] || 0;
        const servicePaid = servicePaidByVendor[v.id] || 0;
        const merchandise = merchandiseByVendor[v.id] || 0;
        const merchPaid = merchPaidByVendor[v.id] || 0;
        const balance = (serviceCost + merchandise) - (servicePaid + merchPaid);
        if (balance <= 0) return null;
        const lastDate = serviceDatesByVendor[v.id] || merchDatesByVendor[v.id] || '';
        return {
          name: v.name,
          balance,
          lastDate,
          html: [v.name, `<span style="color:var(--red);font-weight:700">${this.fmtMoney(balance)}</span>`, this.fmtDate(lastDate)]
        };
      }).filter(Boolean);

      vendorRows.sort((a, b) => b.balance - a.balance);
      const totalPayable = vendorRows.reduce((s, r) => s + r.balance, 0);
      document.getElementById('aging-vendors-total').textContent = this.fmtMoney(totalPayable);
      document.getElementById('aging-vendors-tbl').innerHTML = vendorRows.length
        ? this.table(['المورد', 'المبلغ المستحق', 'آخر معاملة'], vendorRows.map(r => r.html))
        : '<p style="color:var(--text3)">لا توجد مستحقات للموردين</p>';

      this._agingData = { clients: clientRows, vendors: vendorRows };
    } catch (e) {
      console.error(e);
      const err = `<p style="color:var(--red);padding:16px">⚠️ تعذر تحميل البيانات</p><button class="btn btn-secondary" onclick="App.loadAging()">🔄 إعادة المحاولة</button>`;
      document.getElementById('aging-clients-tbl').innerHTML = err;
      document.getElementById('aging-vendors-tbl').innerHTML = err;
    }
  },

  async exportAgingClientsExcel() {
    try {
      const rows = (this._agingData?.clients || []).map(r => [r.name, Math.abs(r.balance), r.lastDate ? new Date(r.lastDate).toLocaleDateString('ar-EG') : '-']);
      const ws = XLSX.utils.aoa_to_sheet([
        ['مستحقات من العملاء'],
        ['العميل', 'المبلغ المستحق', 'آخر معاملة'],
        ...rows
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'مستحقات العملاء');
      XLSX.writeFile(wb, `مستحقات-العملاء-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e) {
      console.error(e);
      UI.toast('خطأ في تصدير Excel: ' + e.message, 'error');
    }
  },

  async exportAgingVendorsExcel() {
    try {
      const rows = (this._agingData?.vendors || []).map(r => [r.name, r.balance, r.lastDate ? new Date(r.lastDate).toLocaleDateString('ar-EG') : '-']);
      const ws = XLSX.utils.aoa_to_sheet([
        ['مستحقات للموردين'],
        ['المورد', 'المبلغ المستحق', 'آخر معاملة'],
        ...rows
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'مستحقات الموردين');
      XLSX.writeFile(wb, `مستحقات-الموردين-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e) {
      console.error(e);
      UI.toast('خطأ في تصدير Excel: ' + e.message, 'error');
    }
  },
});
