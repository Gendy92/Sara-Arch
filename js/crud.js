const Crud = {
  _currentUserId() { return Auth.user?.id || null; },
  _currentUserName() { return Auth.user?.displayName || Auth.fromEmail(Auth.user?.email) || 'unknown'; },

  _extractMissingColumn(msg) {
    if (!msg) return null;
    let m = msg.match(/Could not find the '([^']+)'/);
    if (m) return m[1];
    m = msg.match(/column "([^"]+)" of relation/);
    if (m) return m[1];
    m = msg.match(/column "([^"]+)" does not exist/);
    if (m) return m[1];
    m = msg.match(/unknown column ['"]([^'"]+)['"]/i);
    if (m) return m[1];
    return null;
  },

  _isMissingColumnErr(e) {
    const msg = e?.message || '';
    return msg.includes('PGRST204') || msg.includes('42703') || msg.includes('updated_by') || msg.includes('created_by');
  },

  _stripMissing(payload, missingKey) {
    const clean = Array.isArray(payload) ? payload.map(r => { const c = { ...r }; delete c[missingKey]; return c; }) : { ...payload };
    if (!Array.isArray(payload)) delete clean[missingKey];
    return clean;
  },

  async save(table, data, id) {
    const userId = this._currentUserId();
    const userName = this._currentUserName();
    if (id) {
      let oldData = null;
      try { const existing = await API.request(table, 'GET', null, '?select=*&id=eq.' + id); oldData = existing[0] || null; } catch (e) {}
      let payload = { ...data, updated_by: userId };
      try {
        await API.request(table, 'PATCH', payload, '?id=eq.' + id);
      } catch (e) {
        if (this._isMissingColumnErr(e)) {
          const missing = this._extractMissingColumn(e.message);
          payload = this._stripMissing(payload, missing || 'updated_by');
          try {
            await API.request(table, 'PATCH', payload, '?id=eq.' + id);
          } catch (e2) {
            if (this._isMissingColumnErr(e2)) {
              const missing2 = this._extractMissingColumn(e2.message);
              payload = this._stripMissing(payload, missing2 || 'updated_by');
              await API.request(table, 'PATCH', payload, '?id=eq.' + id);
            } else { throw e2; }
          }
        } else { throw e; }
      }
      this._logAudit(table, id, 'UPDATE', oldData, payload, userId, userName).catch(() => {});
      return { id, ...payload };
    } else {
      let payload = { ...data, created_by: userId };
      let result;
      try {
        result = await API.request(table, 'POST', payload);
      } catch (e) {
        if (this._isMissingColumnErr(e)) {
          const missing = this._extractMissingColumn(e.message);
          payload = this._stripMissing(payload, missing || 'created_by');
          try {
            result = await API.request(table, 'POST', payload);
          } catch (e2) {
            if (this._isMissingColumnErr(e2)) {
              const missing2 = this._extractMissingColumn(e2.message);
              payload = this._stripMissing(payload, missing2 || 'created_by');
              result = await API.request(table, 'POST', payload);
            } else { throw e2; }
          }
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
      const filtered = projects.filter(p => String(p.client_id) === String(clientId));
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

  _setupSectionItemCascade(overlay, sections, items, currentSectionId, currentItemId) {
    const form = overlay.querySelector('form');
    if (!form) return;
    const secSel = form.querySelector('[name="section_id"]');
    const itemSel = form.querySelector('[name="item_id"]');
    if (!secSel || !itemSel) return;

    const allItemOpts = Array.from(itemSel.options).map(o => ({ v: o.value, l: o.textContent }));

    const filterItems = (sectionId) => {
      if (!sectionId) {
        itemSel.innerHTML = '<option value="">-- اختر بند --</option>';
        itemSel.disabled = true;
        return;
      }
      const filtered = items.filter(i => String(i.section_id) === String(sectionId));
      itemSel.innerHTML = '<option value="">-- اختر بند --</option>' + filtered.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
      itemSel.disabled = false;
    };

    if (currentSectionId) {
      filterItems(currentSectionId);
      if (currentItemId) itemSel.value = currentItemId;
    } else {
      itemSel.disabled = true;
    }

    secSel.addEventListener('change', () => {
      filterItems(secSel.value);
    });
  },

  async bulkSave(table, rows) {
    if (!rows || rows.length === 0) throw new Error('لا يوجد بيانات');
    const userId = this._currentUserId();
    let clean = rows.map(r => {
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
        const missing = this._extractMissingColumn(e.message);
        clean = this._stripMissing(clean, missing || 'created_by');
        try {
          result = await API.request(table, 'POST', clean);
        } catch (e2) {
          if (this._isMissingColumnErr(e2)) {
            const missing2 = this._extractMissingColumn(e2.message);
            clean = this._stripMissing(clean, missing2 || 'created_by');
            result = await API.request(table, 'POST', clean);
          } else { throw e2; }
        }
      } else { throw e; }
    }
    this._logAudit(table, null, 'INSERT', null, { count: clean.length }, this._currentUserId(), this._currentUserName()).catch(() => {});
    return result;
  },

  async softDelete(table, id, cascade = false) {
    const userId = this._currentUserId();
    const userName = this._currentUserName();
    // Cascade soft-delete for clients
    if (cascade && table === 'clients') {
      try {
        const now = new Date().toISOString();
        const projects = await API.request('projects', 'GET', null, `?select=id&client_id=eq.${id}&deleted_at=is.null`);
        for (const p of projects) {
          await this.softDelete('projects', p.id, false);
        }
        const txs = await API.request('transactions', 'GET', null, `?select=id&client_id=eq.${id}&deleted_at=is.null`);
        for (const t of txs) {
          await this.softDelete('transactions', t.id, false);
        }
        UI.toast(`🗑️ تم حذف ${projects.length} مشروع و ${txs.length} معاملة مرتبطة`, 'info');
      } catch (e) {
        console.warn('Cascade delete partial failure:', e);
      }
    }
    let payload = { deleted_at: new Date().toISOString(), updated_by: userId };
    try {
      await API.request(table, 'PATCH', payload, '?id=eq.' + id);
    } catch (e) {
      if (this._isMissingColumnErr(e)) {
        const missing = this._extractMissingColumn(e.message);
        payload = this._stripMissing(payload, missing || 'updated_by');
        try {
          await API.request(table, 'PATCH', payload, '?id=eq.' + id);
        } catch (e2) {
          if (this._isMissingColumnErr(e2)) {
            const missing2 = this._extractMissingColumn(e2.message);
            payload = this._stripMissing(payload, missing2 || 'updated_by');
            await API.request(table, 'PATCH', payload, '?id=eq.' + id);
          } else { throw e2; }
        }
      } else { throw e; }
    }
    let oldData = null;
    try { const existing = await API.request(table, 'GET', null, '?select=*&id=eq.' + id); oldData = existing[0] || null; } catch (e) {}
    this._logAudit(table, id, 'DELETE', oldData, { deleted_at: new Date().toISOString() }, userId, userName).catch(() => {});
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
      const existing = await API.request('clients', 'GET', null, '?select=name&deleted_at=is.null');
      const existingNames = new Set(existing.map(c => String(c.name || '').trim().toLowerCase()));
      const dupes = rows.filter(r => existingNames.has(String(r.name || '').trim().toLowerCase()));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} اسماء موجودة مسبقاً: ${dupes.map(d => d.name).join(', ')}`, 'error'); return; }
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
      const newName = String(fd.get('name') || '').trim();
      if (newName.toLowerCase() !== String(rows[0].name || '').trim().toLowerCase()) {
        const existing = await API.request('clients', 'GET', null, `?select=id&name=ilike.${encodeURIComponent(newName)}&deleted_at=is.null`);
        if (existing.length) { UI.toast('⚠️ اسم العميل موجود مسبقاً', 'error'); return; }
      }
      await this.save('clients', { name: fd.get('name'), phone: fd.get('phone') || null, email: fd.get('email') || null, address: fd.get('address') || null, notes: fd.get('notes') || null }, id);
      UI.toast('تم التحديث'); App.loadClients();
    });
  },

  delClient(id) {
    UI.confirm('هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع مشاريعه ومعاملاته المرتبطة.', async () => { await this.softDelete('clients', id, true); UI.toast('تم الحذف مع البيانات المرتبطة'); App.loadClients(); });
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
      const existing = await API.request('projects', 'GET', null, '?select=name,client_id&deleted_at=is.null');
      const dupes = rows.filter(r => existing.some(p => String(p.name || '').trim().toLowerCase() === String(r.name || '').trim().toLowerCase() && String(p.client_id) === String(r.client_id)));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} مشاريع موجودة مسبقاً لنفس العميل`, 'error'); return; }
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
      const newName = String(fd.get('name') || '').trim();
      const newClientId = fd.get('client_id');
      const nameChanged = newName.toLowerCase() !== String(project.name || '').trim().toLowerCase();
      const clientChanged = String(newClientId) !== String(project.client_id);
      if (nameChanged || clientChanged) {
        const existing = await API.request('projects', 'GET', null, `?select=id&name=ilike.${encodeURIComponent(newName)}&client_id=eq.${newClientId}&deleted_at=is.null`);
        if (existing.length) { UI.toast('⚠️ اسم المشروع موجود مسبقاً لهذا العميل', 'error'); return; }
      }
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

    const minDate = deposits.concat(expenses).filter(t => t.date).map(t => t.date).sort()[0] || '';
    const maxDate = new Date().toISOString().slice(0, 10);

    const filterHtml = `<div style="margin-bottom:16px;padding:16px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
      <h3 style="font-size:14px;color:var(--gold);margin-bottom:12px">📅 فلتر التاريخ</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
        <div class="form-group" style="min-width:160px"><label>من</label><input type="date" id="ps-from" value="${minDate}"></div>
        <div class="form-group" style="min-width:160px"><label>إلى</label><input type="date" id="ps-to" value="${maxDate}"></div>
        <button class="btn btn-primary" onclick="Crud.renderProjectStatement('${id}')">تطبيق</button>
        <button class="btn btn-secondary" onclick="Crud.printProjectStatement('${id}')">🖨️ طباعة / PDF</button>
        <button class="btn btn-secondary" onclick="Crud.exportProjectStatement('${id}')">📊 تصدير Excel</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('ps-from','ps-to','today')">اليوم</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('ps-from','ps-to','this_month')">هذا الشهر</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('ps-from','ps-to','last_month')">الشهر الماضي</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('ps-from','ps-to','this_year')">هذا العام</button>
      </div>
    </div>`;

    const reportHtml = `<div id="project-statement-report-${id}"></div>`;
    const logoHtml = `<div class="print-logo" style="display:none;text-align:center;margin-bottom:16px"><img src="logo.png" alt="logo" style="max-height:60px"></div>`;

    const html = logoHtml + filterHtml + reportHtml;
    const overlay = UI.openModal('كشف حساب المشروع — ' + App.esc(project.name), html, null);
    overlay.dataset.projectId = id;
    overlay.dataset.projectName = project.name;
    overlay.dataset.clientName = project.client_name || '';
    overlay.dataset.supervisionPercentage = project.supervision_percentage || 0;
    overlay.dataset.deposits = JSON.stringify(deposits);
    overlay.dataset.expenses = JSON.stringify(expenses);
    this.renderProjectStatement(id);
  },

  renderProjectStatement(id) {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const projectName = overlay.dataset.projectName || '';
    const clientName = overlay.dataset.clientName || '';
    const supervisionPercentage = +overlay.dataset.supervisionPercentage || 0;
    const deposits = JSON.parse(overlay.dataset.deposits || '[]');
    const expenses = JSON.parse(overlay.dataset.expenses || '[]');

    const fromVal = document.getElementById('ps-from')?.value || '';
    const toVal = document.getElementById('ps-to')?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const inRange = (d) => {
      if (!d) return true;
      const date = new Date(d);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const fDeposits = deposits.filter(t => inRange(t.date));
    const fExpenses = expenses.filter(t => inRange(t.date));

    const totalExpenses = fExpenses.reduce((s, t) => s + (+t.amount || 0), 0);
    const designExpenses = fExpenses.filter(t => t.expense_category === 'design');
    const totalDesign = designExpenses.reduce((s, t) => s + (+t.amount || 0), 0);
    const totalConstr = totalExpenses - totalDesign;
    const supervisionAmount = totalConstr * supervisionPercentage / 100;

    const ledger = [];
    fDeposits.forEach(t => {
      const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '';
      ledger.push({ date: t.date || t.created_at, type: 'وارد', in: +t.amount || 0, out: 0, desc: (t.description || 'عربون من العميل') + (pm ? ` (${pm})` : '') });
    });
    fExpenses.filter(t => (t.expense_category || 'construction') !== 'design').forEach(t => ledger.push({ date: t.date || t.created_at, type: 'منصرف', in: 0, out: +t.amount || 0, desc: t.description || '-' }));
    if (designExpenses.length > 0) {
      ledger.push({ date: new Date().toISOString(), type: 'تصنيف', in: 0, out: 0, desc: '<strong>━━ مصروفات تصميم ━━</strong>' });
      designExpenses.forEach(t => ledger.push({ date: t.date || t.created_at, type: 'منصرف تصميم', in: 0, out: +t.amount || 0, desc: t.description || '-' }));
    }
    ledger.push({ date: new Date().toISOString(), type: 'إشراف', in: 0, out: supervisionAmount, desc: `إشراف ${projectName} (${supervisionPercentage}%)` });
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));
    let balance = 0;
    const rows = ledger.map(r => {
      balance += r.in - r.out;
      return [App.fmtDate(r.date), r.type, App.fmtMoney(r.in), App.fmtMoney(r.out), App.fmtMoney(balance), r.desc];
    });
    const totalIn = ledger.reduce((s, r) => s + r.in, 0);
    const totalOut = ledger.reduce((s, r) => s + r.out, 0);
    rows.push(['', '<strong>الإجمالي</strong>', `<strong>${App.fmtMoney(totalIn)}</strong>`, `<strong>${App.fmtMoney(totalOut)}</strong>`, `<strong>${App.fmtMoney(balance)}</strong>`, '']);

    const pmLabels = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' };
    const expenseDetailRows = fExpenses.sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at)).map((t, idx) => {
      const isNew = t.payment_term !== undefined && t.payment_term !== null;
      const paid = isNew ? (+t.paid_amount || 0) : (+t.amount || 0);
      const bal = (+t.amount || 0) - paid;
      const balColor = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--green)' : 'var(--text3)';
      const balLabel = bal > 0 ? 'متبقي' : bal < 0 ? 'زيادة' : 'تسوية';
      const sectionLabel = t.section_name || (t.expense_category === 'design' ? 'تصميم' : 'تشطيب');
      const itemLabel = t.item_name || '-';
      const pmBadge = t.payment_method ? `<span class="badge badge-gray" style="font-size:10px">${pmLabels[t.payment_method] || t.payment_method}</span>` : '-';
      return [idx + 1, sectionLabel, itemLabel, App.fmtMoney(t.amount), pmBadge, App.fmtMoney(paid), `<span style="color:${balColor};font-weight:600;font-size:12px">${App.fmtMoney(Math.abs(bal))}</span> <span style="font-size:10px;color:var(--text3)">${balLabel}</span>`, App.fmtDate(t.date || t.created_at), t.description || '-'];
    });
    const expenseDetailHtml = expenseDetailRows.length ? `<div style="margin-top:24px"><h3 style="font-size:15px;color:var(--gold);margin-bottom:14px">📋 تفاصيل المصروفات</h3>${App.table(['#', 'القسم', 'البند', 'المبلغ', 'طريقة الدفع', 'المدفوع', 'الباقي', 'التاريخ', 'البيان'], expenseDetailRows)}</div>` : '';

    let html = `<div style="margin-bottom:16px">
      <strong>المشروع:</strong> ${App.esc(projectName)}<br>
      <strong>العميل:</strong> ${clientName || '-'}<br>
      <strong>الفترة:</strong> ${fromVal || '—'} → ${toVal || '—'}<br>
      <strong>نسبة الإشراف:</strong> ${supervisionPercentage}%<br>
      <strong>إجمالي الوارد:</strong> ${App.fmtMoney(totalIn)}<br>
      <strong>إجمالي المنصرف:</strong> ${App.fmtMoney(totalExpenses)}<br>
      <strong>إشراف:</strong> ${App.fmtMoney(supervisionAmount)}<br>
      <strong style="color:var(--gold)">رصيد العميل:</strong> ${App.fmtMoney(balance)}
    </div>
    ${App.table(['التاريخ', 'النوع', 'وارد', 'منصرف', 'رصيد العميل', 'البيان'], rows)}${expenseDetailHtml}`;

    const reportEl = document.getElementById(`project-statement-report-${id}`);
    if (reportEl) reportEl.innerHTML = html;
  },

  printProjectStatement(id) {
    const overlay = document.querySelector('.modal-overlay');
    const clientName = overlay?.dataset.clientName || '';
    const projectName = overlay?.dataset.projectName || '';
    const fromVal = document.getElementById('ps-from')?.value || '';
    const toVal = document.getElementById('ps-to')?.value || '';
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    const dateStr = fromVal && toVal ? `${fromVal}_to_${toVal}` : new Date().toISOString().slice(0, 10);
    App.printReport(`كشف-حساب-${safe(clientName)}-${safe(projectName)}-${dateStr}`);
  },

  exportProjectStatement(id) {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const projectName = overlay.dataset.projectName || '';
    const clientName = overlay.dataset.clientName || '';
    const supervisionPercentage = +overlay.dataset.supervisionPercentage || 0;
    const deposits = JSON.parse(overlay.dataset.deposits || '[]');
    const expenses = JSON.parse(overlay.dataset.expenses || '[]');
    const fromVal = document.getElementById('ps-from')?.value || '';
    const toVal = document.getElementById('ps-to')?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const inRange = (d) => {
      if (!d) return true;
      const date = new Date(d);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const fDeposits = deposits.filter(t => inRange(t.date));
    const fExpenses = expenses.filter(t => inRange(t.date));

    const rows = [];
    fDeposits.forEach(t => rows.push({ date: t.date || t.created_at, type: 'وارد', amount: +t.amount || 0, description: t.description || 'عربون' }));
    fExpenses.forEach(t => {
      const type = t.expense_category === 'design' ? 'مصروف تصميم' : 'مصروف تشطيب';
      rows.push({ date: t.date || t.created_at, type, amount: +t.amount || 0, description: t.description || '-' });
    });
    const constr = fExpenses.filter(t => (t.expense_category || 'construction') !== 'design').reduce((s, t) => s + (+t.amount || 0), 0);
    const sup = constr * supervisionPercentage / 100;
    if (sup > 0) rows.push({ date: '', type: 'إشراف', amount: sup, description: `إشراف ${projectName}` });

    rows.sort((a, b) => new Date(a.date || '1970-01-01') - new Date(b.date || '1970-01-01'));

    const ws = XLSX.utils.aoa_to_sheet([
      ['التاريخ', 'النوع', 'المبلغ', 'البيان'],
      ...rows.map(r => [r.date, r.type, r.amount, r.description])
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب المشروع');
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    const dateStr = fromVal && toVal ? `${fromVal}_to_${toVal}` : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `كشف-حساب-${safe(clientName)}-${safe(projectName)}-${dateStr}.xlsx`);
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
    UI.openModal('📊 ميزانية المشروع — ' + App.esc(project.name), html, null);
  },

  // ─── PROJECT TASKS ───
  async loadProjectTasks(projectId) {
    try {
      const [projectRows, tasks] = await Promise.all([
        API.request('projects', 'GET', null, `?select=*&id=eq.${projectId}`),
        API.request('project_tasks', 'GET', null, `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=created_at.desc`)
      ]);
      if (!projectRows.length) return;
      const project = projectRows[0];
      const statusColors = { pending: 'gray', in_progress: 'gold', done: 'green' };
      const statusLabels = { pending: 'معلق', in_progress: 'قيد التنفيذ', done: 'منتهي' };
      const priorityColors = { low: 'green', medium: 'gold', high: 'red' };
      const priorityLabels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
      const taskRows = tasks.map(t => [
        t.name,
        t.assignee || '-',
        `<span class="badge badge-${statusColors[t.status] || 'gray'}">${statusLabels[t.status] || t.status}</span>`,
        `<span class="badge badge-${priorityColors[t.priority] || 'gray'}">${priorityLabels[t.priority] || t.priority}</span>`,
        App.fmtDate(t.start_date),
        App.fmtDate(t.end_date),
        t.notes || '-',
        UI.actions(t.id, 'Crud.editProjectTask', 'Crud.delProjectTask')
      ]);
      const html = `<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="Crud.addProjectTask('${projectId}')">+ إضافة مهمة</button></div>${tasks.length ? App.table(['المهمة', 'المسؤول', 'الحالة', 'الأولوية', 'تاريخ البدء', 'تاريخ الانتهاء', 'ملاحظات', 'الإجراءات'], taskRows) : '<p style="color:var(--text3)">لا توجد مهام لهذا المشروع</p>'}`;
      UI.openModal('📋 مهام المشروع — ' + App.esc(project.name), html, null);
    } catch (e) {
      console.error(e);
      UI.toast('خطأ في تحميل المهام: ' + e.message, 'error');
    }
  },

  async addProjectTask(projectId) {
    const projects = await API.request('projects', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc');
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name }));
    const fields = [
      { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { name: 'name', label: 'اسم المهمة', req: true },
      { name: 'assignee', label: 'المسؤول' },
      { name: 'start_date', label: 'تاريخ البدء', type: 'date' },
      { name: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
      { name: 'status', label: 'الحالة', type: 'select', opts: [{ v: 'pending', l: 'معلق' }, { v: 'in_progress', l: 'قيد التنفيذ' }, { v: 'done', l: 'منتهي' }] },
      { name: 'priority', label: 'الأولوية', type: 'select', opts: [{ v: 'low', l: 'منخفض' }, { v: 'medium', l: 'متوسط' }, { v: 'high', l: 'عالي' }] },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('إضافة مهمة', `<form>${UI.form(fields, { project_id: projectId || '', status: 'pending', priority: 'medium' })}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('project_tasks', {
          project_id: fd.get('project_id'),
          name: fd.get('name'),
          assignee: fd.get('assignee') || null,
          start_date: fd.get('start_date') || null,
          end_date: fd.get('end_date') || null,
          status: fd.get('status') || 'pending',
          priority: fd.get('priority') || 'medium',
          notes: fd.get('notes') || null
        });
        UI.toast('تمت الإضافة');
        Crud.loadProjectTasks(fd.get('project_id'));
      } catch (e) {
        if (e.message && (e.message.includes('project_tasks') || e.message.includes('does not exist'))) {
          UI.toast('جدول المهام غير موجود. شغّل schema.sql في Supabase.', 'error');
        } else {
          throw e;
        }
      }
    });
  },

  async editProjectTask(id) {
    const rows = await API.request('project_tasks', 'GET', null, `?select=*&id=eq.${id}`);
    if (!rows.length) return;
    const task = rows[0];
    const projects = await API.request('projects', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc');
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name }));
    const fields = [
      { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { name: 'name', label: 'اسم المهمة', req: true },
      { name: 'assignee', label: 'المسؤول' },
      { name: 'start_date', label: 'تاريخ البدء', type: 'date' },
      { name: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
      { name: 'status', label: 'الحالة', type: 'select', opts: [{ v: 'pending', l: 'معلق' }, { v: 'in_progress', l: 'قيد التنفيذ' }, { v: 'done', l: 'منتهي' }] },
      { name: 'priority', label: 'الأولوية', type: 'select', opts: [{ v: 'low', l: 'منخفض' }, { v: 'medium', l: 'متوسط' }, { v: 'high', l: 'عالي' }] },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل مهمة', `<form>${UI.form(fields, { ...task, project_id: task.project_id || '' })}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('project_tasks', {
        project_id: fd.get('project_id'),
        name: fd.get('name'),
        assignee: fd.get('assignee') || null,
        start_date: fd.get('start_date') || null,
        end_date: fd.get('end_date') || null,
        status: fd.get('status') || 'pending',
        priority: fd.get('priority') || 'medium',
        notes: fd.get('notes') || null
      }, id);
      UI.toast('تم التحديث');
      Crud.loadProjectTasks(fd.get('project_id'));
    });
  },

  delProjectTask(id) {
    UI.confirm('هل أنت متأكد من حذف هذه المهمة؟', async () => {
      await this.softDelete('project_tasks', id);
      UI.toast('تم الحذف');
    });
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

    const minDate = deposits.concat(expenses).filter(t => t.date).map(t => t.date).sort()[0] || '';
    const maxDate = new Date().toISOString().slice(0, 10);

    const filterHtml = `<div style="margin-bottom:16px;padding:16px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
      <h3 style="font-size:14px;color:var(--gold);margin-bottom:12px">📅 فلتر التاريخ</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
        <div class="form-group" style="min-width:160px"><label>من</label><input type="date" id="cs-from" value="${minDate}"></div>
        <div class="form-group" style="min-width:160px"><label>إلى</label><input type="date" id="cs-to" value="${maxDate}"></div>
        <button class="btn btn-primary" onclick="Crud.renderClientStatement()">تطبيق</button>
        <button class="btn btn-secondary" onclick="Crud.printClientStatement()">🖨️ طباعة / PDF</button>
        <button class="btn btn-secondary" onclick="Crud.exportClientStatement()">📊 تصدير Excel</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('cs-from','cs-to','today')">اليوم</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('cs-from','cs-to','this_month')">هذا الشهر</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('cs-from','cs-to','last_month')">الشهر الماضي</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('cs-from','cs-to','this_year')">هذا العام</button>
      </div>
    </div>`;

    const reportHtml = `<div id="client-statement-report"></div>`;
    const logoHtml = `<div class="print-logo" style="display:none;text-align:center;margin-bottom:16px"><img src="logo.png" alt="logo" style="max-height:60px"></div>`;

    const html = logoHtml + filterHtml + reportHtml;
    const overlay = UI.openModal('كشف حساب العميل — ' + App.esc(client.name), html, null);
    overlay.dataset.clientId = id;
    overlay.dataset.clientName = client.name;
    overlay.dataset.projects = JSON.stringify(projects);
    overlay.dataset.deposits = JSON.stringify(deposits);
    overlay.dataset.expenses = JSON.stringify(expenses);
    this.renderClientStatement();
  },

  renderClientStatement() {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const clientName = overlay.dataset.clientName || '';
    const projects = JSON.parse(overlay.dataset.projects || '[]');
    const deposits = JSON.parse(overlay.dataset.deposits || '[]');
    const expenses = JSON.parse(overlay.dataset.expenses || '[]');

    const fromVal = document.getElementById('cs-from')?.value || '';
    const toVal = document.getElementById('cs-to')?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const inRange = (d) => {
      if (!d) return true;
      const date = new Date(d);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const projIds = projects.map(p => p.id);
    const clientDeposits = deposits.filter(t => projIds.includes(t.project_id) && inRange(t.date));
    const clientExpenses = expenses.filter(t => projIds.includes(t.project_id) && inRange(t.date));
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

    let html = `<div style="margin-bottom:20px;padding:16px;background:linear-gradient(135deg,var(--bg3),var(--bg));border-radius:var(--radius);border:1px solid var(--border)">
      <h2 style="color:var(--gold);margin-bottom:8px;font-size:18px">📋 ملخص العميل — ${App.esc(clientName)}</h2>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px">الفترة: ${fromVal || '—'} → ${toVal || '—'}</div>
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

    projectSummary.forEach(p => {
      const pDeposits = clientDeposits.filter(t => t.project_id === p.id);
      const pExpenses = clientExpenses.filter(t => t.project_id === p.id);
      const pDesign = pExpenses.filter(t => t.expense_category === 'design');
      const pConstr = pExpenses.filter(t => (t.expense_category || 'construction') !== 'design');

      html += `<div style="margin-bottom:20px;padding:16px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border);page-break-inside:avoid">
        <h3 style="color:var(--gold);margin-bottom:12px;font-size:16px;border-bottom:1px solid var(--border);padding-bottom:8px">🏗️ ${p.name}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:12px">
          <span style="background:var(--bg);padding:4px 10px;border-radius:var(--radius-sm)">وارد: ${App.fmtMoney(p.dep)}</span>
          <span style="background:var(--bg);padding:4px 10px;border-radius:var(--radius-sm)">مصروفات: ${App.fmtMoney(p.exp)}</span>
          <span style="background:var(--bg);padding:4px 10px;border-radius:var(--radius-sm)">إشراف: ${App.fmtMoney(p.sup)}</span>
          <span style="background:var(--bg);padding:4px 10px;border-radius:var(--radius-sm);color:${p.bal >= 0 ? 'var(--green)' : 'var(--red)'}">رصيد: ${App.fmtMoney(p.bal)}</span>
        </div>`;

      if (pDeposits.length) {
        html += `<h4 style="font-size:13px;color:var(--text2);margin:8px 0">💰 الوارد</h4>`;
        html += App.table(['التاريخ', 'المبلغ', 'طريقة الدفع', 'البيان'], pDeposits.map(t => {
          const pm = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' }[t.payment_method] || '-';
          return [App.fmtDate(t.date || t.created_at), App.fmtMoney(t.amount), pm, t.description || 'عربون'];
        }));
      }

      if (pConstr.length) {
        html += `<h4 style="font-size:13px;color:var(--text2);margin:8px 0">🔨 مصروفات تشطيب</h4>`;
        html += App.table(['التاريخ', 'المبلغ', 'البيان'], pConstr.map(t => [App.fmtDate(t.date || t.created_at), App.fmtMoney(t.amount), t.description || '-']));
      }

      if (pDesign.length) {
        html += `<h4 style="font-size:13px;color:var(--text2);margin:8px 0">🎨 مصروفات تصميم</h4>`;
        html += App.table(['التاريخ', 'المبلغ', 'البيان'], pDesign.map(t => [App.fmtDate(t.date || t.created_at), App.fmtMoney(t.amount), t.description || '-']));
      }

      html += `<div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center;font-size:13px">
        <span>📋 إشراف (${p.supervision_percentage || 0}% على ${App.fmtMoney(p.constr)})</span>
        <strong style="color:var(--gold)">${App.fmtMoney(p.sup)}</strong>
      </div>`;

      html += `</div>`;
    });

    const reportEl = document.getElementById('client-statement-report');
    if (reportEl) reportEl.innerHTML = html;
  },

  printClientStatement() {
    const overlay = document.querySelector('.modal-overlay');
    const clientName = overlay?.dataset.clientName || '';
    const fromVal = document.getElementById('cs-from')?.value || '';
    const toVal = document.getElementById('cs-to')?.value || '';
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    const dateStr = fromVal && toVal ? `${fromVal}_to_${toVal}` : new Date().toISOString().slice(0, 10);
    App.printReport(`كشف-حساب-${safe(clientName)}-${dateStr}`);
  },

  exportClientStatement() {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const clientName = overlay.dataset.clientName || '';
    const projects = JSON.parse(overlay.dataset.projects || '[]');
    const deposits = JSON.parse(overlay.dataset.deposits || '[]');
    const expenses = JSON.parse(overlay.dataset.expenses || '[]');
    const fromVal = document.getElementById('cs-from')?.value || '';
    const toVal = document.getElementById('cs-to')?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const inRange = (d) => {
      if (!d) return true;
      const date = new Date(d);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const projIds = projects.map(p => p.id);
    const clientDeposits = deposits.filter(t => projIds.includes(t.project_id) && inRange(t.date));
    const clientExpenses = expenses.filter(t => projIds.includes(t.project_id) && inRange(t.date));

    const rows = [];
    projects.forEach(p => {
      const pDeposits = clientDeposits.filter(t => t.project_id === p.id);
      const pExpenses = clientExpenses.filter(t => t.project_id === p.id);
      pDeposits.forEach(t => rows.push({ date: t.date || t.created_at, project: p.name, type: 'وارد', amount: +t.amount || 0, description: t.description || 'عربون' }));
      pExpenses.forEach(t => {
        const type = t.expense_category === 'design' ? 'مصروف تصميم' : 'مصروف تشطيب';
        rows.push({ date: t.date || t.created_at, project: p.name, type, amount: +t.amount || 0, description: t.description || '-' });
      });
      const design = pExpenses.filter(t => t.expense_category === 'design').reduce((s, t) => s + (+t.amount || 0), 0);
      const constr = pExpenses.filter(t => (t.expense_category || 'construction') !== 'design').reduce((s, t) => s + (+t.amount || 0), 0);
      const sup = constr * (p.supervision_percentage || 0) / 100;
      if (sup > 0) rows.push({ date: '', project: p.name, type: 'إشراف', amount: sup, description: `إشراف ${p.name}` });
    });

    rows.sort((a, b) => new Date(a.date || '1970-01-01') - new Date(b.date || '1970-01-01'));

    const ws = XLSX.utils.aoa_to_sheet([
      ['التاريخ', 'المشروع', 'النوع', 'المبلغ', 'البيان'],
      ...rows.map(r => [r.date, r.project, r.type, r.amount, r.description])
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب العميل');
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    const dateStr = fromVal && toVal ? `${fromVal}_to_${toVal}` : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `كشف-حساب-${safe(clientName)}-${dateStr}.xlsx`);
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
      const existing = await API.request('vendors', 'GET', null, '?select=name&deleted_at=is.null');
      const existingNames = new Set(existing.map(v => String(v.name || '').trim().toLowerCase()));
      const dupes = rows.filter(r => existingNames.has(String(r.name || '').trim().toLowerCase()));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} موردين موجودين مسبقاً: ${dupes.map(d => d.name).join(', ')}`, 'error'); return; }
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
      const newName = String(fd.get('name') || '').trim();
      if (newName.toLowerCase() !== String(rows[0].name || '').trim().toLowerCase()) {
        const existing = await API.request('vendors', 'GET', null, `?select=id&name=ilike.${encodeURIComponent(newName)}&deleted_at=is.null`);
        if (existing.length) { UI.toast('⚠️ اسم المورد موجود مسبقاً', 'error'); return; }
      }
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
      API.request('transactions', 'GET', null, `?select=*&vendor_id=eq.${id}&type=in.(project_expense,office_expense)&deleted_at=is.null&order=date.asc`)
    ]);
    if (!vendorRows.length) return;
    const vendor = vendorRows[0];

    const minDate = procs.concat(payments).filter(t => t.date).map(t => t.date).sort()[0] || '';
    const maxDate = new Date().toISOString().slice(0, 10);

    const filterHtml = `<div style="margin-bottom:16px;padding:16px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
      <h3 style="font-size:14px;color:var(--gold);margin-bottom:12px">📅 فلتر التاريخ</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
        <div class="form-group" style="min-width:160px"><label>من</label><input type="date" id="vs-from" value="${minDate}"></div>
        <div class="form-group" style="min-width:160px"><label>إلى</label><input type="date" id="vs-to" value="${maxDate}"></div>
        <button class="btn btn-primary" onclick="Crud.renderVendorStatement('${id}')">تطبيق</button>
        <button class="btn btn-secondary" onclick="Crud.printVendorStatement('${id}')">🖨️ طباعة / PDF</button>
        <button class="btn btn-secondary" onclick="Crud.exportVendorStatement('${id}')">📊 تصدير Excel</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('vs-from','vs-to','today')">اليوم</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('vs-from','vs-to','this_month')">هذا الشهر</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('vs-from','vs-to','last_month')">الشهر الماضي</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('vs-from','vs-to','this_year')">هذا العام</button>
      </div>
    </div>`;

    const reportHtml = `<div id="vendor-statement-report-${id}"></div>`;
    const logoHtml = `<div class="print-logo" style="display:none;text-align:center;margin-bottom:16px"><img src="logo.png" alt="logo" style="max-height:60px"></div>`;

    const html = logoHtml + filterHtml + reportHtml;
    const overlay = UI.openModal('📋 كشف حساب المورد — ' + App.esc(vendor.name), html, null);
    overlay.dataset.vendorId = id;
    overlay.dataset.vendorName = vendor.name;
    overlay.dataset.procs = JSON.stringify(procs);
    overlay.dataset.payments = JSON.stringify(payments);
    this.renderVendorStatement(id);
  },

  renderVendorStatement(id) {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const vendorName = overlay.dataset.vendorName || '';
    const procs = JSON.parse(overlay.dataset.procs || '[]');
    const payments = JSON.parse(overlay.dataset.payments || '[]');

    const fromVal = document.getElementById('vs-from')?.value || '';
    const toVal = document.getElementById('vs-to')?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const inRange = (d) => {
      if (!d) return true;
      const date = new Date(d);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const fProcs = procs.filter(p => inRange(p.date));
    const fPayments = payments.filter(t => inRange(t.date || t.created_at));

    const ledger = [];
    fProcs.forEach(p => {
      const isNew = p.payment_term !== undefined && p.payment_term !== null;
      const amount = +p.total_price || 0;
      const paid = isNew ? (+p.paid_amount || 0) : 0;
      const term = p.payment_term || 'credit';
      ledger.push({
        date: p.date, source: 'procurement', client: p.client_name || '-', project: p.project_name || '-',
        vendor: vendorName, category: p.item_name || 'شراء', amount, paid, term,
        payment_method: null, desc: `شراء: ${p.item_name || '-'} (${p.project_name || '-'})`
      });
    });
    fPayments.forEach(t => {
      const isNew = t.payment_term !== undefined && t.payment_term !== null;
      const amount = isNew ? (+t.amount || 0) : 0;
      const paid = isNew ? (+t.paid_amount || 0) : (+t.amount || 0);
      const term = t.payment_term || 'settlement';
      const category = t.item_name || t.section_name || (t.expense_category === 'design' ? 'تصميم' : (t.expense_category === 'construction' ? 'تشطيب' : (t.type === 'office_expense' ? 'مكتبي' : 'أخرى')));
      ledger.push({
        date: t.date || t.created_at, source: 'transaction', client: t.party_name || t.client_name || '-', project: t.project_name || '-',
        vendor: t.vendor_name || vendorName, category, amount, paid, term,
        payment_method: t.payment_method || null, desc: t.description || 'دفعة للمورد'
      });
    });
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    const pmLabels = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' };
    let running = 0;
    const tableRows = ledger.map((r, idx) => {
      const balanceChange = r.amount - r.paid;
      running += balanceChange;
      const pmBadge = r.payment_method ? `<span class="badge badge-gray" style="font-size:10px">${pmLabels[r.payment_method] || r.payment_method}</span>` : '-';
      return [
        idx + 1, r.client, r.project, r.vendor, r.category,
        App.fmtMoney(r.amount), pmBadge, App.fmtMoney(r.paid),
        `<strong style="color:${running >= 0 ? 'var(--red)' : 'var(--green)'}">${App.fmtMoney(Math.abs(running))}</strong>`,
        App.fmtDate(r.date)
      ];
    });

    const totalAmount = ledger.reduce((s, r) => s + r.amount, 0);
    const totalPaid = ledger.reduce((s, r) => s + r.paid, 0);
    const balance = totalAmount - totalPaid;

    if (tableRows.length) tableRows.push(['', '', '', '', '<strong>الإجمالي</strong>', `<strong>${App.fmtMoney(totalAmount)}</strong>`, '', `<strong>${App.fmtMoney(totalPaid)}</strong>`, `<strong style="color:${balance >= 0 ? 'var(--red)' : 'var(--green)'}">${App.fmtMoney(Math.abs(balance))}</strong>`, '']);

    const summary = `<div style="margin-bottom:16px"><strong>المورد:</strong> ${App.esc(vendorName)}<br><strong>الفترة:</strong> ${fromVal || '—'} → ${toVal || '—'}<br><strong>إجمالي المبلغ:</strong> ${App.fmtMoney(totalAmount)}<br><strong>إجمالي المدفوع:</strong> ${App.fmtMoney(totalPaid)}<br><strong style="color:var(--gold)">الرصيد:</strong> <span style="color:${balance >= 0 ? 'var(--red)' : 'var(--green)'}">${balance >= 0 ? 'علينا ' + App.fmtMoney(balance) : 'له ' + App.fmtMoney(Math.abs(balance))}</span></div>`;
    const tableHtml = tableRows.length ? App.table(['#', 'العميل', 'المشروع', 'المورد', 'التصنيف', 'المبلغ', 'طريقة الدفع', 'المدفوع', 'الباقي', 'التاريخ'], tableRows) : '<p style="color:var(--text3)">لا توجد بيانات</p>';

    const reportEl = document.getElementById(`vendor-statement-report-${id}`);
    if (reportEl) reportEl.innerHTML = summary + tableHtml;
  },

  printVendorStatement(id) {
    const overlay = document.querySelector('.modal-overlay');
    const vendorName = overlay?.dataset.vendorName || '';
    const fromVal = document.getElementById('vs-from')?.value || '';
    const toVal = document.getElementById('vs-to')?.value || '';
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    const dateStr = fromVal && toVal ? `${fromVal}_to_${toVal}` : new Date().toISOString().slice(0, 10);
    App.printReport(`كشف-حساب-مورد-${safe(vendorName)}-${dateStr}`);
  },

  exportVendorStatement(id) {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const vendorName = overlay.dataset.vendorName || '';
    const procs = JSON.parse(overlay.dataset.procs || '[]');
    const payments = JSON.parse(overlay.dataset.payments || '[]');
    const fromVal = document.getElementById('vs-from')?.value || '';
    const toVal = document.getElementById('vs-to')?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const inRange = (d) => {
      if (!d) return true;
      const date = new Date(d);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const fProcs = procs.filter(p => inRange(p.date));
    const fPayments = payments.filter(t => inRange(t.date || t.created_at));

    const ledger = [];
    fProcs.forEach(p => {
      const isNew = p.payment_term !== undefined && p.payment_term !== null;
      ledger.push({
        date: p.date, client: p.client_name || '-', project: p.project_name || '-',
        category: p.item_name || 'شراء', amount: +p.total_price || 0, paid: isNew ? (+p.paid_amount || 0) : 0,
        payment_method: null, desc: `شراء: ${p.item_name || '-'}`
      });
    });
    fPayments.forEach(t => {
      const isNew = t.payment_term !== undefined && t.payment_term !== null;
      const category = t.item_name || t.section_name || (t.expense_category === 'design' ? 'تصميم' : (t.expense_category === 'construction' ? 'تشطيب' : (t.type === 'office_expense' ? 'مكتبي' : 'أخرى')));
      ledger.push({
        date: t.date || t.created_at, client: t.party_name || t.client_name || '-', project: t.project_name || '-',
        category, amount: isNew ? (+t.amount || 0) : 0, paid: isNew ? (+t.paid_amount || 0) : (+t.amount || 0),
        payment_method: t.payment_method || null, desc: t.description || 'دفعة للمورد'
      });
    });
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    const pmLabels = { cash: 'نقدي', bank: 'بنكي', transfer: 'تحويل' };
    let running = 0;
    const rows = ledger.map(r => {
      running += (r.amount - r.paid);
      const pm = r.payment_method ? (pmLabels[r.payment_method] || r.payment_method) : '-';
      return [r.date, r.client, r.project, r.category, r.amount, pm, r.paid, running, r.desc];
    });

    const totalAmount = ledger.reduce((s, r) => s + r.amount, 0);
    const totalPaid = ledger.reduce((s, r) => s + r.paid, 0);
    rows.push(['', '', '', 'الإجمالي', totalAmount, '', totalPaid, totalAmount - totalPaid, '']);

    const ws = XLSX.utils.aoa_to_sheet([
      ['التاريخ', 'العميل', 'المشروع', 'التصنيف', 'المبلغ', 'طريقة الدفع', 'المدفوع', 'الباقي', 'البيان'],
      ...rows
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب المورد');
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    const dateStr = fromVal && toVal ? `${fromVal}_to_${toVal}` : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `كشف-حساب-مورد-${safe(vendorName)}-${dateStr}.xlsx`);
  },

  async vendorPurchases(vendorId) {
    const [vendorRows, procs, projects] = await Promise.all([
      API.request('vendors', 'GET', null, `?select=*&id=eq.${vendorId}`),
      API.request('procurements', 'GET', null, `?select=*&vendor_id=eq.${vendorId}&deleted_at=is.null&order=date.desc`),
      API.request('projects', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    if (!vendorRows.length) return;
    const vendor = vendorRows[0];

    const minDate = procs.filter(p => p.date).map(p => p.date).sort()[0] || '';
    const maxDate = new Date().toISOString().slice(0, 10);

    const filterHtml = `<div style="margin-bottom:16px;padding:16px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
      <h3 style="font-size:14px;color:var(--gold);margin-bottom:12px">📅 فلتر التاريخ</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
        <div class="form-group" style="min-width:160px"><label>من</label><input type="date" id="vp-from" value="${minDate}"></div>
        <div class="form-group" style="min-width:160px"><label>إلى</label><input type="date" id="vp-to" value="${maxDate}"></div>
        <button class="btn btn-primary" onclick="Crud.renderVendorPurchases('${vendorId}')">تطبيق</button>
        <button class="btn btn-secondary" onclick="Crud.printVendorPurchases('${vendorId}')">🖨️ طباعة / PDF</button>
        <button class="btn btn-secondary" onclick="Crud.exportVendorPurchases('${vendorId}')">📊 تصدير Excel</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('vp-from','vp-to','today')">اليوم</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('vp-from','vp-to','this_month')">هذا الشهر</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('vp-from','vp-to','last_month')">الشهر الماضي</button>
        <button class="btn btn-sm btn-secondary" onclick="App.setDateRange('vp-from','vp-to','this_year')">هذا العام</button>
      </div>
    </div>`;

    const reportHtml = `<div id="vendor-purchases-report-${vendorId}"></div>`;
    const logoHtml = `<div class="print-logo" style="display:none;text-align:center;margin-bottom:16px"><img src="logo.png" alt="logo" style="max-height:60px"></div>`;

    const html = logoHtml + filterHtml + reportHtml;
    const overlay = UI.openModal('💰 مشتريات — ' + App.esc(vendor.name), html, null);
    overlay.dataset.vendorId = vendorId;
    overlay.dataset.vendorName = vendor.name;
    overlay.dataset.procs = JSON.stringify(procs);
    this.renderVendorPurchases(vendorId);
  },

  renderVendorPurchases(vendorId) {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const vendorName = overlay.dataset.vendorName || '';
    const procs = JSON.parse(overlay.dataset.procs || '[]');

    const fromVal = document.getElementById('vp-from')?.value || '';
    const toVal = document.getElementById('vp-to')?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const inRange = (d) => {
      if (!d) return true;
      const date = new Date(d);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const fProcs = procs.filter(p => inRange(p.date));
    const total = fProcs.reduce((s, p) => s + (+p.total_price || 0), 0);
    const rows = fProcs.map(p => [
      App.fmtDate(p.date), p.project_name || '-', p.item_name || '-', p.quantity || '-',
      App.fmtMoney(p.unit_price), App.fmtMoney(p.total_price), p.expense_type || '-',
      UI.actions(p.id, 'Crud.editProcurement', 'Crud.delProcurement')
    ]);

    let html = `<div style="margin-bottom:16px"><strong>المورد:</strong> ${vendorName}<br><strong>الفترة:</strong> ${fromVal || '—'} → ${toVal || '—'}<br><strong>إجمالي المشتريات:</strong> ${App.fmtMoney(total)}</div>
      <div style="margin-bottom:16px"><button class="btn btn-primary" onclick="Crud.addProcurement('${vendorId}')">+ إضافة مشتريات</button></div>
      ${rows.length ? App.table(['التاريخ', 'المشروع', 'البند', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'التصنيف', 'الإجراءات'], rows) : '<p style="color:var(--text3)">لا توجد مشتريات</p>'}`;

    const reportEl = document.getElementById(`vendor-purchases-report-${vendorId}`);
    if (reportEl) reportEl.innerHTML = html;
  },

  printVendorPurchases(vendorId) {
    const overlay = document.querySelector('.modal-overlay');
    const vendorName = overlay?.dataset.vendorName || '';
    const fromVal = document.getElementById('vp-from')?.value || '';
    const toVal = document.getElementById('vp-to')?.value || '';
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    const dateStr = fromVal && toVal ? `${fromVal}_to_${toVal}` : new Date().toISOString().slice(0, 10);
    App.printReport(`مشتريات-مورد-${safe(vendorName)}-${dateStr}`);
  },

  exportVendorPurchases(vendorId) {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const vendorName = overlay.dataset.vendorName || '';
    const procs = JSON.parse(overlay.dataset.procs || '[]');
    const fromVal = document.getElementById('vp-from')?.value || '';
    const toVal = document.getElementById('vp-to')?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const inRange = (d) => {
      if (!d) return true;
      const date = new Date(d);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const fProcs = procs.filter(p => inRange(p.date));
    const rows = fProcs.map(p => [p.date, p.project_name || '-', p.item_name || '-', p.quantity || 0, p.unit_price || 0, p.total_price || 0, p.expense_type || '-']);
    const total = fProcs.reduce((s, p) => s + (+p.total_price || 0), 0);
    rows.push(['', '', '', '', '', total, '']);

    const ws = XLSX.utils.aoa_to_sheet([
      ['التاريخ', 'المشروع', 'البند', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'التصنيف'],
      ...rows
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'مشتريات المورد');
    const safe = (s) => String(s || '').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().replace(/\s+/g, '-');
    const dateStr = fromVal && toVal ? `${fromVal}_to_${toVal}` : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `مشتريات-مورد-${safe(vendorName)}-${dateStr}.xlsx`);
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
      { name: 'tax_rate', label: 'نسبة الضريبة %', type: 'number' },
      { name: 'expense_type', label: 'التصنيف' },
      { name: 'date', label: 'التاريخ', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    const overlay = UI.openModal('إضافة مشتريات', `<form>${UI.form(fields, { vendor_id: vendorId || '', date: new Date().toISOString().slice(0, 10) })}</form>`, async (form) => {
      const fd = new FormData(form);
      const project = projects.find(p => p.id === fd.get('project_id'));
      const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
      const qty = +fd.get('quantity') || 1;
      const up = +fd.get('unit_price') || 0;
      const tax_rate = +fd.get('tax_rate') || 14;
      const total_price = qty * up;
      const tax_amount = total_price * tax_rate / 100;
      await this.save('procurements', {
        vendor_id: fd.get('vendor_id'), vendor_name: vendor ? vendor.name : null,
        project_id: fd.get('project_id') || null, project_name: project ? project.name : null,
        item_name: fd.get('item_name'), quantity: qty, unit_price: up, total_price,
        tax_rate, tax_amount,
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
      { name: 'tax_rate', label: 'نسبة الضريبة %', type: 'number' },
      { name: 'expense_type', label: 'التصنيف' },
      { name: 'date', label: 'التاريخ', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    const overlay = UI.openModal('تعديل مشتريات', `<form>${UI.form(fields, { ...p, vendor_id: p.vendor_id || '', project_id: p.project_id || '' })}</form>`, async (form) => {
      const fd = new FormData(form);
      const project = projects.find(pr => pr.id === fd.get('project_id'));
      const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
      const qty = +fd.get('quantity') || 1;
      const up = +fd.get('unit_price') || 0;
      const tax_rate = +fd.get('tax_rate') || 14;
      const total_price = qty * up;
      const tax_amount = total_price * tax_rate / 100;
      await this.save('procurements', {
        vendor_id: fd.get('vendor_id'), vendor_name: vendor ? vendor.name : null,
        project_id: fd.get('project_id') || null, project_name: project ? project.name : null,
        item_name: fd.get('item_name'), quantity: qty, unit_price: up, total_price,
        tax_rate, tax_amount,
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
      UI.openModal('سجل العهدة — ' + App.esc(emp.name), html, null);
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
      const lastDay = new Date(year, month, 0).getDate();
      const [empRows, attendance] = await Promise.all([
        API.request('employees', 'GET', null, `?select=*&id=eq.${empId}`),
        API.request('attendance_records', 'GET', null, `?select=*&employee_id=eq.${empId}&date=gte.${year}-${String(month).padStart(2,'0')}-01&date=lte.${year}-${String(month).padStart(2,'0')}-${lastDay}&deleted_at=is.null&order=date.asc`)
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
      UI.openModal('سجل الحضور — ' + App.esc(emp.name), html, null);
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
    const [clients, projects, vendors, workSections, workItems] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('work_sections', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('work_items', 'GET', null, '?select=id,name,section_id&deleted_at=is.null&order=name.asc')
    ]);
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }));
    const vendorOpts = vendors.map(v => ({ v: v.id, l: v.name }));
    const sectionOpts = workSections.map(s => ({ v: s.id, l: s.name }));
    const cols = [
      { key: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { key: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { key: 'vendor_id', label: 'المورد', type: 'select', opts: [{ v: '', l: '-- اختر مورد --' }, ...vendorOpts] },
      { key: 'section_id', label: 'القسم', type: 'select', req: true, opts: [{ v: '', l: '-- اختر قسم --' }, ...sectionOpts] },
      { key: 'item_id', label: 'البند', type: 'select', opts: [{ v: '', l: '-- اختر بند --' }] },
      { key: 'payment_method', label: 'طريقة الدفع', type: 'select', opts: [{ v: '', l: '-- اختر --' }, { v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'إيداع بنكي' }, { v: 'transfer', l: 'تحويل' }] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'paid_amount', label: 'المدفوع', type: 'number' },
      { key: 'tax_rate', label: 'نسبة الضريبة %', type: 'number' },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('🔨 مصروف مشروع', cols, async (rows) => {
      const enriched = rows.map(r => {
        const project = projects.find(p => p.id === r.project_id);
        const vendor = vendors.find(v => v.id === r.vendor_id);
        const section = workSections.find(s => s.id === r.section_id);
        const item = workItems.find(i => i.id === r.item_id);
        if (!project) { UI.toast('مشروع غير موجود', 'error'); throw new Error('invalid project'); }
        if (r.client_id && project.client_id !== r.client_id) { UI.toast('المشروع لا ينتمي للعميل المختار', 'error'); throw new Error('client mismatch'); }
        let amount = +r.amount || 0;
        let paid_amount = +r.paid_amount || 0;
        const payment_method = r.payment_method || null;
        // Auto-compute payment_term for backward compatibility
        let payment_term = 'immediate';
        if (amount === 0 && paid_amount > 0) payment_term = 'settlement';
        else if (amount > paid_amount) payment_term = 'credit';
        // Auto-compute expense_category from section name
        const sectionName = section ? section.name : '';
        const expense_category = sectionName.includes('تصميم') ? 'design' : 'construction';
        const tax_rate = (+r.tax_rate || 0) > 0 ? +r.tax_rate : 14;
        const tax_amount = amount * tax_rate / 100;
        return { type: 'project_expense', expense_category, section_id: r.section_id || null, section_name: sectionName || null, item_id: r.item_id || null, item_name: item ? item.name : null, payment_method, payment_term, amount, paid_amount, tax_rate, tax_amount, client_id: project.client_id, party_id: project.client_id, party_name: project.client_name, party_type: 'client', project_id: r.project_id, project_name: project.name, vendor_id: r.vendor_id || null, vendor_name: vendor ? vendor.name : null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      try {
        await this.bulkSave('transactions', enriched);
      } catch (e) {
        if (e.message && (e.message.includes('expense_category') || e.message.includes('section_id') || e.message.includes('section_name') || e.message.includes('item_id') || e.message.includes('item_name') || e.message.includes('payment_term') || e.message.includes('payment_method') || e.message.includes('paid_amount') || e.message.includes('tax_rate') || e.message.includes('tax_amount') || e.message.includes('42703') || e.message.includes('PGRST204'))) {
          const fallback = enriched.map(r => { const { expense_category, section_id, section_name, item_id, item_name, payment_term, payment_method, paid_amount, tax_rate, tax_amount, ...rest } = r; return rest; });
          await this.bulkSave('transactions', fallback);
        } else { throw e; }
      }
      UI.toast(`تم حفظ ${rows.length} مصروف`);
      App.loadTransactions(); App.loadOffice();
    }, {}, { clientProject: { clientKey: 'client_id', projectKey: 'project_id', projects }, sectionItem: { sectionKey: 'section_id', itemKey: 'item_id', items: workItems } });
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
      const [clients, projects, vendors, workSections, workItems] = await Promise.all([
        API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
        API.request('vendors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('work_sections', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('work_items', 'GET', null, '?select=id,name,section_id&deleted_at=is.null&order=name.asc')
      ]);
      const itemOpts = [{ v: '', l: '-- اختر بند --' }, ...workItems.filter(i => String(i.section_id) === String(tx.section_id)).map(i => ({ v: i.id, l: i.name }))];
      const fields = [
        { name: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clients.map(c => ({ v: c.id, l: c.name }))] },
        { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }))] },
        { name: 'vendor_id', label: 'المورد', type: 'select', opts: [{ v: '', l: '-- اختر مورد --' }, ...vendors.map(v => ({ v: v.id, l: v.name }))] },
        { name: 'section_id', label: 'القسم', type: 'select', req: true, opts: [{ v: '', l: '-- اختر قسم --' }, ...workSections.map(s => ({ v: s.id, l: s.name }))] },
        { name: 'item_id', label: 'البند', type: 'select', opts: itemOpts },
        { name: 'payment_method', label: 'طريقة الدفع', type: 'select', opts: [{ v: '', l: '-- اختر --' }, { v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'إيداع بنكي' }, { v: 'transfer', l: 'تحويل' }] },
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'paid_amount', label: 'المدفوع', type: 'number' },
        { name: 'tax_rate', label: 'نسبة الضريبة %', type: 'number' },
        { name: 'tax_amount', label: 'قيمة الضريبة', type: 'number' },
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      const overlay = UI.openModal('تعديل مصروف مشروع', `<form>${UI.form(fields, { ...tx, client_id: tx.client_id || '', project_id: tx.project_id || '', vendor_id: tx.vendor_id || '', section_id: tx.section_id || '', item_id: tx.item_id || '', payment_method: tx.payment_method || '', paid_amount: tx.paid_amount !== undefined ? tx.paid_amount : (tx.amount || 0), tax_rate: tx.tax_rate !== undefined ? tx.tax_rate : 14, tax_amount: tx.tax_amount !== undefined ? tx.tax_amount : ((+tx.amount || 0) * 14 / 100) })}</form>`, async (form) => {
        const fd = new FormData(form);
        const project = projects.find(p => String(p.id) === String(fd.get('project_id')));
        const vendor = vendors.find(v => String(v.id) === String(fd.get('vendor_id')));
        const section = workSections.find(s => String(s.id) === String(fd.get('section_id')));
        const item = workItems.find(i => String(i.id) === String(fd.get('item_id')));
        if (!project) { UI.toast('مشروع غير موجود', 'error'); return; }
        if (fd.get('client_id') && String(project.client_id) !== String(fd.get('client_id'))) { UI.toast('المشروع لا ينتمي للعميل المختار', 'error'); return; }
        let amount = +fd.get('amount') || 0;
        let paid_amount = +fd.get('paid_amount') || 0;
        const payment_method = fd.get('payment_method') || null;
        // Auto-compute payment_term for backward compatibility
        let payment_term = 'immediate';
        if (amount === 0 && paid_amount > 0) payment_term = 'settlement';
        else if (amount > paid_amount) payment_term = 'credit';
        // Auto-compute expense_category from section name
        const sectionName = section ? section.name : '';
        const expense_category = sectionName.includes('تصميم') ? 'design' : 'construction';
        const tax_rate = +fd.get('tax_rate') || 14;
        const tax_amount = +fd.get('tax_amount') || (amount * tax_rate / 100);
        try {
          await this.save('transactions', { type: 'project_expense', expense_category, section_id: fd.get('section_id') || null, section_name: sectionName || null, item_id: fd.get('item_id') || null, item_name: item ? item.name : null, payment_method, payment_term, amount, paid_amount, tax_rate, tax_amount, client_id: project.client_id, party_id: project.client_id, party_name: project.client_name, party_type: 'client', project_id: fd.get('project_id'), project_name: project.name, vendor_id: fd.get('vendor_id') || null, vendor_name: vendor ? vendor.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        } catch (e) {
          if (e.message && (e.message.includes('expense_category') || e.message.includes('section_id') || e.message.includes('section_name') || e.message.includes('item_id') || e.message.includes('item_name') || e.message.includes('payment_term') || e.message.includes('payment_method') || e.message.includes('paid_amount') || e.message.includes('tax_rate') || e.message.includes('tax_amount') || e.message.includes('42703') || e.message.includes('PGRST204'))) {
            await this.save('transactions', { type: 'project_expense', amount, paid_amount, client_id: project.client_id, party_id: project.client_id, party_name: project.client_name, party_type: 'client', project_id: fd.get('project_id'), project_name: project.name, vendor_id: fd.get('vendor_id') || null, vendor_name: vendor ? vendor.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
          } else { throw e; }
        }
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
      this._setupClientProjectCascade(overlay, projects, tx.client_id, tx.project_id);
      this._setupSectionItemCascade(overlay, workSections, workItems, tx.section_id, tx.item_id);
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
    UI.openModal('تعديل راتب — ' + App.esc(p.employee_name), `<form>${UI.form(fields, p)}</form>`, async (form) => {
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
