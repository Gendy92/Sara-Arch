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
    // Treat genuine PostgREST/schema errors as missing-column failures.
    return msg.includes('PGRST204') || msg.includes('42703') ||
      /Could not find the '[^']+' column of '[^']+' in the schema cache/.test(msg) ||
      /column "[^"]+" of relation/.test(msg) ||
      /column "[^"]+" does not exist/.test(msg) ||
      /record "new" has no field "[^"]+"/.test(msg);
  },

  async _checkDuplicate(table, nameField, nameValue, extraFilter = '') {
    if (!nameValue || !nameValue.trim()) return false;
    try {
      const q = `?select=id&${nameField}=eq.${encodeURIComponent(nameValue.trim())}&deleted_at=is.null${extraFilter}`;
      const existing = await API.request(table, 'GET', null, q);
      return existing.length > 0;
    } catch (e) { return false; }
  },

  _stripMissing(payload, missingKey) {
    // Only allow silent stripping of internal audit columns. Stripping user-data
    // columns hides schema/permission bugs and can silently discard input.
    const allowed = new Set(['created_by', 'updated_by']);
    if (!allowed.has(missingKey)) {
      throw new Error('عمود غير معروف في قاعدة البيانات: ' + missingKey);
    }
    const clean = Array.isArray(payload) ? payload.map(r => { const c = { ...r }; delete c[missingKey]; return c; }) : { ...payload };
    if (!Array.isArray(payload)) delete clean[missingKey];
    return clean;
  },

  _FINANCIAL_NUMERIC_KEYS: new Set(['amount','paid_amount','quantity','unit_price','total_price','value','price','cost','salary','base_salary','deductions','bonuses','penalties','net_salary','discount','returned_amount']),

  _assertNonNegative(data) {
    if (!data || typeof data !== 'object') return;
    const targets = Array.isArray(data) ? data : [data];
    for (const obj of targets) {
      for (const [k, v] of Object.entries(obj)) {
        if (this._FINANCIAL_NUMERIC_KEYS.has(k) && v != null && v !== '' && Number(v) < 0) {
          throw new Error('لا يمكن أن تكون القيمة سالبة: ' + k);
        }
      }
    }
  },

  _isOfficeVendor(vendorId, vendors) {
    if (!vendorId || !vendors) return false;
    const v = vendors.find(x => String(x.id) === String(vendorId));
    return !!v && v.is_office;
  },

  _confirmOfficeVendor(vendorId, vendors, onYes) {
    if (this._isOfficeVendor(vendorId, vendors)) {
      UI.confirm('⚠️ تنبيه: هذا المورد هو المكتب الداخلي\n\nاختيار سارة كمورد قد يؤدي إلى ازدواجية في التكلفة، حيث أن مصاريف المكتب مسجلة بالفعل في النظام.\n\nتأكد أن هذا المصروف ليس تكلفة إشراف أو تصميم أو إيجار معدات — هذه تُسجل كإيرادات مكتب وليس كمصروف مشروع.\n\nهل تريد المتابعة؟', onYes, null, 'متابعة', 'إلغاء');
    } else {
      onYes();
    }
  },

  _confirmOfficeVendorAsync(vendorId, vendors) {
    return new Promise((resolve, reject) => {
      if (!this._isOfficeVendor(vendorId, vendors)) return resolve();
      UI.confirm(
        '⚠️ تنبيه: هذا المورد هو المكتب الداخلي\n\nاختيار سارة كمورد قد يؤدي إلى ازدواجية في التكلفة، حيث أن مصاريف المكتب مسجلة بالفعل في النظام.\n\nتأكد أن هذا المصروف ليس تكلفة إشراف أو تصميم أو إيجار معدات — هذه تُسجل كإيرادات مكتب وليس كمصروف مشروع.\n\nهل تريد المتابعة؟',
        () => resolve(),
        () => reject(new Error('cancelled')),
        'متابعة',
        'إلغاء'
      );
    });
  },

  async _fetchOldData(table, id) {
    try {
      const existing = await API.request(table, 'GET', null, '?select=*&id=eq.' + id + '&deleted_at=is.null');
      return existing?.[0] || null;
    } catch (e) {
      return null;
    }
  },

  async save(table, data, id, oldData = null) {
    const userId = this._currentUserId();
    const userName = this._currentUserName();
    this._assertNonNegative(data);

    // total_price is a generated column (quantity * unit_price); never send it to the DB.
    let cleanData = { ...data };
    if (table === 'procurements') delete cleanData.total_price;

    // Basic accounting guardrails: warn if paid exceeds total, but allow per LOGIC_SPEC.
    if (table === 'transactions' && cleanData.amount != null && cleanData.paid_amount != null) {
      const amount = +cleanData.amount || 0;
      const paid = +cleanData.paid_amount || 0;
      if (paid > amount) UI.toast('تنبيه: المبلغ المدفوع أكبر من إجمالي المبلغ', 'warning');
    }
    if (table === 'procurements' && cleanData.paid_amount != null) {
      const total = (+cleanData.quantity || 1) * (+cleanData.unit_price || 0);
      const paid = +cleanData.paid_amount || 0;
      if (paid > total) UI.toast('تنبيه: المبلغ المدفوع أكبر من إجمالي المشتريات', 'warning');
    }
    if (id) {
      const preUpdateData = oldData || await this._fetchOldData(table, id);
      let payload = { ...cleanData, updated_by: userId };
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
      this._logAudit(table, id, 'UPDATE', preUpdateData, payload, userId, userName).catch(() => {});
      return { id, ...payload };
    } else {
      let payload = { ...cleanData, created_by: userId };
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
    } catch (e) { /* audit logging is best-effort */ }
  },

  _setupClientProjectCascade(overlay, projects, currentClientId, currentProjectId) {
    const form = overlay.querySelector('form');
    if (!form) return;
    const clientSel = form.querySelector('[name="client_id"]');
    const projSel = form.querySelector('[name="project_id"]');
    if (!clientSel || !projSel) return;

    // Store full options
    const allProjOpts = Array.from(projSel.options).map(o => ({ v: o.value, l: o.textContent }));

    const projInput = projSel.closest('.searchable-select')?.querySelector('.searchable-select-input');
    const filterProjects = (clientId) => {
      if (!clientId) {
        projSel.innerHTML = '<option value="">-- اختر مشروع --</option>';
        projSel.disabled = true;
        if (projInput) projInput.disabled = true;
        return;
      }
      const filtered = projects.filter(p => String(p.client_id) === String(clientId));
      projSel.innerHTML = '<option value="">-- اختر مشروع --</option>' + filtered.map(p => `<option value="${p.id}">${App.esc(p.name)}</option>`).join('');
      projSel.disabled = false;
      if (projInput) projInput.disabled = false;
    };

    // Initial state
    if (currentClientId) {
      filterProjects(currentClientId);
      if (currentProjectId) projSel.value = currentProjectId;
    } else {
      projSel.disabled = true;
      if (projInput) projInput.disabled = true;
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
      itemSel.innerHTML = '<option value="">-- اختر بند --</option>' + filtered.map(i => `<option value="${i.id}">${App.esc(i.name)}</option>`).join('');
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
    this._assertNonNegative(rows);
    const userId = this._currentUserId();
    let clean = rows.map(r => {
      const c = { created_by: userId };
      for (const [k, v] of Object.entries(r)) {
        if (v !== null && v !== '') c[k] = v;
      }
      // total_price is generated; never bulk-insert it.
      if (table === 'procurements') delete c.total_price;
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
    // Cascade soft-delete for projects
    if (cascade && table === 'projects') {
      try {
        const txs = await API.request('transactions', 'GET', null, `?select=id&project_id=eq.${id}&deleted_at=is.null`);
        for (const t of txs) { await this.softDelete('transactions', t.id, false); }
        const procs = await API.request('procurements', 'GET', null, `?select=id,linked_transaction_id&project_id=eq.${id}&deleted_at=is.null`);
        for (const pr of procs) {
          if (pr.linked_transaction_id) await this.softDelete('transactions', pr.linked_transaction_id, false);
          await this.softDelete('procurements', pr.id, false);
        }
        const tasks = await API.request('project_tasks', 'GET', null, `?select=id&project_id=eq.${id}&deleted_at=is.null`);
        for (const tk of tasks) { await this.softDelete('project_tasks', tk.id, false); }
      } catch (e) { /* cascade delete is best-effort */ }
    }
    // Cascade soft-delete for vendors
    if (cascade && table === 'vendors') {
      try {
        const txs = await API.request('transactions', 'GET', null, `?select=id&vendor_id=eq.${id}&deleted_at=is.null`);
        for (const t of txs) { await this.softDelete('transactions', t.id, false); }
        const procs = await API.request('procurements', 'GET', null, `?select=id,linked_transaction_id&vendor_id=eq.${id}&deleted_at=is.null`);
        for (const pr of procs) {
          if (pr.linked_transaction_id) await this.softDelete('transactions', pr.linked_transaction_id, false);
          await this.softDelete('procurements', pr.id, false);
        }
      } catch (e) { /* cascade delete is best-effort */ }
    }
    // Cascade soft-delete for employees
    if (cascade && table === 'employees') {
      try {
        const tables = [
          { t: 'employee_transactions', col: 'employee_id' },
          { t: 'employee_salary_history', col: 'employee_id' },
          { t: 'attendance_records', col: 'employee_id' },
          { t: 'payroll_records', col: 'employee_id' },
          { t: 'custody_records', col: 'employee_id' }
        ];
        for (const { t, col } of tables) {
          const rows = await API.request(t, 'GET', null, `?select=id&${col}=eq.${id}&deleted_at=is.null`);
          for (const r of rows) { await this.softDelete(t, r.id, false); }
        }
      } catch (e) { /* cascade delete is best-effort */ }
    }
    // Cascade soft-delete for clients
    if (cascade && table === 'clients') {
      try {
        const projects = await API.request('projects', 'GET', null, `?select=id&client_id=eq.${id}&deleted_at=is.null`);
        for (const p of projects) { await this.softDelete('projects', p.id, true); }
        const txs = await API.request('transactions', 'GET', null, `?select=id&client_id=eq.${id}&deleted_at=is.null`);
        for (const t of txs) { await this.softDelete('transactions', t.id, false); }
        UI.toast(`🗑️ تم حذف ${projects.length} مشروع و ${txs.length} معاملة مرتبطة`, 'info');
      } catch (e) { /* cascade delete is best-effort */ }
    }
    // Fetch old data BEFORE soft-delete so audit captures pre-delete state
    let oldData = null;
    try { const existing = await API.request(table, 'GET', null, '?select=*&id=eq.' + id + '&deleted_at=is.null'); oldData = existing[0] || null; } catch (e) { /* ignore fetch errors */ }
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
    const rows = await API.request('clients', 'GET', null, '?select=*&id=eq.' + id + '&deleted_at=is.null');
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
      UI.toast('تم التحديث');
      if (App.screen === 'client' && App.clientId) App.loadClient(App.clientId);
      else App.loadClients();
    });
  },

  delClient(id) {
    UI.confirm('هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع مشاريعه ومعاملاته المرتبطة.', async () => { await this.softDelete('clients', id, true); UI.toast('تم الحذف مع البيانات المرتبطة'); App.go('clients'); });
  },

  // ─── PROJECTS (linked to Clients) ───
  async addProject(clientId) {
    const [clients, workSections] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('work_sections', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc')
    ]);
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const defaultRate = +(App.settings && App.settings.default_supervision) || 0;
    const sectionRateCols = workSections.map(s => ({
      key: `section_rate_${s.id}`,
      label: `نسبة إشراف ${s.name} *`,
      type: 'number',
      req: true
    }));
    const cols = [
      { key: 'name', label: 'اسم المشروع *', req: true },
      { key: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { key: 'address', label: 'العنوان' },
      { key: 'value', label: 'القيمة', type: 'number' },
      { key: 'status', label: 'الحالة', type: 'select', opts: [{ v: 'active', l: 'نشط' }, { v: 'completed', l: 'منتهي' }, { v: 'on_hold', l: 'معلق' }, { v: 'cancelled', l: 'ملغي' }] },
      { key: 'start_date', label: 'تاريخ البدء', type: 'date' },
      { key: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
      { key: 'notes', label: 'ملاحظات' },
      ...sectionRateCols
    ];
    const defaults = clientId ? { client_id: clientId, status: 'active' } : { status: 'active' };
    workSections.forEach(s => { defaults[`section_rate_${s.id}`] = defaultRate; });
    Spreadsheet.open('إضافة مشاريع', cols, async (rows) => {
      const existing = await API.request('projects', 'GET', null, '?select=name,client_id&deleted_at=is.null');
      const dupes = rows.filter(r => existing.some(p => String(p.name || '').trim().toLowerCase() === String(r.name || '').trim().toLowerCase() && String(p.client_id) === String(r.client_id)));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} مشاريع موجودة مسبقاً لنفس العميل`, 'error'); return; }
      const enriched = rows.map(r => {
        const client = clients.find(c => c.id === r.client_id);
        const clean = { ...r, client_id: r.client_id || null, client_name: client ? client.name : null };
        workSections.forEach(s => delete clean[`section_rate_${s.id}`]);
        return clean;
      });
      const saved = await this.bulkSave('projects', enriched);
      const newProjects = Array.isArray(saved) ? saved : [];
      const rateRows = [];
      rows.forEach((r, idx) => {
        const proj = newProjects[idx];
        if (!proj || !proj.id) return;
        for (const s of workSections) {
          const key = `section_rate_${s.id}`;
          const pct = (r[key] !== undefined && r[key] !== null && r[key] !== '') ? +r[key] : defaultRate;
          rateRows.push({ project_id: proj.id, section_id: s.id, percentage: pct });
        }
      });
      if (rateRows.length) await API.upsert('project_section_supervision', rateRows, 'project_id,section_id');
      UI.toast(`تم حفظ ${rows.length} مشروع`);
      if (App.screen === 'client' && App.clientId) App.loadClient(App.clientId);
      else App.loadClients();
    }, defaults, {}, 'none');
  },

  async editProject(id) {
    const [projectRows, clients, workSections, rates] = await Promise.all([
      API.request('projects', 'GET', null, '?select=*&id=eq.' + id + '&deleted_at=is.null'),
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('work_sections', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('project_section_supervision', 'GET', null, `?select=section_id,percentage&project_id=eq.${id}`)
    ]);
    if (!projectRows.length) return;
    const project = projectRows[0];
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const fields = [
      { name: 'name', label: 'اسم المشروع', req: true },
      { name: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { name: 'address', label: 'العنوان' },
      { name: 'value', label: 'القيمة', type: 'number' },
      { name: 'status', label: 'الحالة', type: 'select', opts: [{ v: 'active', l: 'نشط' }, { v: 'completed', l: 'منتهي' }, { v: 'on_hold', l: 'معلق' }, { v: 'cancelled', l: 'ملغي' }] },
      { name: 'start_date', label: 'تاريخ البدء', type: 'date' },
      { name: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    const values = { ...project, client_id: project.client_id || '' };
    const rateMap = Object.fromEntries(rates.map(r => [r.section_id, r.percentage]));
    const overlay = UI.openModal('تعديل مشروع', `<form>${UI.form(fields, values)}</form>`, async (form) => {
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
      await this.save('projects', { name: fd.get('name'), client_id: fd.get('client_id') || null, client_name: client ? client.name : null, value: +fd.get('value') || 0, status: fd.get('status') || 'active', start_date: fd.get('start_date') || null, end_date: fd.get('end_date') || null, notes: fd.get('notes') || null }, id);
      // Save per-section supervision rates
      const rateRows = [];
      form.querySelectorAll('[name^="section_rate_"]').forEach(input => {
        const sectionId = input.name.replace('section_rate_', '');
        rateRows.push({ project_id: id, section_id: sectionId, percentage: +input.value || 0 });
      });
      if (rateRows.length) await API.upsert('project_section_supervision', rateRows, 'project_id,section_id');
      UI.toast('تم التحديث');
      if (App.screen === 'project' && App.projectId) App.loadProject(App.projectId);
      else if (App.screen === 'client' && App.clientId) App.loadClient(App.clientId);
      else App.loadClients();
    });
    const formEl = overlay.querySelector('form');
    const actions = formEl.querySelector('.modal-actions');
    const ratesHtml = `<div class="modal-section"><div class="modal-section-title">نسب الإشراف حسب القسم</div><div class="form-grid">` +
      workSections.map(s => `<div class="form-group"><label>${App.esc(s.name)} <span style="color:#e53935">*</span></label><input type="number" name="section_rate_${s.id}" value="${rateMap[s.id] ?? 0}" min="0" step="any" required /></div>`).join('') +
      `</div></div>`;
    if (actions) actions.insertAdjacentHTML('beforebegin', ratesHtml);
  },



  delProject(id) {
    UI.confirm('هل أنت متأكد من حذف هذا المشروع؟', async () => { await this.softDelete('projects', id); UI.toast('تم الحذف');
      if (App.screen === 'project' && App.projectId) App.go('clients');
      else if (App.screen === 'client' && App.clientId) App.loadClient(App.clientId);
      else App.loadClients();
    });
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
      await this.bulkSave('vendors', rows);
      UI.toast(`تم حفظ ${rows.length} مورد`);
      App.loadVendors();
    }, {}, {}, 'none');
  },

  async editVendor(id) {
    const rows = await API.request('vendors', 'GET', null, '?select=*&id=eq.' + id + '&deleted_at=is.null');
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
      const data = { name: fd.get('name'), vendor_type: fd.get('vendor_type') || 'service', is_office: rows[0].is_office, sector: fd.get('sector') || null, contact_person: fd.get('contact_person') || null, phone: fd.get('phone') || null, email: fd.get('email') || null, address: fd.get('address') || null, notes: fd.get('notes') || null };
      await this.save('vendors', data, id);
      UI.toast('تم التحديث');
      if (App.screen === 'vendor' && App.vendorId) App.loadVendor(App.vendorId);
      else App.loadVendors();
    });
  },

  async delVendor(id) {
    const rows = await API.request('vendors', 'GET', null, `?select=is_office&id=eq.${id}&deleted_at=is.null`);
    if (rows[0]?.is_office) { UI.toast('لا يمكن حذف مورد المكتب الرئيسي', 'error'); return; }
    UI.confirm('هل أنت متأكد من حذف هذا المورد؟', async () => { await this.softDelete('vendors', id, true); UI.toast('تم الحذف'); App.go('vendors'); });
  },

  async _syncProcurementTransaction(procurementId) {
    const rows = await API.request('procurements', 'GET', null, `?select=*,projects(client_id)&id=eq.${procurementId}&deleted_at=is.null`);
    const pr = rows[0];
    if (!pr) return;
    const clientId = pr.project_id ? (pr.projects?.client_id || pr.client_id) : null;
    if (!pr.project_id) {
      if (pr.linked_transaction_id) {
        await this.softDelete('transactions', pr.linked_transaction_id);
        await API.request('procurements', 'PATCH', { linked_transaction_id: null }, `?id=eq.${pr.id}`);
      }
      return;
    }
    const txPayload = {
      type: 'project_expense',
      project_id: pr.project_id,
      client_id: clientId,
      vendor_id: pr.vendor_id,
      amount: +pr.total_price || 0,
      paid_amount: +pr.paid_amount || 0,
      expense_category: 'merchandise',
      description: pr.item_name || 'مشتريات',
      date: pr.date
    };
    if (pr.linked_transaction_id) {
      await this.save('transactions', txPayload, pr.linked_transaction_id);
    } else {
      const result = await this.save('transactions', txPayload);
      const txId = Array.isArray(result) ? result[0]?.id : result?.id;
      if (txId) {
        try { await API.request('procurements', 'PATCH', { linked_transaction_id: txId }, `?id=eq.${pr.id}`); }
        catch (e) { /* link failure is non-fatal */ }
      }
    }
  },

  async addProcurement(vendorId) {
    const [clients, projects, vendors] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc')
    ]);
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }));
    const vendorOpts = vendors.map(v => ({ v: v.id, l: v.name }));
    const cols = [
      { key: 'vendor_id', label: 'المورد', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مورد --' }, ...vendorOpts] },
      { key: 'client_id', label: 'العميل', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts] },
      { key: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { key: 'item_name', label: 'البند / الصنف', req: true },
      { key: 'quantity', label: 'الكمية', type: 'number' },
      { key: 'unit_price', label: 'سعر الوحدة', type: 'number' },
      { key: 'expense_type', label: 'التصنيف', type: 'select', opts: [{ v: '', l: '-- اختر --' }, { v: 'أخرى', l: 'أخرى' }, { v: 'مواد', l: 'مواد' }, { v: 'عمالة', l: 'عمالة' }, { v: 'معدات', l: 'معدات' }] },
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('🛒 إضافة مشتريات', cols, async (rows) => {
      const enriched = rows.map(r => {
        const client = clients.find(c => c.id === r.client_id);
        const project = projects.find(p => p.id === r.project_id);
        const vendor = vendors.find(v => v.id === r.vendor_id);
        if (!vendor) { UI.toast('مورد غير موجود', 'error'); throw new Error('invalid vendor'); }
        if (!project) { UI.toast('مشروع غير موجود', 'error'); throw new Error('invalid project'); }
        if (r.client_id && project.client_id !== r.client_id) { UI.toast('المشروع لا ينتمي للعميل المختار', 'error'); throw new Error('client mismatch'); }
        if (!r.item_name || !String(r.item_name).trim()) { UI.toast('البند مطلوب', 'error'); throw new Error('item required'); }
        const qty = +r.quantity || 1;
        const up = +r.unit_price || 0;
        const total = qty * up;
        return {
          vendor_id: r.vendor_id, vendor_name: vendor.name,
          client_id: r.client_id || project.client_id, client_name: client ? client.name : project.client_name,
          project_id: r.project_id, project_name: project.name,
          item_name: String(r.item_name).trim(), quantity: qty, unit_price: up,
          payment_term: 'immediate', paid_amount: total,
          expense_type: r.expense_type || null, date: r.date || new Date().toISOString().slice(0, 10), notes: r.notes || null
        };
      });
      for (const r of enriched) await this._confirmOfficeVendorAsync(r.vendor_id, vendors);
      const result = await this.bulkSave('procurements', enriched);
      const saved = Array.isArray(result) ? result : [];
      for (const proc of saved) {
        if (proc.id) await this._syncProcurementTransaction(proc.id);
      }
      UI.toast(`تم حفظ ${saved.length} مشتريات`);
      if (vendorId) this.vendorPurchases(vendorId);
      else App.loadVendors();
    }, { vendor_id: vendorId || '', date: new Date().toISOString().slice(0, 10) }, { clientProject: { clientKey: 'client_id', projectKey: 'project_id', projects } });
  },

  async editProcurement(id) {
    const rows = await API.request('procurements', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const p = rows[0];
    const [clients, projects, vendors] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc')
    ]);
    const clientId = p.client_id || (p.project_id ? projects.find(pr => pr.id === p.project_id)?.client_id : null);
    const fields = [
      { name: 'vendor_id', label: 'المورد', type: 'select', section: 'التعريف', req: true, opts: [{ v: '', l: '-- اختر مورد --' }, ...vendors.map(v => ({ v: v.id, l: v.name }))] },
      { name: 'client_id', label: 'العميل', type: 'select', section: 'التعريف', opts: [{ v: '', l: '-- اختر عميل --' }, ...clients.map(c => ({ v: c.id, l: c.name }))] },
      { name: 'project_id', label: 'المشروع', type: 'select', section: 'التعريف', opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }))] },
      { name: 'item_name', label: 'البند / الصنف', section: 'التعريف', req: true },
      { name: 'quantity', label: 'الكمية', type: 'number', section: 'القيمة' },
      { name: 'unit_price', label: 'سعر الوحدة', type: 'number', section: 'القيمة' },
      { name: 'expense_type', label: 'التصنيف', section: 'القيمة' },
      { name: 'date', label: 'التاريخ *', type: 'date', section: 'التفاصيل', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', section: 'التفاصيل' }
    ];
    const modalBody = `<form>${UI.form(fields, { ...p, vendor_id: p.vendor_id || '', client_id: clientId || '', project_id: p.project_id || '' })}</form><div style="padding:12px 0;font-weight:600;color:var(--gold)">الإجمالي: <span id="proc-total">${App.fmtMoney((+p.quantity || 0) * (+p.unit_price || 0))}</span></div>`;
    const overlay = UI.openModal('تعديل مشتريات', modalBody, async (form) => {
      const fd = new FormData(form);
      const client = clients.find(c => c.id === fd.get('client_id'));
      const project = projects.find(pr => pr.id === fd.get('project_id'));
      const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
      const qty = +fd.get('quantity') || 1;
      const up = +fd.get('unit_price') || 0;
      const total = qty * up;
      await this._confirmOfficeVendorAsync(fd.get('vendor_id'), vendors);
      const isCredit = p.payment_term === 'credit';
      await this.save('procurements', {
        vendor_id: fd.get('vendor_id'), vendor_name: vendor ? vendor.name : null,
        client_id: fd.get('client_id') || (project ? project.client_id : null), client_name: client ? client.name : (project ? project.client_name : null),
        project_id: fd.get('project_id') || null, project_name: project ? project.name : null,
        item_name: fd.get('item_name'), quantity: qty, unit_price: up,
        payment_term: p.payment_term || 'immediate', paid_amount: isCredit ? (p.paid_amount || 0) : total,
        expense_type: fd.get('expense_type') || null, date: fd.get('date') || new Date().toISOString().slice(0, 10), notes: fd.get('notes') || null
      }, id, p);
      await this._syncProcurementTransaction(id);
      UI.toast('تم التحديث');
      if (p.vendor_id) this.vendorPurchases(p.vendor_id);
      else App.loadVendors();
    });
    this._wireProcurementForm(overlay, projects);
  },

  _wireProcurementForm(overlay, projects) {
    const clientSel = overlay.querySelector('[name="client_id"]');
    const projectSel = overlay.querySelector('[name="project_id"]');
    const qtyInput = overlay.querySelector('[name="quantity"]');
    const priceInput = overlay.querySelector('[name="unit_price"]');
    const totalEl = overlay.querySelector('#proc-total');
    if (!clientSel || !projectSel || !qtyInput || !priceInput || !totalEl) return;

    const allProjectOptions = Array.from(projectSel.options);
    const filterProjects = () => {
      const cid = clientSel.value;
      const currentVal = projectSel.value;
      projectSel.innerHTML = '';
      allProjectOptions.forEach(opt => {
        if (!opt.value) { projectSel.appendChild(opt.cloneNode(true)); return; }
        const proj = projects.find(p => p.id === opt.value);
        if (!cid || (proj && proj.client_id === cid)) projectSel.appendChild(opt.cloneNode(true));
      });
      if (cid && currentVal) {
        const stillExists = Array.from(projectSel.options).some(o => o.value === currentVal);
        if (!stillExists) projectSel.value = '';
      }
    };

    const updateTotal = () => {
      const qty = +qtyInput.value || 0;
      const price = +priceInput.value || 0;
      totalEl.textContent = App.fmtMoney(qty * price);
    };

    clientSel.addEventListener('change', filterProjects);
    qtyInput.addEventListener('input', updateTotal);
    priceInput.addEventListener('input', updateTotal);
    filterProjects();
  },

  delProcurement(id) {
    UI.confirm('هل أنت متأكد من حذف هذه المشتريات؟', async () => {
      const rows = await API.request('procurements', 'GET', null, `?select=vendor_id,linked_transaction_id&id=eq.${id}`);
      const vendorId = rows[0]?.vendor_id;
      const txId = rows[0]?.linked_transaction_id;
      await this.softDelete('procurements', id);
      if (txId) await this.softDelete('transactions', txId);
      UI.toast('تم الحذف');
      if (vendorId) this.vendorPurchases(vendorId);
      else App.loadVendors();
    });
  },

  // ─── EMPLOYEES ───
  addEmp() {
    const cols = [
      { key: 'name', label: 'اسم الموظف *', req: true },
      { key: 'job_title', label: 'الوظيفة' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد' },
      { key: 'hire_date', label: 'تاريخ التعيين *', type: 'date', req: true },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة موظفين', cols, async (rows) => {
      const existing = await API.request('employees', 'GET', null, '?select=name&deleted_at=is.null');
      const existingNames = new Set(existing.map(e => String(e.name || '').trim().toLowerCase()));
      const dupes = rows.filter(r => existingNames.has(String(r.name || '').trim().toLowerCase()));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} موظفين موجودين مسبقاً: ${dupes.map(d => d.name).join(', ')}`, 'error'); return; }
      await this.bulkSave('employees', rows);
      UI.toast(`تم حفظ ${rows.length} موظف`);
      App.loadEmployees();
    }, {}, {}, 'none');
  },

  async editEmp(id) {
    const rows = await API.request('employees', 'GET', null, '?select=*&id=eq.' + id + '&deleted_at=is.null');
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم الموظف', req: true },
      { name: 'job_title', label: 'الوظيفة' },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد' },
      { name: 'hire_date', label: 'تاريخ التعيين *', type: 'date', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل موظف', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      const newName = String(fd.get('name') || '').trim();
      if (newName.toLowerCase() !== String(rows[0].name || '').trim().toLowerCase()) {
        const existing = await API.request('employees', 'GET', null, `?select=id&name=ilike.${encodeURIComponent(newName)}&deleted_at=is.null`);
        if (existing.length) { UI.toast('⚠️ اسم الموظف موجود مسبقاً', 'error'); return; }
      }
      const newSalary = +fd.get('salary') || 0;
      const oldSalary = +rows[0].salary || 0;
      await this.save('employees', { name: fd.get('name'), job_title: fd.get('job_title') || null, salary: newSalary, phone: fd.get('phone') || null, email: fd.get('email') || null, hire_date: fd.get('hire_date') || null, notes: fd.get('notes') || null }, id);
      if (newSalary !== oldSalary) {
        await this.save('employee_salary_history', {
          employee_id: id,
          employee_name: fd.get('name'),
          old_salary: oldSalary,
          new_salary: newSalary,
          effective_date: new Date().toISOString().slice(0, 10),
          notes: 'تعديل الراتب من شاشة الموظفين'
        }).catch(() => { /* salary history log is best-effort */ });
      }
      UI.toast('تم التحديث'); App.loadEmployees();
    });
  },

  delEmp(id) {
    UI.confirm('هل أنت متأكد من حذف هذا الموظف؟', async () => { await this.softDelete('employees', id, true); UI.toast('تم الحذف'); App.loadEmployees(); });
  },

  // ─── EMPLOYEE TRANSACTIONS ───
  async employeeTransactions(employeeId) {
    const [emp, records] = await Promise.all([
      API.request('employees', 'GET', null, `?select=name&id=eq.${employeeId}`),
      API.request('employee_transactions', 'GET', null, `?select=*&employee_id=eq.${employeeId}&deleted_at=is.null&order=date.desc&limit=100`)
    ]);
    const name = emp[0]?.name || 'موظف';
    const typeLabels = { advance: 'سلفة', penalty: 'جزاء', bonus: 'مكافأة', other: 'أخرى' };
    const typeColors = { advance: 'blue', penalty: 'red', bonus: 'green', other: 'gray' };
    const total = records.reduce((s, t) => s + (+t.amount || 0), 0);
    const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">عدد المعاملات</div><div class="kpi-value">${records.length}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي المبالغ</div><div class="kpi-value" style="color:var(--gold)">${App.fmtMoney(total)}</div></div>
    </div>`;
    const rows = records.map((t, i) => [i+1, t.date || '-', {html: `<span class="badge badge-${typeColors[t.type] || 'gray'}">${typeLabels[t.type] || t.type}</span>`}, App.fmtMoney(t.amount), App.esc(t.notes || '-'), {html: UI.actions(t.id, 'Crud.editEmpTransaction', 'Crud.delEmpTransaction')}]);
    const table = rows.length ? App.table(['#', 'التاريخ', 'النوع', 'المبلغ', 'ملاحظات', ''], rows) : '<p style="color:var(--text3)">لا توجد معاملات</p>';
    const addBtn = `<div style="margin-bottom:12px"><button class="btn btn-primary" onclick="Crud.addEmpTransaction('${employeeId}')">➕ إضافة معاملة</button></div>`;
    UI.openModal(`💰 معاملات الموظف: ${App.esc(name)}`, addBtn + summary + table, null);
  },

  async addEmpTransaction(employeeId) {
    const employees = await API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc');
    const fields = [
      { name: 'employee_id', label: 'الموظف *', type: 'select', req: true, opts: [{v:'',l:'-- اختر موظف --'}, ...employees.map(e => ({v:e.id,l:e.name}))], default: employeeId || '' },
      { name: 'type', label: 'النوع *', type: 'select', req: true, opts: [{v:'advance',l:'سلفة'},{v:'penalty',l:'جزاء'},{v:'bonus',l:'مكافأة'},{v:'other',l:'أخرى'}] },
      { name: 'amount', label: 'المبلغ *', type: 'number', req: true },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('إضافة معاملة موظف', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      const emp = employees.find(e => e.id === fd.get('employee_id'));
      await this.save('employee_transactions', {
        employee_id: fd.get('employee_id') || null,
        employee_name: emp ? emp.name : null,
        type: fd.get('type') || 'other',
        amount: +fd.get('amount') || 0,
        date: fd.get('date') || new Date().toISOString().slice(0, 10),
        notes: fd.get('notes') || null
      });
      UI.toast('تم الحفظ');
      App.loadEmpTransactions();
      if (employeeId) this.employeeTransactions(employeeId);
    });
  },

  async editEmpTransaction(id) {
    const rows = await API.request('employee_transactions', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const [employees] = await Promise.all([
      API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc')
    ]);
    const fields = [
      { name: 'employee_id', label: 'الموظف *', type: 'select', req: true, opts: [{v:'',l:'-- اختر موظف --'}, ...employees.map(e => ({v:e.id,l:e.name}))] },
      { name: 'type', label: 'النوع *', type: 'select', req: true, opts: [{v:'advance',l:'سلفة'},{v:'penalty',l:'جزاء'},{v:'bonus',l:'مكافأة'},{v:'other',l:'أخرى'}] },
      { name: 'amount', label: 'المبلغ *', type: 'number', req: true },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل معاملة موظف', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      const emp = employees.find(e => e.id === fd.get('employee_id'));
      await this.save('employee_transactions', {
        employee_id: fd.get('employee_id') || null,
        employee_name: emp ? emp.name : null,
        type: fd.get('type') || 'other',
        amount: +fd.get('amount') || 0,
        date: fd.get('date') || null,
        notes: fd.get('notes') || null
      }, id);
      UI.toast('تم التحديث');
      App.loadEmpTransactions();
      if (rows[0].employee_id) this.employeeTransactions(rows[0].employee_id);
    });
  },

  delEmpTransaction(id) {
    UI.confirm('هل أنت متأكد من حذف هذه المعاملة؟', async () => {
      const rows = await API.request('employee_transactions', 'GET', null, `?select=employee_id&id=eq.${id}&deleted_at=is.null`);
      await this.softDelete('employee_transactions', id);
      UI.toast('تم الحذف');
      App.loadEmpTransactions();
      if (rows.length && rows[0].employee_id) this.employeeTransactions(rows[0].employee_id);
    });
  },

  // ─── EMPLOYEE SALARY HISTORY ───
  async employeeSalaryHistory(employeeId) {
    const [emp, records] = await Promise.all([
      API.request('employees', 'GET', null, `?select=name&id=eq.${employeeId}`),
      API.request('employee_salary_history', 'GET', null, `?select=*&employee_id=eq.${employeeId}&deleted_at=is.null&order=effective_date.desc&limit=100`)
    ]);
    const name = emp[0]?.name || 'موظف';
    const rows = records.map((h, i) => {
      const oldSal = +h.old_salary || 0;
      const newSal = +h.new_salary || 0;
      const diff = newSal - oldSal;
      const diffColor = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text3)';
      return [i+1, h.effective_date || '-', App.fmtMoney(oldSal), App.fmtMoney(newSal), {html: `<span style="color:${diffColor};font-weight:600">${diff > 0 ? '+' : ''}${App.fmtMoney(diff)}</span>`}, App.esc(h.notes || '-'), {html: UI.actions(h.id, 'Crud.editSalaryHistory', 'Crud.delSalaryHistory')}];
    });
    const table = rows.length ? App.table(['#', 'التاريخ', 'الراتب القديم', 'الراتب الجديد', 'الفرق', 'ملاحظات', ''], rows) : '<p style="color:var(--text3)">لا يوجد تاريخ رواتب</p>';
    const addBtn = `<div style="margin-bottom:12px"><button class="btn btn-primary" onclick="Crud.addSalaryHistory('${employeeId}')">➕ إضافة تغيير راتب</button></div>`;
    UI.openModal(`📈 تاريخ رواتب: ${App.esc(name)}`, addBtn + table, null);
  },

  async addSalaryHistory(employeeId, oldSalary) {
    const employees = await API.request('employees', 'GET', null, '?select=id,name,salary&is_active=eq.true&deleted_at=is.null&order=name.asc');
    const emp = employees.find(e => e.id === employeeId);
    const fields = [
      { name: 'employee_id', label: 'الموظف *', type: 'select', req: true, opts: [{v:'',l:'-- اختر موظف --'}, ...employees.map(e => ({v:e.id,l:e.name}))], default: employeeId || '' },
      { name: 'old_salary', label: 'الراتب القديم', type: 'number', default: oldSalary != null ? oldSalary : (emp ? emp.salary : 0) },
      { name: 'new_salary', label: 'الراتب الجديد *', type: 'number', req: true },
      { name: 'effective_date', label: 'تاريخ التطبيق *', type: 'date', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('إضافة تغيير راتب', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      const selectedEmp = employees.find(e => e.id === fd.get('employee_id'));
      await this.save('employee_salary_history', {
        employee_id: fd.get('employee_id') || null,
        employee_name: selectedEmp ? selectedEmp.name : null,
        old_salary: +fd.get('old_salary') || 0,
        new_salary: +fd.get('new_salary') || 0,
        effective_date: fd.get('effective_date') || new Date().toISOString().slice(0, 10),
        notes: fd.get('notes') || null
      });
      UI.toast('تم الحفظ');
      App.loadEmpSalaryHistory();
      if (employeeId) this.employeeSalaryHistory(employeeId);
    });
  },

  async editSalaryHistory(id) {
    const rows = await API.request('employee_salary_history', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const employees = await API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc');
    const fields = [
      { name: 'employee_id', label: 'الموظف *', type: 'select', req: true, opts: [{v:'',l:'-- اختر موظف --'}, ...employees.map(e => ({v:e.id,l:e.name}))] },
      { name: 'old_salary', label: 'الراتب القديم', type: 'number' },
      { name: 'new_salary', label: 'الراتب الجديد *', type: 'number', req: true },
      { name: 'effective_date', label: 'تاريخ التطبيق *', type: 'date', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل تاريخ راتب', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      const selectedEmp = employees.find(e => e.id === fd.get('employee_id'));
      await this.save('employee_salary_history', {
        employee_id: fd.get('employee_id') || null,
        employee_name: selectedEmp ? selectedEmp.name : null,
        old_salary: +fd.get('old_salary') || 0,
        new_salary: +fd.get('new_salary') || 0,
        effective_date: fd.get('effective_date') || null,
        notes: fd.get('notes') || null
      }, id);
      UI.toast('تم التحديث');
      App.loadEmpSalaryHistory();
      if (rows[0].employee_id) this.employeeSalaryHistory(rows[0].employee_id);
    });
  },

  delSalaryHistory(id) {
    UI.confirm('هل أنت متأكد من حذف هذا السجل؟', async () => {
      const rows = await API.request('employee_salary_history', 'GET', null, `?select=employee_id&id=eq.${id}&deleted_at=is.null`);
      await this.softDelete('employee_salary_history', id);
      UI.toast('تم الحذف');
      App.loadEmpSalaryHistory();
      if (rows.length && rows[0].employee_id) this.employeeSalaryHistory(rows[0].employee_id);
    });
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
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
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
      API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc'),
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
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
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
        const amount = +r.amount || 0;
        const paid_amount = amount;
        const payment_method = r.payment_method || null;
        // Project expenses are treated as fully paid; vendor balance is tracked separately
        const payment_term = 'immediate';
        // Auto-compute expense_category from section name
        const sectionName = section ? section.name : '';
        const expense_category = sectionName.includes('تصميم') ? 'design' : 'construction';
        return { type: 'project_expense', expense_category, section_id: r.section_id || null, section_name: sectionName || null, item_id: r.item_id || null, item_name: item ? item.name : null, payment_method, payment_term, amount, paid_amount, client_id: project.client_id, party_id: project.client_id, party_name: project.client_name, party_type: 'client', project_id: r.project_id, project_name: project.name, vendor_id: r.vendor_id || null, vendor_name: vendor ? vendor.name : null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      for (const r of enriched) await this._confirmOfficeVendorAsync(r.vendor_id, vendors);
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} مصروف`);
      App.loadTransactions(); App.loadOffice();
    }, {}, { clientProject: { clientKey: 'client_id', projectKey: 'project_id', projects }, sectionItem: { sectionKey: 'section_id', itemKey: 'item_id', items: workItems } });
    const spreadsheetDiv = document.querySelector('.modal-overlay .spreadsheet');
    if (spreadsheetDiv) {
      spreadsheetDiv.addEventListener('change', (e) => {
        if (e.target.dataset.key === 'vendor_id' && this._isOfficeVendor(e.target.value, vendors)) {
          UI.toast('⚠️ المورد المختار هو مكتب سارة. سيتم عرض تنبيه تأكيد قبل الحفظ.', 'error');
        }
      });
    }
  },

  async addClientReturn(clientId, projectId) {
    const [clients, projects] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc')
    ]);
    const clientOpts = clients.map(c => ({ v: c.id, l: c.name }));
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }));
    const fields = [
      { name: 'client_id', label: 'العميل *', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عميل --' }, ...clientOpts], default: clientId || '' },
      { name: 'project_id', label: 'المشروع *', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts], default: projectId || '' },
      { name: 'amount', label: 'المبلغ المرتجع *', type: 'number', req: true },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'description', label: 'الوصف', type: 'textarea' }
    ];
    UI.openModal('⬅️ مرتجع عميل', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      const project = projects.find(p => p.id === fd.get('project_id'));
      if (!project) { UI.toast('مشروع غير موجود', 'error'); return; }
      if (fd.get('client_id') && project.client_id !== fd.get('client_id')) { UI.toast('المشروع لا ينتمي للعميل المختار', 'error'); return; }
      await this.save('transactions', {
        type: 'client_return',
        amount: +fd.get('amount') || 0,
        client_id: project.client_id,
        party_id: project.client_id,
        party_name: project.client_name,
        party_type: 'client',
        project_id: project.id,
        project_name: project.name,
        date: fd.get('date') || new Date().toISOString().slice(0, 10),
        description: fd.get('description') || null
      });
      UI.toast('تم تسجيل المرتجع');
      App.loadTransactions();
      if (clientId) App.loadClient(clientId);
      if (projectId) App.loadProject(projectId);
    });
    if (clientId) {
      const overlay = document.querySelector('.modal-overlay');
      if (overlay) this._setupClientProjectCascade(overlay, projects, clientId, projectId);
    }
  },

  async addVendorSettlement(vendorId) {
    const [vendors, projects] = await Promise.all([
      API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc')
    ]);
    const vendorOpts = vendors.map(v => ({ v: v.id, l: v.name }));
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name + ' (' + p.client_name + ')' }));
    const fields = [
      { name: 'vendor_id', label: 'المورد *', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مورد --' }, ...vendorOpts], default: vendorId || '' },
      { name: 'project_id', label: 'المشروع *', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { name: 'amount', label: 'المبلغ *', type: 'number', req: true },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'description', label: 'الوصف', type: 'textarea' }
    ];
    UI.openModal('💰 تسديد متأخرات مورد', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
      const project = projects.find(p => p.id === fd.get('project_id'));
      if (!project) { UI.toast('مشروع غير موجود', 'error'); return; }
      await this._confirmOfficeVendorAsync(fd.get('vendor_id'), vendors);
      const amount = +fd.get('amount') || 0;
      await this.save('transactions', {
        type: 'vendor_settlement',
        amount,
        paid_amount: amount,
        payment_term: 'settlement',
        client_id: project.client_id,
        party_id: project.client_id,
        party_name: project.client_name,
        party_type: 'client',
        project_id: project.id,
        project_name: project.name,
        vendor_id: vendor ? vendor.id : null,
        vendor_name: vendor ? vendor.name : null,
        date: fd.get('date') || new Date().toISOString().slice(0, 10),
        description: fd.get('description') || null
      });
      UI.toast('تم تسجيل التسديد');
      App.loadTransactions(); App.loadVendors();
      if (vendorId) App.loadVendor(vendorId);
    });
  },

  async addVendorPayment(vendorId) {
    const vendors = await API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc');
    const vendorOpts = vendors.map(v => ({ v: v.id, l: v.name }));
    const paymentMethodOpts = [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const fields = [
      { name: 'vendor_id', label: 'المورد *', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مورد --' }, ...vendorOpts], default: vendorId || '' },
      { name: 'amount', label: 'المبلغ *', type: 'number', req: true, min: '0.01' },
      { name: 'payment_method', label: 'طريقة الدفع *', type: 'select', req: true, opts: [{ v: '', l: '-- اختر --' }, ...paymentMethodOpts], default: 'cash' },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'description', label: 'الوصف', type: 'textarea' }
    ];
    UI.openModal('💰 دفع للمورد', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
      if (!vendor) { UI.toast('مورد غير موجود', 'error'); return; }
      const amount = +fd.get('amount') || 0;
      if (amount <= 0) { UI.toast('المبلغ يجب أن يكون أكبر من صفر', 'error'); return; }
      await this.save('transactions', {
        type: 'vendor_settlement',
        amount,
        paid_amount: amount,
        payment_term: 'settlement',
        payment_method: fd.get('payment_method') || 'cash',
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        party_id: vendor.id,
        party_name: vendor.name,
        party_type: 'vendor',
        date: fd.get('date') || new Date().toISOString().slice(0, 10),
        description: fd.get('description') || null
      });
      UI.toast('تم تسجيل الدفع للمورد');
      App.loadVendors();
      if (vendorId) App.loadVendor(vendorId);
    });
  },

  async addOfficeExpense() {
    const [employees, sectors, vendors] = await Promise.all([
      API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc'),
      API.request('sectors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc')
    ]);
    const empOpts = employees.map(e => ({ v: e.id, l: e.name }));
    const sectorOpts = sectors.map(s => ({ v: s.id, l: s.name }));
    const vendorOpts = vendors.map(v => ({ v: v.id, l: v.name + (v.is_office ? ' (مكتب)' : '') }));
    const pmOpts = [{ v: '', l: '-- اختر --' }, { v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const cols = [
      { key: 'employee_id', label: 'الموظف', type: 'select', opts: [{ v: '', l: '-- اختر موظف --' }, ...empOpts] },
      { key: 'sector_id', label: 'التصنيف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر تصنيف --' }, ...sectorOpts] },
      { key: 'vendor_id', label: 'المورد (اختياري)', type: 'select', opts: [{ v: '', l: '-- اختر مورد --' }, ...vendorOpts] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'payment_method', label: 'الحساب', type: 'select', req: true, opts: pmOpts, default: 'cash' },
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('🏢 مصروف مكتبي (موظف)', cols, async (rows) => {
      const enriched = rows.map(r => {
        const emp = employees.find(e => e.id === r.employee_id);
        const sector = sectors.find(s => s.id === r.sector_id);
        const vendor = vendors.find(v => v.id === r.vendor_id);
        return { type: 'office_expense', amount: r.amount, payment_method: r.payment_method || 'cash', employee_id: r.employee_id, employee_name: emp ? emp.name : null, sector_id: r.sector_id, sector_name: sector ? sector.name : null, vendor_id: r.vendor_id || null, vendor_name: vendor ? vendor.name : null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      for (const r of enriched) await this._confirmOfficeVendorAsync(r.vendor_id, vendors);
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} مصروف مكتبي`);
      App.loadTransactions();
    });
  },

  addOwnerDeposit() {
    const pmOpts = [{ v: '', l: '-- اختر --' }, { v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const cols = [
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'payment_method', label: 'الحساب', type: 'select', req: true, opts: pmOpts, default: 'cash' },
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('👤 توريد صاحب المكتب', cols, async (rows) => {
      const enriched = rows.map(r => ({ type: 'owner_deposit', amount: r.amount, payment_method: r.payment_method || 'cash', date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null }));
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} توريد`);
      App.loadTransactions(); App.loadOffice();
    });
  },

  async addOfficeIncome() {
    const sectors = await API.request('sectors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc');
    const pmOpts = [{ v: '', l: '-- اختر --' }, { v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const cols = [
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'payment_method', label: 'الحساب', type: 'select', req: true, opts: pmOpts, default: 'cash' },
      { key: 'sector_id', label: 'التصنيف', type: 'select', opts: [{ v: '', l: '-- اختر تصنيف --' }, ...sectors.map(s => ({ v: s.id, l: s.name }))] },
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
      { key: 'description', label: 'البيان' }
    ];
    Spreadsheet.open('📈 إيراد مكتبي', cols, async (rows) => {
      const enriched = rows.map(r => {
        const sector = sectors.find(s => s.id === r.sector_id);
        return { type: 'income', amount: r.amount, payment_method: r.payment_method || 'cash', sector_id: r.sector_id || null, sector_name: sector ? sector.name : null, date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null };
      });
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} إيراد مكتبي`);
      App.loadOffice(); App.loadTransactions();
    }, { date: new Date().toISOString().slice(0, 10), payment_method: 'cash' });
  },

  addOwnerWithdrawal() {
    const pmOpts = [{ v: '', l: '-- اختر --' }, { v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const cols = [
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'payment_method', label: 'الحساب', type: 'select', req: true, opts: pmOpts, default: 'cash' },
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('🏃 سحب صاحب المكتب', cols, async (rows) => {
      const enriched = rows.map(r => ({ type: 'withdrawal', amount: r.amount, payment_method: r.payment_method || 'cash', date: r.date || new Date().toISOString().slice(0, 10), description: r.description || null }));
      await this.bulkSave('transactions', enriched);
      UI.toast(`تم حفظ ${rows.length} سحب`);
      App.loadTransactions();
    });
  },

  addOfficeTransfer() {
    const accountOpts = [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const fields = [
      { name: 'from_account', label: 'من الحساب *', type: 'select', req: true, opts: accountOpts, default: 'cash' },
      { name: 'to_account', label: 'إلى الحساب *', type: 'select', req: true, opts: accountOpts, default: 'bank' },
      { name: 'amount', label: 'المبلغ *', type: 'number', req: true },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'description', label: 'البيان' }
    ];
    UI.openModal('🔄 تحويل بين الحسابات', `<form>${UI.form(fields, { date: new Date().toISOString().slice(0, 10) })}</form>`, async (form) => {
      const fd = new FormData(form);
      const from = fd.get('from_account');
      const to = fd.get('to_account');
      if (from === to) { UI.toast('يجب اختيار حسابين مختلفين', 'error'); return; }
      await this.save('transactions', {
        type: 'transfer',
        payment_method: from,
        transfer_to: to,
        amount: +fd.get('amount') || 0,
        paid_amount: +fd.get('amount') || 0,
        date: fd.get('date'),
        description: fd.get('description') || null
      });
      UI.toast('تم التحويل');
      App.loadOffice();
    });
  },

  async addProjectSupervision() {
    const projects = await API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc');
    const projectOpts = projects.map(p => ({ v: p.id, l: p.name }));
    const cols = [
      { key: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projectOpts] },
      { key: 'amount', label: 'نسبة الإشراف', type: 'number', req: true },
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
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
    const txRows = await API.request('transactions', 'GET', null, '?select=*&id=eq.' + id + '&deleted_at=is.null');
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
        { name: 'date', label: 'التاريخ *', type: 'date', req: true },
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
        API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc'),
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
        { name: 'date', label: 'التاريخ *', type: 'date', req: true },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      const overlay = UI.openModal('تعديل مصروف مشروع', `<form>${UI.form(fields, { ...tx, client_id: tx.client_id || '', project_id: tx.project_id || '', vendor_id: tx.vendor_id || '', section_id: tx.section_id || '', item_id: tx.item_id || '', payment_method: tx.payment_method || '' })}</form>`, async (form) => {
        const fd = new FormData(form);
        const project = projects.find(p => String(p.id) === String(fd.get('project_id')));
        const vendor = vendors.find(v => String(v.id) === String(fd.get('vendor_id')));
        const section = workSections.find(s => String(s.id) === String(fd.get('section_id')));
        const item = workItems.find(i => String(i.id) === String(fd.get('item_id')));
        if (!project) { UI.toast('مشروع غير موجود', 'error'); return; }
        if (fd.get('client_id') && String(project.client_id) !== String(fd.get('client_id'))) { UI.toast('المشروع لا ينتمي للعميل المختار', 'error'); return; }
        const amount = +fd.get('amount') || 0;
        const paid_amount = amount;
        const payment_method = fd.get('payment_method') || null;
        // Project expenses are treated as fully paid; vendor balance is tracked separately
        const payment_term = 'immediate';
        // Auto-compute expense_category from section name
        const sectionName = section ? section.name : '';
        const expense_category = sectionName.includes('تصميم') ? 'design' : 'construction';
        await this._confirmOfficeVendorAsync(fd.get('vendor_id'), vendors);
        await this.save('transactions', { type: 'project_expense', expense_category, section_id: fd.get('section_id') || null, section_name: sectionName || null, item_id: fd.get('item_id') || null, item_name: item ? item.name : null, payment_method, payment_term, amount, paid_amount, client_id: project.client_id, party_id: project.client_id, party_name: project.client_name, party_type: 'client', project_id: fd.get('project_id'), project_name: project.name, vendor_id: fd.get('vendor_id') || null, vendor_name: vendor ? vendor.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
      this._setupClientProjectCascade(overlay, projects, tx.client_id, tx.project_id);
      this._setupSectionItemCascade(overlay, workSections, workItems, tx.section_id, tx.item_id);
    } else if (tx.type === 'office_expense') {
      const [employees, sectors, vendors] = await Promise.all([
        API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc'),
        API.request('sectors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
        API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc')
      ]);
      const pmOpts = [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
      const fields = [
        { name: 'employee_id', label: 'الموظف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر موظف --' }, ...employees.map(e => ({ v: e.id, l: e.name }))] },
        { name: 'sector_id', label: 'التصنيف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر تصنيف --' }, ...sectors.map(s => ({ v: s.id, l: s.name }))] },
        { name: 'vendor_id', label: 'المورد (اختياري)', type: 'select', opts: [{ v: '', l: '-- اختر مورد --' }, ...vendors.map(v => ({ v: v.id, l: v.name + (v.is_office ? ' (مكتب)' : '') }))] },
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'payment_method', label: 'الحساب', type: 'select', opts: pmOpts, default: tx.payment_method || 'cash' },
        { name: 'date', label: 'التاريخ *', type: 'date', req: true },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      UI.openModal('تعديل مصروف مكتبي', `<form>${UI.form(fields, { ...tx, employee_id: tx.employee_id || '', sector_id: tx.sector_id || '', vendor_id: tx.vendor_id || '' })}</form>`, async (form) => {
        const fd = new FormData(form);
        const emp = employees.find(e => e.id === fd.get('employee_id'));
        const sector = sectors.find(s => s.id === fd.get('sector_id'));
        const vendor = vendors.find(v => v.id === fd.get('vendor_id'));
        await this._confirmOfficeVendorAsync(fd.get('vendor_id'), vendors);
        await this.save('transactions', { type: 'office_expense', amount: +fd.get('amount') || 0, payment_method: fd.get('payment_method') || 'cash', employee_id: fd.get('employee_id'), employee_name: emp ? emp.name : null, sector_id: fd.get('sector_id'), sector_name: sector ? sector.name : null, vendor_id: fd.get('vendor_id') || null, vendor_name: vendor ? vendor.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
    } else if (tx.type === 'supervision') {
      const projects = await API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc');
      const fields = [
        { name: 'project_id', label: 'المشروع', type: 'select', req: true, opts: [{ v: '', l: '-- اختر مشروع --' }, ...projects.map(p => ({ v: p.id, l: p.name }))] },
        { name: 'amount', label: 'نسبة الإشراف', type: 'number', req: true },
        { name: 'date', label: 'التاريخ *', type: 'date', req: true },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      UI.openModal('تعديل إشراف مشروع', `<form>${UI.form(fields, { ...tx, project_id: tx.project_id || '' })}</form>`, async (form) => {
        const fd = new FormData(form);
        const project = projects.find(p => p.id === fd.get('project_id'));
        await this.save('transactions', { type: 'supervision', amount: +fd.get('amount') || 0, client_id: project ? project.client_id : null, party_id: project ? project.client_id : null, party_name: project ? project.client_name : null, party_type: 'client', project_id: fd.get('project_id'), project_name: project ? project.name : null, date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
        UI.toast('تم التحديث'); App.loadTransactions(); App.loadOffice();
      });
    } else {
      const pmOpts = [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
      const fields = [
        { name: 'amount', label: 'المبلغ', type: 'number', req: true },
        { name: 'payment_method', label: 'الحساب', type: 'select', opts: pmOpts, default: tx.payment_method || 'cash' },
        { name: 'date', label: 'التاريخ *', type: 'date', req: true },
        { name: 'description', label: 'الوصف', type: 'textarea' }
      ];
      const titleMap = { withdrawal: 'تعديل سحب صاحب المكتب', owner_deposit: 'تعديل توريد', custody_return: 'تعديل رد عهدة' };
      const title = titleMap[tx.type] || 'تعديل معاملة';
      UI.openModal(title, `<form>${UI.form(fields, tx)}</form>`, async (form) => {
        const fd = new FormData(form);
        await this.save('transactions', { amount: +fd.get('amount') || 0, payment_method: fd.get('payment_method') || 'cash', date: fd.get('date') || new Date().toISOString().slice(0, 10), description: fd.get('description') || null }, id);
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
      { key: 'email', label: 'البريد الإلكتروني' },
      { key: 'password', label: 'كلمة المرور *', req: true },
      { key: 'role', label: 'الدور', type: 'select', opts: [{ v: 'user', l: 'موظف' }, { v: 'admin', l: 'مدير' }] }
    ];
    Spreadsheet.open('إضافة مستخدمين', cols, async (rows) => {
      let created = 0, failed = 0;
      const failedDetails = [];
      for (const row of rows) {
        try {
          const username = String(row.username || '').trim();
          const name = String(row.name || '').trim();
          const rawEmail = String(row.email || '').trim();
          const password = String(row.password || '');
          const role = row.role || 'user';
          if (!username || !name || !password) {
            throw new Error('اسم المستخدم والاسم الكامل وكلمة المرور مطلوبة');
          }
          if (rawEmail && !rawEmail.includes('@')) {
            throw new Error('البريد الإلكتروني غير صالح');
          }
          const email = rawEmail ? rawEmail.toLowerCase() : Auth.toEmail(username);
          // Pre-check duplicates before calling the RPC.
          const [profileDup, authDup, emailDup] = await Promise.all([
            API.request('profiles', 'GET', null, `?select=id&username=eq.${encodeURIComponent(username)}`),
            API.rpc('auth_user_exists', { user_email: email }),
            rawEmail ? API.request('profiles', 'GET', null, `?select=id&email=eq.${encodeURIComponent(rawEmail.toLowerCase())}`) : Promise.resolve([])
          ]);
          if (profileDup.length) throw new Error('اسم المستخدم مستخدم مسبقاً');
          if (authDup) throw new Error('البريد الإلكتروني مستخدم مسبقاً');
          if (emailDup.length) throw new Error('البريد الإلكتروني مستخدم مسبقاً في الملفات الشخصية');

          // Server-side admin RPC creates the auth user, identity, and profile atomically.
          // No confirmation email is sent, so there is no rate limit.
          const result = await API.rpc('admin_create_auth_user', {
            user_email: email,
            user_password: password,
            user_meta: { name, username, email: rawEmail ? rawEmail.toLowerCase() : '', role }
          });
          if (result?.existing) throw new Error('البريد الإلكتروني مستخدم مسبقاً');
          if (!result?.id) throw new Error('فشل إنشاء المستخدم');
          created++;
        } catch (e) {
          failed++;
          failedDetails.push(`${row.username || '?'}: ${e.message || 'فشل'}`);
        }
      }
      if (failed) {
        UI.toast(`تم إنشاء ${created} وفشل ${failed}: ${failedDetails.join(' | ')}`, 'error');
      } else {
        UI.toast(`تم إنشاء ${created} مستخدم`);
      }
      App.loadUsers();
    }, {}, {}, 'none');
  },

  async editUser(id) {
    const profiles = await API.request('profiles', 'GET', null, `?id=eq.${id}`);
    const profile = profiles[0];
    if (!profile) {
      UI.toast('ملف المستخدم غير موجود', 'error');
      return;
    }
    const fields = [
      { name: 'username', label: 'اسم المستخدم', attr: 'readonly' },
      { name: 'name', label: 'الاسم الكامل', req: true },
      { name: 'email', label: 'البريد الإلكتروني' },
      { name: 'role', label: 'الدور', type: 'select', opts: [{ v: 'user', l: 'موظف' }, { v: 'admin', l: 'مدير' }] }
    ];
    const originalEmail = (profile.email || '').toLowerCase();
    UI.openModal('تعديل مستخدم', `<form>${UI.form(fields, { username: profile.username || '', name: profile.name || '', email: profile.email || '', role: profile.role || 'user' })}</form>`, async (form) => {
      const fd = new FormData(form);
      const newEmail = String(fd.get('email') || '').trim().toLowerCase();
      if (newEmail && !newEmail.includes('@')) {
        UI.toast('البريد الإلكتروني غير صالح', 'error'); return;
      }
      if (newEmail && newEmail !== originalEmail) {
        const dup = await API.request('profiles', 'GET', null, `?select=id&email=eq.${encodeURIComponent(newEmail)}`);
        if (dup.length) { UI.toast('البريد الإلكتروني مستخدم مسبقاً', 'error'); return; }
        const upd = await API.rpc('admin_update_auth_email', { p_user_id: id, p_email: newEmail });
        if (!upd?.success) { UI.toast(upd?.error || 'فشل تحديث البريد الإلكتروني', 'error'); return; }
      }
      await API.request('profiles', 'PATCH', { name: fd.get('name'), role: fd.get('role') }, `?id=eq.${id}`);
      UI.toast('تم التحديث'); App.loadUsers();
    });
  },

  async resetUserPassword(id) {
    const profiles = await API.request('profiles', 'GET', null, `?id=eq.${id}`);
    const profile = profiles[0];
    if (!profile) { UI.toast('ملف المستخدم غير موجود', 'error'); return; }
    UI.openModal('إعادة تعيين كلمة المرور', `<form><div class="form-group"><label>كلمة مرور جديدة *</label><input type="password" name="password" required minlength="6" dir="ltr" /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">إلغاء</button><button type="submit" class="btn btn-primary">حفظ</button></div></form>`, async (form) => {
      const password = form.querySelector('[name="password"]').value;
      if (!password || password.length < 6) { UI.toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return; }
      const res = await API.rpc('admin_reset_password', { p_user_id: id, p_password: password });
      if (!res?.success) { UI.toast(res?.error || 'فشل إعادة التعيين', 'error'); return; }
      UI.toast(`تم إعادة تعيين كلمة المرور لـ ${App.esc(profile.name || profile.username)}`);
    });
  },

  async emailNewPassword(id, email) {
    if (!email || !email.includes('@')) { UI.toast('لا يوجد بريد إلكتروني صالح لهذا المستخدم', 'error'); return; }
    UI.confirm(`إرسال كلمة مرور جديدة إلى ${App.esc(email)}؟`, async () => {
      try {
        const res = await API.rpc('admin_reset_password_email', { p_user_id: id, p_email: email });
        if (!res?.success) { UI.toast(res?.error || 'فشل إرسال البريد', 'error'); return; }
        UI.toast('تم إرسال كلمة المرور الجديدة إلى البريد الإلكتروني');
      } catch (e) { UI.toast(e.message || 'فشل إرسال البريد', 'error'); }
    });
  },

  // ─── MASTER DATA: SECTORS & ITEMS ───
  addSector() {
    const cols = [
      { key: 'name', label: 'اسم التصنيف *', req: true },
      { key: 'description', label: 'الوصف' }
    ];
    Spreadsheet.open('إضافة تصنيفات', cols, async (rows) => {
      const existing = await API.request('sectors', 'GET', null, '?select=name&deleted_at=is.null');
      const existingNames = new Set(existing.map(s => String(s.name || '').trim().toLowerCase()));
      const dupes = rows.filter(r => existingNames.has(String(r.name || '').trim().toLowerCase()));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} تصنيفات موجودة مسبقاً: ${dupes.map(d => d.name).join(', ')}`, 'error'); return; }
      await this.bulkSave('sectors', rows);
      UI.toast(`تم حفظ ${rows.length} تصنيف`);
      App.loadMasterData();
    }, {}, {}, 'none');
  },

  async editSector(id) {
    const rows = await API.request('sectors', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم التصنيف', req: true },
      { name: 'description', label: 'الوصف', type: 'textarea' }
    ];
    UI.openModal('تعديل تصنيف', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      const newName = String(fd.get('name') || '').trim();
      if (newName.toLowerCase() !== String(rows[0].name || '').trim().toLowerCase()) {
        const existing = await API.request('sectors', 'GET', null, `?select=id&name=ilike.${encodeURIComponent(newName)}&deleted_at=is.null`);
        if (existing.length) { UI.toast('⚠️ اسم التصنيف موجود مسبقاً', 'error'); return; }
      }
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
      const existing = await API.request('items', 'GET', null, '?select=name&deleted_at=is.null');
      const existingNames = new Set(existing.map(i => String(i.name || '').trim().toLowerCase()));
      const dupes = rows.filter(r => existingNames.has(String(r.name || '').trim().toLowerCase()));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} أصناف موجودة مسبقاً: ${dupes.map(d => d.name).join(', ')}`, 'error'); return; }
      await this.bulkSave('items', rows);
      UI.toast(`تم حفظ ${rows.length} صنف`);
      App.loadMasterData();
    }, {}, {}, 'none');
  },

  async editItem(id) {
    const rows = await API.request('items', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
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
      const newName = String(fd.get('name') || '').trim();
      if (newName.toLowerCase() !== String(rows[0].name || '').trim().toLowerCase()) {
        const existing = await API.request('items', 'GET', null, `?select=id&name=ilike.${encodeURIComponent(newName)}&deleted_at=is.null`);
        if (existing.length) { UI.toast('⚠️ اسم الصنف موجود مسبقاً', 'error'); return; }
      }
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


  // ─── WORK SECTIONS & ITEMS (أقسام وبنود المشاريع) ───
  addWorkSection() {
    const cols = [
      { key: 'name', label: 'اسم القسم *', req: true },
      { key: 'notes', label: 'ملاحظات' }
    ];
    Spreadsheet.open('إضافة أقسام المشاريع', cols, async (rows) => {
      const existing = await API.request('work_sections', 'GET', null, '?select=name&deleted_at=is.null');
      const existingNames = new Set(existing.map(s => String(s.name || '').trim().toLowerCase()));
      const dupes = rows.filter(r => existingNames.has(String(r.name || '').trim().toLowerCase()));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} أقسام موجودة مسبقاً: ${dupes.map(d => d.name).join(', ')}`, 'error'); return; }
      await this.bulkSave('work_sections', rows);
      UI.toast(`تم حفظ ${rows.length} قسم`);
      App.loadMasterData();
    }, {}, {}, 'none');
  },

  async editWorkSection(id) {
    const rows = await API.request('work_sections', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم القسم', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل قسم', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      const newName = String(fd.get('name') || '').trim();
      if (newName.toLowerCase() !== String(rows[0].name || '').trim().toLowerCase()) {
        const existing = await API.request('work_sections', 'GET', null, `?select=id&name=ilike.${encodeURIComponent(newName)}&deleted_at=is.null`);
        if (existing.length) { UI.toast('⚠️ اسم القسم موجود مسبقاً', 'error'); return; }
      }
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
      const existing = await API.request('work_items', 'GET', null, '?select=name,section_id&deleted_at=is.null');
      const dupes = rows.filter(r => existing.some(e => String(e.name || '').trim().toLowerCase() === String(r.name || '').trim().toLowerCase() && String(e.section_id) === String(r.section_id)));
      if (dupes.length) { UI.toast(`⚠️ ${dupes.length} بنود موجودة مسبقاً في نفس القسم`, 'error'); return; }
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
      API.request('work_items', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`),
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
      const newName = String(fd.get('name') || '').trim();
      const newSection = fd.get('section_id');
      const nameChanged = newName.toLowerCase() !== String(rows[0].name || '').trim().toLowerCase();
      const sectionChanged = String(newSection) !== String(rows[0].section_id);
      if (nameChanged || sectionChanged) {
        const existing = await API.request('work_items', 'GET', null, `?select=id&name=ilike.${encodeURIComponent(newName)}&section_id=eq.${newSection}&deleted_at=is.null`);
        if (existing.length) { UI.toast('⚠️ اسم البند موجود مسبقاً في هذا القسم', 'error'); return; }
      }
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
  },

  // ─── CLIENT & PROJECT STATEMENTS / BUDGET / TASKS ───
  async clientStatement(clientId) {
    const [client, projects] = await Promise.all([
      API.request('clients', 'GET', null, `?select=name&id=eq.${clientId}`),
      API.request('projects', 'GET', null, `?select=id,name&client_id=eq.${clientId}&deleted_at=is.null&order=created_at.desc`)
    ]);
    const clientName = client[0]?.name || 'عميل';
    if (!projects.length) { UI.toast('لا توجد مشاريع لهذا العميل', 'info'); return; }

    const projectsHtml = projects.map(p => `<label style="display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer"><input type="checkbox" class="stmt-project" value="${p.id}" checked style="width:18px;height:18px"> ${App.esc(p.name)}</label>`).join('');
    const filterHtml = `
      <div style="margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px">اختر المشاريع:</div>
        <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;background:var(--bg)">${projectsHtml}</div>
      </div>
      <button type="button" class="btn btn-primary" id="stmt-generate">عرض كشف الحساب</button>`;

    UI.openModal(`اختيار مشاريع لكشف حساب: ${App.esc(clientName)}`, filterHtml, null);

    document.getElementById('stmt-generate').addEventListener('click', async () => {
      const selected = Array.from(document.querySelectorAll('.stmt-project:checked')).map(cb => cb.value);
      if (!selected.length) { UI.toast('اختر مشروعاً واحداً على الأقل', 'error'); return; }
      UI.closeModal();

      const [txs, cbRows, pbRows] = await Promise.all([
        API.fetchAll('transactions', `?select=*,projects(name)&client_id=eq.${clientId}&deleted_at=is.null&order=date.desc`),
        API.request('client_balances', 'GET', null, `?select=*&client_id=eq.${clientId}`),
        API.request('project_balances', 'GET', null, `?select=*&client_id=eq.${clientId}`)
      ]);
      const cb = cbRows[0] || {};
      const pbByProject = Object.fromEntries(pbRows.map(b => [b.project_id, b]));

      const selectedSet = new Set(selected);
      const chapters = projects.filter(p => selectedSet.has(p.id)).map(p => {
        const pTxs = txs.filter(t => String(t.project_id) === String(p.id));
        let dep = 0, exp = 0;
        const rows = pTxs.map((t, i) => {
          const amt = +t.amount || 0;
          const paid = +t.paid_amount || amt;
          if (t.type === 'project_deposit') dep += amt;
          if (t.type === 'client_return') dep -= amt;
          if (['project_expense','vendor_settlement'].includes(t.type)) exp += paid;
          return {
            i: i + 1, date: t.date || '-', type: App.fmtTxType(t.type),
            desc: t.description || '-', amount: amt
          };
        });
        const pb = pbByProject[p.id] || {};
        const sup = pb.supervision || 0;
        if (sup > 0) rows.push({ i: '-', date: '-', type: App.fmtTxType('supervision'), desc: 'رسوم إشراف', amount: sup, isSupervision: true });
        return { project: p, rows, dep, exp, sup };
      });

      const totalDep = chapters.reduce((s, c) => s + c.dep, 0);
      const totalExp = chapters.reduce((s, c) => s + c.exp, 0);
      const totalSup = chapters.reduce((s, c) => s + (c.sup || 0), 0);
      const balance = totalDep - totalExp - totalSup;

      const kpi = (label, value, color) => `<div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">${label}</div><div class="kpi-value" style="color:${color}">${App.fmtMoney(value)}</div></div>`;
      const clientSummary = `<div class="stmt-summary">
        <h3 style="margin:0 0 12px">ملخص العميل: ${App.esc(clientName)}</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          ${kpi('إجمالي الإيداعات', totalDep, 'var(--green)')}
          ${kpi('إجمالي المصروفات', totalExp, 'var(--red)')}
          ${kpi('إجمالي الإشراف', totalSup, 'var(--gold)')}
          ${kpi('الرصيد', balance, 'var(--text)')}
        </div>
      </div>`;

      const chapterHtml = chapters.map(c => {
        const rowsHtml = c.rows.length
          ? App.table(['#', 'التاريخ', 'النوع', 'البيان', 'المبلغ'], c.rows.map(r => [r.i, r.date, r.type, App.esc(r.desc), App.fmtMoney(r.amount)]))
          : '<p style="color:var(--text3)">لا توجد معاملات</p>';
        return `<div class="stmt-chapter">
          <h4 style="margin:16px 0 8px;color:var(--gold)">📁 ${App.esc(c.project.name)}</h4>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
            ${kpi('إيداعات', c.dep, 'var(--green)')}
            ${kpi('مصروفات', c.exp, 'var(--red)')}
            ${kpi('إشراف', c.sup || 0, 'var(--gold)')}
            ${kpi('رصيد', c.dep - c.exp - (c.sup || 0), 'var(--text)')}
          </div>
          ${rowsHtml}
        </div>`;
      }).join('');

      const logoHtml = `<div class="print-logo" style="display:none;text-align:center;margin-bottom:16px"><img src="logo.png" alt="logo" style="max-height:60px"></div>`;
      const actionsHtml = `<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="Crud._exportClientStatement('${clientId}')">📥 تحميل Excel</button>
        <button class="btn btn-sm btn-secondary" onclick="Crud._printClientStatement('${clientId}')">🖨️ طباعة / PDF</button>
      </div>`;

      this._clientStatementData = this._clientStatementData || {};
      this._clientStatementData[clientId] = { clientName, chapters, totalDep, totalExp };

      UI.openModal(`كشف حساب العميل: ${App.esc(clientName)}`, logoHtml + actionsHtml + clientSummary + chapterHtml, null);
    });
  },

  _exportClientStatement(clientId) {
    const data = this._clientStatementData?.[clientId];
    if (!data) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    if (typeof XLSX === 'undefined') { UI.toast('مكتبة Excel لم يتم تحميلها', 'error'); return; }

    const sheet = [
      ['كشف حساب العميل: ' + data.clientName],
      ['إجمالي الإيداعات', data.totalDep],
      ['إجمالي المصروفات', data.totalExp],
      ['الرصيد', data.totalDep - data.totalExp],
      []
    ];
    data.chapters.forEach(c => {
      sheet.push(['المشروع: ' + c.project.name], ['إيداعات', c.dep], ['مصروفات', c.exp], ['رصيد', c.dep - c.exp]);
      sheet.push(['#', 'التاريخ', 'النوع', 'البيان', 'المبلغ']);
      c.rows.forEach(r => sheet.push([r.i, r.date, r.type, r.desc, r.amount]));
      sheet.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب العميل');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف-حساب-عميل-${data.clientName}-${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  _printClientStatement(clientId) {
    const data = this._clientStatementData?.[clientId];
    if (!data) { UI.toast('لا توجد بيانات للطباعة', 'error'); return; }
    App.printReport(`كشف-حساب-عميل-${data.clientName}`);
  },

  async projectStatement(projectId) {
    const project = await API.request('projects', 'GET', null, `?select=name,client_id,client_name&id=eq.${projectId}&deleted_at=is.null`);
    const p = project[0];
    if (!p) return UI.toast('المشروع غير موجود', 'error');
    const name = p.name || 'مشروع';

    const [txs, pbRows] = await Promise.all([
      API.fetchAll('transactions', `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=date.desc`),
        API.request('project_balances', 'GET', null, `?select=*&project_id=eq.${projectId}`)
      ]);
      const pb = pbRows[0] || {};
      const supervision = pb.supervision || 0;

      let totalDep = 0, totalExp = 0;
      const rows = [];
      txs.forEach((t, i) => {
        const amt = +t.amount || 0;
        const paid = +t.paid_amount || amt;
        if (t.type === 'project_deposit') totalDep += amt;
        else if (t.type === 'client_return') totalDep -= amt;
        else if (['project_expense','vendor_settlement'].includes(t.type)) totalExp += paid;
        rows.push([i+1, t.date || '-', App.fmtTxType(t.type), App.esc(t.description || '-'), App.fmtMoney(amt)]);
      });
      if (supervision > 0) rows.push(['-', '-', App.fmtTxType('supervision'), App.esc('رسوم إشراف'), App.fmtMoney(supervision)]);
      const balance = totalDep - totalExp - supervision;
      const summary = `<h4 style="margin:0 0 8px">تفاصيل المشروع: ${App.esc(name)}</h4>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي الإيداعات</div><div class="kpi-value" style="color:var(--green)">${App.fmtMoney(totalDep)}</div></div>
          <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي المصروفات</div><div class="kpi-value" style="color:var(--red)">${App.fmtMoney(totalExp)}</div></div>
          <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإشراف</div><div class="kpi-value" style="color:var(--gold)">${App.fmtMoney(supervision)}</div></div>
          <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">رصيد المشروع</div><div class="kpi-value">${App.fmtMoney(balance)}</div></div>
        </div>`;
      const table = rows.length ? App.table(['#', 'التاريخ', 'النوع', 'البيان', 'المبلغ'], rows) : '<p style="color:var(--text3)">لا توجد معاملات</p>';

      const logoHtml = `<div class="print-logo" style="display:none;text-align:center;margin-bottom:16px"><img src="logo.png" alt="logo" style="max-height:60px"></div>`;
      const actionsHtml = `<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="Crud._exportProjectStatement('${projectId}')">📥 تحميل Excel</button>
        <button class="btn btn-sm btn-secondary" onclick="Crud._printProjectStatement('${projectId}')">🖨️ طباعة / PDF</button>
      </div>`;
      this._projectStatementData = this._projectStatementData || {};
      this._projectStatementData[projectId] = { rows, totalDep, totalExp, name };

      UI.openModal(`كشف حساب مشروع: ${App.esc(name)}`, logoHtml + actionsHtml + summary + table, null);
  },

  _exportProjectStatement(projectId) {
    const data = this._projectStatementData?.[projectId];
    if (!data) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    if (typeof XLSX === 'undefined') { UI.toast('مكتبة Excel لم يتم تحميلها', 'error'); return; }

    const sheet = [['كشف حساب مشروع: ' + data.name], []];
    sheet.push(
      ['تفاصيل المشروع: ' + data.name],
      ['#', 'التاريخ', 'النوع', 'البيان', 'المبلغ'],
      ...data.rows.map((row, i) => [i+1, row[1], row[2], row[3], row[4]]),
      ['', '', '', 'إجمالي الإيداعات', data.totalDep],
      ['', '', '', 'إجمالي المصروفات', data.totalExp],
      ['', '', '', 'الرصيد', data.totalDep - data.totalExp]
    );
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب المشروع');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف-حساب-مشروع-${data.name}-${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  _printProjectStatement(projectId) {
    const data = this._projectStatementData?.[projectId];
    if (!data) { UI.toast('لا توجد بيانات للطباعة', 'error'); return; }
    App.printReport(`كشف-حساب-مشروع-${data.name}`);
  },

  async projectBudget(projectId) {
    const [project, txs, rates] = await Promise.all([
      API.request('projects', 'GET', null, `?select=*&id=eq.${projectId}&deleted_at=is.null`),
      API.fetchAll('transactions', `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=date.desc`),
      API.request('project_section_supervision', 'GET', null, `?select=section_id,percentage&project_id=eq.${projectId}`)
    ]);
    const p = project[0];
    if (!p) return UI.toast('المشروع غير موجود', 'error');
    const rateMap = Object.fromEntries(rates.map(r => [r.section_id, +r.percentage || 0]));
    const isProjectExpense = t => ['project_expense', 'vendor_settlement'].includes(t.type);
    const deposits = txs.filter(t => t.type === 'project_deposit').reduce((s, t) => s + (+t.amount || 0), 0);
    const expenses = txs.filter(isProjectExpense).reduce((s, t) => s + (+t.amount || 0), 0);
    const constr = txs.filter(t => isProjectExpense(t) && t.expense_category !== 'design').reduce((s, t) => s + (+t.amount || 0), 0);
    const design = txs.filter(t => isProjectExpense(t) && t.expense_category === 'design').reduce((s, t) => s + (+t.amount || 0), 0);
    const supervision = txs.filter(t => isProjectExpense(t) && t.expense_category !== 'design')
      .reduce((s, t) => s + ((+t.amount || 0) * (rateMap[t.section_id] ?? p.supervision_percentage ?? 0) / 100), 0);
    const balance = deposits - expenses - supervision;
    const html = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي الإيداعات</div><div class="kpi-value" style="color:var(--green)">${App.fmtMoney(deposits)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي المصروفات</div><div class="kpi-value" style="color:var(--red)">${App.fmtMoney(expenses)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">مصروفات الإنشاء</div><div class="kpi-value">${App.fmtMoney(constr)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">مصروفات التصميم</div><div class="kpi-value">${App.fmtMoney(design)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الإشراف</div><div class="kpi-value" style="color:var(--gold)">${App.fmtMoney(supervision)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الرصيد</div><div class="kpi-value">${App.fmtMoney(balance)}</div></div>
    </div>`;
    const downloadBtn = `<div style="margin-bottom:12px"><button class="btn btn-sm btn-secondary" onclick="Crud._exportProjectBudget('${projectId}')">📥 تحميل Excel</button></div>`;
    this._projectBudgetData = this._projectBudgetData || {};
    this._projectBudgetData[projectId] = { name: p.name, deposits, expenses, constr, design, supervision, balance, supervisionPercentage: '-' };

    UI.openModal(`📊 ميزانية مشروع: ${App.esc(p.name)}`, downloadBtn + html, null);
  },

  _exportProjectBudget(projectId) {
    const data = this._projectBudgetData?.[projectId];
    if (!data) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    if (typeof XLSX === 'undefined') { UI.toast('مكتبة Excel لم يتم تحميلها', 'error'); return; }

    const sheet = [
      ['ميزانية مشروع: ' + data.name],
      ['البند', 'المبلغ'],
      ['إجمالي الإيداعات', data.deposits],
      ['إجمالي المصروفات', data.expenses],
      ['مصروفات الإنشاء', data.constr],
      ['مصروفات التصميم', data.design],
      ['الإشراف (' + data.supervisionPercentage + '%)', data.supervision],
      ['الرصيد', data.balance]
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws['!cols'] = [{ wch: 30 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ميزانية المشروع');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ميزانية-مشروع-${data.name}-${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async loadProjectTasks(projectId) {
    const [project, tasks] = await Promise.all([
      API.request('projects', 'GET', null, `?select=name&id=eq.${projectId}`),
      API.request('project_tasks', 'GET', null, `?select=*&project_id=eq.${projectId}&deleted_at=is.null&order=due_date.asc`)
    ]);
    const name = project[0]?.name || 'مشروع';
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
    const rows = tasks.map((t, i) => [
      i+1, App.esc(t.name), App.esc(t.assignee || '-'), t.start_date || '-', t.due_date || '-', {html: statusBadge(t.status)}, {html: priorityBadge(t.priority)},
      {html: `<button class="btn btn-sm btn-secondary" onclick="Crud.editProjectTask('${t.id}')">تعديل</button> <button class="btn btn-sm btn-red" onclick="Crud.delProjectTask('${t.id}')">حذف</button>`}
    ]);
    const table = rows.length ? App.table(['#', 'المهمة', 'المسؤول', 'تاريخ البدء', 'تاريخ الاستحقاق', 'الحالة', 'الأولوية', ''], rows) : '<p style="color:var(--text3)">لا توجد مهام مسجلة</p>';
    const addBtn = `<div style="margin-bottom:12px"><button class="btn btn-primary" onclick="Crud.addProjectTask('${projectId}')">➕ إضافة مهمة</button></div>`;
    UI.openModal(`📋 مهام مشروع: ${App.esc(name)}`, addBtn + table, null);
  },

  addProjectTask(projectId) {
    const fields = [
      { name: 'name', label: 'اسم المهمة *', req: true },
      { name: 'assignee', label: 'المسؤول' },
      { name: 'start_date', label: 'تاريخ البدء *', type: 'date', req: true },
      { name: 'due_date', label: 'تاريخ الاستحقاق *', type: 'date', req: true },
      { name: 'status', label: 'الحالة', type: 'select', opts: [{v:'pending',l:'معلق'},{v:'in_progress',l:'قيد التنفيذ'},{v:'done',l:'منتهي'}] },
      { name: 'priority', label: 'الأولوية', type: 'select', opts: [{v:'low',l:'منخفض'},{v:'medium',l:'متوسط'},{v:'high',l:'عالي'}] },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('إضافة مهمة', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('project_tasks', {
        project_id: projectId,
        name: fd.get('name'),
        assignee: fd.get('assignee') || null,
        start_date: fd.get('start_date') || null,
        due_date: fd.get('due_date') || null,
        status: fd.get('status') || 'pending',
        priority: fd.get('priority') || 'medium',
        notes: fd.get('notes') || null
      });
      UI.toast('تم حفظ المهمة');
      this.loadProjectTasks(projectId);
    });
  },

  async editProjectTask(id) {
    const rows = await API.request('project_tasks', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const fields = [
      { name: 'name', label: 'اسم المهمة *', req: true },
      { name: 'assignee', label: 'المسؤول' },
      { name: 'start_date', label: 'تاريخ البدء *', type: 'date', req: true },
      { name: 'due_date', label: 'تاريخ الاستحقاق *', type: 'date', req: true },
      { name: 'status', label: 'الحالة', type: 'select', opts: [{v:'pending',l:'معلق'},{v:'in_progress',l:'قيد التنفيذ'},{v:'done',l:'منتهي'}] },
      { name: 'priority', label: 'الأولوية', type: 'select', opts: [{v:'low',l:'منخفض'},{v:'medium',l:'متوسط'},{v:'high',l:'عالي'}] },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل مهمة', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      await this.save('project_tasks', {
        name: fd.get('name'),
        assignee: fd.get('assignee') || null,
        start_date: fd.get('start_date') || null,
        due_date: fd.get('due_date') || null,
        status: fd.get('status') || 'pending',
        priority: fd.get('priority') || 'medium',
        notes: fd.get('notes') || null
      }, id);
      UI.toast('تم التحديث');
      if (App.screen === 'tasks') App.loadTasks();
      else this.loadProjectTasks(rows[0].project_id);
    });
  },

  delProjectTask(id) {
    UI.confirm('هل أنت متأكد من حذف هذه المهمة؟', async () => {
      const rows = await API.request('project_tasks', 'GET', null, `?select=project_id&id=eq.${id}&deleted_at=is.null`);
      await this.softDelete('project_tasks', id);
      UI.toast('تم الحذف');
      if (App.screen === 'tasks') App.loadTasks();
      else if (rows.length) this.loadProjectTasks(rows[0].project_id);
    });
  },

  // ─── VENDOR STATEMENT & PURCHASES ───
  async vendorStatement(vendorId) {
    const [vendor, txs, procs] = await Promise.all([
      API.request('vendors', 'GET', null, `?select=name&id=eq.${vendorId}`),
      API.fetchAll('transactions', `?select=*,projects(name)&vendor_id=eq.${vendorId}&type=in.(project_expense,vendor_settlement)&deleted_at=is.null&order=date.desc`),
      API.fetchAll('procurements', `?select=*,projects(name)&vendor_id=eq.${vendorId}&deleted_at=is.null&order=date.desc`)
    ]);
    const name = vendor[0]?.name || 'مورد';

    const balHtml = (bal) => {
      const color = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--blue)' : 'var(--green)';
      const label = bal > 0 ? 'مستحق' : bal < 0 ? 'زيادة' : 'تسوية';
      return `<span style="color:${color};font-weight:700;font-size:12px">${App.fmtMoney(Math.abs(bal))}</span> <span style="font-size:10px;color:var(--text3)">${label}</span>`;
    };

    const allRows = [];
    procs.forEach((p, idx) => {
      const amount = +p.total_price || 0;
      const paid = +p.paid_amount || 0;
      allRows.push({
        i: idx + 1, date: p.date || '-', item: App.esc(p.item_name || '-'), section: App.esc(p.section_name || '-'), desc: App.esc(p.description || '-'),
        amount, paid, balance: amount - paid,
        project_id: p.project_id || '_none', project_name: p.projects?.name || p.project_name || 'بدون مشروع'
      });
    });
    txs.forEach((t, idx) => {
      const amount = +t.amount || 0;
      const paid = +t.paid_amount || 0;
      allRows.push({
        i: idx + 1, date: t.date || '-', item: App.esc(t.item_name || '-'), section: App.esc(t.section_name || '-'), desc: App.esc(t.description || '-'),
        amount, paid, balance: amount - paid,
        project_id: t.project_id || '_none', project_name: t.projects?.name || t.project_name || 'بدون مشروع'
      });
    });

    const byProject = {};
    allRows.forEach(r => {
      if (!byProject[r.project_id]) byProject[r.project_id] = { projectName: r.project_name, rows: [] };
      byProject[r.project_id].rows.push(r);
    });

    const chapters = Object.values(byProject).map(ch => {
      const owed = ch.rows.reduce((s, r) => s + r.amount, 0);
      const paid = ch.rows.reduce((s, r) => s + r.paid, 0);
      return { projectName: ch.projectName, rows: ch.rows, owed, paid, balance: owed - paid };
    });

    const totalOwed = chapters.reduce((s, c) => s + c.owed, 0);
    const totalPaid = chapters.reduce((s, c) => s + c.paid, 0);
    const netBalance = totalOwed - totalPaid;
    const balColor = netBalance > 0 ? 'var(--red)' : netBalance < 0 ? 'var(--blue)' : 'var(--green)';
    const balLabel = netBalance > 0 ? 'مستحق' : netBalance < 0 ? 'زيادة مدفوعة' : 'تسوية';

    const kpi = (label, value, color) => `<div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">${label}</div><div class="kpi-value" style="color:${color}">${App.fmtMoney(value)}</div></div>`;
    const summary = `<div class="stmt-summary"><h3 style="margin:0 0 12px">ملخص المورد: ${App.esc(name)}</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        ${kpi('إجمالي المستحق', totalOwed, 'var(--red)')}
        ${kpi('إجمالي المدفوع', totalPaid, 'var(--green)')}
        ${kpi('الرصيد (' + balLabel + ')', Math.abs(netBalance), balColor)}
      </div></div>`;

    const chapterHtml = chapters.map(c => {
      const rowsHtml = c.rows.length
        ? App.table(['#', 'التاريخ', 'الصنف', 'القسم', 'البيان', 'المبلغ', 'المدفوع', 'الباقي'], c.rows.map(r => [r.i, r.date, r.item, r.section, r.desc, App.fmtMoney(r.amount), App.fmtMoney(r.paid), {html: balHtml(r.balance)}]))
        : '<p style="color:var(--text3)">لا توجد بيانات</p>';
      return `<div class="stmt-chapter">
        <h4 style="margin:16px 0 8px;color:var(--gold)">📁 ${App.esc(c.projectName)}</h4>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
          ${kpi('مستحق', c.owed, 'var(--red)')}
          ${kpi('مدفوع', c.paid, 'var(--green)')}
          ${kpi('باقي', c.balance, 'var(--text)')}
        </div>
        ${rowsHtml}
      </div>`;
    }).join('');

    const logoHtml = `<div class="print-logo" style="display:none;text-align:center;margin-bottom:16px"><img src="logo.png" alt="logo" style="max-height:60px"></div>`;
    const actionsHtml = `<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" onclick="Crud._exportVendorStatement('${vendorId}')">📥 تحميل Excel</button>
      <button class="btn btn-sm btn-secondary" onclick="Crud._printVendorStatement('${vendorId}')">🖨️ طباعة / PDF</button>
    </div>`;

    this._vendorStatementData = this._vendorStatementData || {};
    this._vendorStatementData[vendorId] = { vendorName: name, chapters, totalOwed, totalPaid, netBalance };

    UI.openModal(`كشف حساب مورد: ${App.esc(name)}`, logoHtml + actionsHtml + summary + (chapterHtml || '<p style="color:var(--text3)">لا توجد بيانات</p>'), null);
  },

  _exportVendorStatement(vendorId) {
    const data = this._vendorStatementData?.[vendorId];
    if (!data) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    if (typeof XLSX === 'undefined') { UI.toast('مكتبة Excel لم يتم تحميلها', 'error'); return; }

    const sheet = [
      ['كشف حساب مورد: ' + data.vendorName],
      ['إجمالي المستحق', data.totalOwed],
      ['إجمالي المدفوع', data.totalPaid],
      ['الرصيد', data.netBalance],
      []
    ];
    data.chapters.forEach(c => {
      sheet.push(['المشروع: ' + c.projectName], ['مستحق', c.owed], ['مدفوع', c.paid], ['باقي', c.balance]);
      sheet.push(['#', 'التاريخ', 'الصنف', 'القسم', 'البيان', 'المبلغ', 'المدفوع', 'الباقي']);
      c.rows.forEach(r => sheet.push([r.i, r.date, r.item, r.section, r.desc, r.amount, r.paid, r.balance]));
      sheet.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب المورد');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف-حساب-مورد-${data.vendorName}-${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  _printVendorStatement(vendorId) {
    const data = this._vendorStatementData?.[vendorId];
    if (!data) { UI.toast('لا توجد بيانات للطباعة', 'error'); return; }
    App.printReport(`كشف-حساب-مورد-${data.vendorName}`);
  },

  async vendorPurchases(vendorId) {
    const [vendor, procs] = await Promise.all([
      API.request('vendors', 'GET', null, `?select=name&id=eq.${vendorId}`),
      API.request('procurements', 'GET', null, `?select=*,projects(name)&vendor_id=eq.${vendorId}&deleted_at=is.null&order=date.desc&limit=200`)
    ]);
    const name = vendor[0]?.name || 'مورد';

    const balHtml = (bal) => {
      const color = bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--blue)' : 'var(--green)';
      const label = bal > 0 ? 'مستحق' : bal < 0 ? 'زيادة' : 'تسوية';
      return `<span style="color:${color};font-weight:700;font-size:12px">${App.fmtMoney(Math.abs(bal))}</span> <span style="font-size:10px;color:var(--text3)">${label}</span>`;
    };

    const procData = procs.map((p, i) => {
      const isNew = p.payment_term !== undefined && p.payment_term !== null;
      const total = +p.total_price || 0;
      const paid = isNew ? (+p.paid_amount || 0) : total;
      return {
        i: i+1, date: p.date || '-', section: p.section_name || '-', item: p.item_name || '-',
        qty: p.quantity || 1, unitPrice: +p.unit_price || 0,
        total, paid, balance: total - paid,
        project: p.projects?.name || p.project_name || '-'
      };
    });
    const total = procData.reduce((s, p) => s + p.total, 0);
    const totalPaid = procData.reduce((s, p) => s + p.paid, 0);
    const netBalance = total - totalPaid;
    const balColor = netBalance > 0 ? 'var(--red)' : netBalance < 0 ? 'var(--blue)' : 'var(--green)';
    const balLabel = netBalance > 0 ? 'مستحق' : netBalance < 0 ? 'زيادة مدفوعة' : 'تسوية';

    const rows = procData.map(p => [p.i, p.date, App.esc(p.section), App.esc(p.item), p.qty, App.fmtMoney(p.unitPrice), App.fmtMoney(p.total), App.fmtMoney(p.paid), {html: balHtml(p.balance)}, App.esc(p.project), {html: UI.actions(procs[p.i-1].id, 'Crud.editProcurement', 'Crud.delProcurement', Auth.can('vendors', 'edit'), Auth.can('vendors', 'delete'))}]);
    const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">إجمالي المشتريات</div><div class="kpi-value" style="color:var(--red)">${App.fmtMoney(total)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المدفوع</div><div class="kpi-value" style="color:var(--green)">${App.fmtMoney(totalPaid)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">الرصيد (${balLabel})</div><div class="kpi-value" style="color:${balColor}">${App.fmtMoney(Math.abs(netBalance))}</div></div>
    </div>`;
    const table = rows.length ? App.table(['#', 'التاريخ', 'القسم', 'البند', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'المدفوع', 'الباقي', 'المشروع', ''], rows) : '<p style="color:var(--text3)">لا توجد مشتريات</p>';

    const actionsHtml = `<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
      ${Auth.can('vendors', 'add') ? `<button class="btn btn-sm btn-primary" onclick="Crud.addProcurement('${vendorId}')">+ إضافة مشتريات</button>` : ''}
      <button class="btn btn-sm btn-secondary" onclick="Crud._exportVendorPurchases('${vendorId}')">📥 تحميل Excel</button>
      <button class="btn btn-sm btn-secondary" onclick="Crud._printVendorPurchases('${vendorId}')">🖨️ طباعة / PDF</button>
    </div>`;
    this._vendorPurchasesData = this._vendorPurchasesData || {};
    this._vendorPurchasesData[vendorId] = { procData, total, totalPaid, netBalance, name };

    UI.openModal(`💰 مشتريات مورد: ${App.esc(name)}`, actionsHtml + summary + table, null);
  },

  _exportVendorPurchases(vendorId) {
    const data = this._vendorPurchasesData?.[vendorId];
    if (!data) { UI.toast('لا توجد بيانات للتصدير', 'error'); return; }
    if (typeof XLSX === 'undefined') { UI.toast('مكتبة Excel لم يتم تحميلها', 'error'); return; }

    const sheet = [
      ['مشتريات مورد: ' + data.name],
      ['#', 'التاريخ', 'القسم', 'البند', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'المدفوع', 'الباقي', 'المشروع'],
      ...data.procData.map(p => [p.i, p.date, p.section, p.item, p.qty, p.unitPrice, p.total, p.paid, p.balance, p.project]),
      ['', '', '', '', '', '', 'الإجمالي', data.total, data.totalPaid, data.netBalance]
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المشتريات');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `مشتريات-مورد-${data.name}-${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  _printVendorPurchases(vendorId) {
    const data = this._vendorPurchasesData?.[vendorId];
    if (!data) { UI.toast('لا توجد بيانات للطباعة', 'error'); return; }
    App.printReport(`مشتريات-مورد-${data.name}`);
  },

  // ─── CUSTODY ───
  async addCustody(employeeId) {
    const employees = await API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc');
    const pmOpts = [{v:'',l:'-- اختر --'},{v:'cash',l:'نقدي'},{v:'bank',l:'بنكي'}];
    const cols = [
      { key: 'employee_id', label: 'الموظف', type: 'select', req: true, opts: [{v:'',l:'-- اختر موظف --'}, ...employees.map(e => ({v:e.id,l:e.name}))] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'payment_method', label: 'الحساب', type: 'select', req: true, opts: pmOpts, default: 'cash' },
      { key: 'date', label: 'التاريخ', type: 'date', req: true },
      { key: 'notes', label: 'ملاحظات' }
    ];
    const defaults = { date: new Date().toISOString().slice(0,10) };
    if (employeeId) defaults.employee_id = employeeId;
    Spreadsheet.open('💼 إضافة عهدة نقدية', cols, async (rows) => {
      for (const r of rows) {
        const emp = employees.find(e => e.id === r.employee_id);
        const amount = +r.amount || 0;
        const date = r.date || new Date().toISOString().slice(0, 10);
        if (!r.employee_id) { UI.toast('الموظف مطلوب', 'error'); throw new Error('missing employee'); }
        const custodyResult = await this.save('custody_records', {
          custody_type: 'office',
          employee_id: r.employee_id || null,
          employee_name: emp ? emp.name : null,
          amount,
          date,
          notes: r.notes || null,
          status: 'active'
        });
        const custodyId = Array.isArray(custodyResult) ? custodyResult[0]?.id : custodyResult?.id;
        if (custodyId && amount > 0) {
          const txResult = await this.save('transactions', {
            type: 'office_expense',
            amount,
            paid_amount: amount,
            payment_method: r.payment_method || 'cash',
            date,
            description: 'عهدة نقدية للموظف ' + (emp ? emp.name : ''),
            employee_id: r.employee_id || null,
            employee_name: emp ? emp.name : null,
            sector_name: 'عهدة نقدية'
          });
          const txId = Array.isArray(txResult) ? txResult[0]?.id : txResult?.id;
          if (txId) {
            try { await API.request('custody_records', 'PATCH', { advance_transaction_id: txId }, `?id=eq.${custodyId}`); }
            catch (e) { /* link failure is non-fatal */ }
          }
        }
      }
      UI.toast(`تم حفظ ${rows.length} عهدة`);
      App.loadOffice();
    }, defaults);
  },

  async addOfficeCustody() {
    await this.addCustody('');
  },

  async addOfficeCustodyExpense() {
    const custodies = await API.request('custody_records', 'GET', null, "?select=*,employees(name)&status=in.(active,partial)&deleted_at=is.null&order=date.desc");
    if (!custodies.length) { UI.toast('لا توجد عهد مفتوحة لإضافة مصروف', 'error'); return; }
    const custodyOpts = custodies.map(c => ({ v: c.id, l: `${c.employees?.name || c.employee_name || '-'} — ${App.fmtMoney(c.amount)} (متبقي: ${App.fmtMoney(c.remaining_balance || 0)})` }));
    const typeOpts = [{ v: 'office', l: 'مكتب' }, { v: 'project', l: 'مشروع' }];
    const fields = [
      { name: 'custody_id', label: 'العهدة *', type: 'select', req: true, opts: [{ v: '', l: '-- اختر عهدة --' }, ...custodyOpts] },
      { name: 'expense_type', label: 'نوع المصروف *', type: 'select', req: true, opts: [{ v: '', l: '-- اختر نوع --' }, ...typeOpts], default: 'office' }
    ];
    const openSheet = async (custodyId, expenseType) => {
      const c = custodies.find(x => x.id === custodyId);
      if (!custodyId || !c) return;
      if (!expenseType) return;
      const available = +c.remaining_balance || 0;
      if (available <= 0) { UI.toast('لا يوجد رصيد متاح لهذه العهدة', 'error'); return; }
      UI.closeModal();
      if (expenseType === 'project') await this._openProjectCustodyExpenseSheet(c);
      else await this._openOfficeCustodyExpenseSheet(c);
    };
    const overlay = UI.openModal('🔨 مصروف عهدة - اختيار العهدة', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      await openSheet(fd.get('custody_id'), fd.get('expense_type'));
    });
    const form = overlay.querySelector('form');
    const custodySel = form.querySelector('[name="custody_id"]');
    const typeSel = form.querySelector('[name="expense_type"]');
    const custodyWrapper = custodySel.closest('.searchable-select');
    const custodyInput = custodyWrapper?.querySelector('.searchable-select-input');
    const setCustodyEnabled = (enabled) => {
      custodySel.disabled = !enabled;
      if (custodyInput) custodyInput.disabled = !enabled;
    };
    setCustodyEnabled(false);
    const autoOpen = () => {
      if (custodySel.value && typeSel.value) openSheet(custodySel.value, typeSel.value);
    };
    custodySel.addEventListener('change', autoOpen);
    typeSel.addEventListener('change', () => {
      setCustodyEnabled(!!typeSel.value);
      autoOpen();
    });
  },

  async _openOfficeCustodyExpenseSheet(c) {
    const [employees, sectors, vendors] = await Promise.all([
      API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc'),
      API.request('sectors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc')
    ]);
    const empOpts = employees.map(e => ({ v: e.id, l: e.name }));
    const sectorOpts = sectors.map(s => ({ v: s.id, l: s.name }));
    const vendorOpts = vendors.map(v => ({ v: v.id, l: v.name + (v.is_office ? ' (مكتب)' : '') }));
    const pmOpts = [{ v: '', l: '-- اختر --' }, { v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const cols = [
      { key: 'employee_id', label: 'الموظف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر موظف --' }, ...empOpts] },
      { key: 'sector_id', label: 'التصنيف', type: 'select', req: true, opts: [{ v: '', l: '-- اختر تصنيف --' }, ...sectorOpts] },
      { key: 'vendor_id', label: 'المورد (اختياري)', type: 'select', opts: [{ v: '', l: '-- اختر مورد --' }, ...vendorOpts] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'payment_method', label: 'الحساب', type: 'select', req: true, opts: pmOpts, default: 'cash' },
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
      { key: 'description', label: 'البيان' }
    ];
    const defaults = { employee_id: c.employee_id || '', date: new Date().toISOString().slice(0, 10), payment_method: 'cash' };
    Spreadsheet.open('🔨 مصروف عهدة - مكتب', cols, async (rows) => {
      const total = rows.reduce((s, r) => s + (+r.amount || 0), 0);
      if (total > (+c.remaining_balance || 0)) { UI.toast('إجمالي المصروفات يتجاوز الرصيد المتاح للعهدة', 'error'); throw new Error('over balance'); }
      for (const r of rows) {
        await this._confirmOfficeVendorAsync(r.vendor_id, vendors);
        const emp = employees.find(e => e.id === r.employee_id);
        const sector = sectors.find(s => s.id === r.sector_id);
        const vendor = vendors.find(v => v.id === r.vendor_id);
        const amount = +r.amount || 0;
        const date = r.date || new Date().toISOString().slice(0, 10);
        const txResult = await this.save('transactions', {
          type: 'office_expense',
          amount,
          paid_amount: amount,
          payment_method: r.payment_method || 'cash',
          employee_id: r.employee_id || null,
          employee_name: emp ? emp.name : null,
          sector_id: r.sector_id || null,
          sector_name: sector ? sector.name : null,
          vendor_id: r.vendor_id || null,
          vendor_name: vendor ? vendor.name : null,
          date,
          description: r.description || 'مصروف عهدة'
        });
        const txId = Array.isArray(txResult) ? txResult[0]?.id : txResult?.id;
        await this.save('custody_expenses', {
          custody_id: c.id,
          linked_transaction_id: txId || null,
          amount,
          date,
          description: r.description || 'مصروف عهدة'
        });
      }
      await this._updateCustodyAdvance(c.id);
      UI.toast(`تم حفظ ${rows.length} مصروف عهدة مكتبي`);
      App.loadOffice();
    }, defaults);
  },

  async _openProjectCustodyExpenseSheet(c) {
    const [clients, projects, vendors, workSections, workItems] = await Promise.all([
      API.request('clients', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc'),
      API.request('vendors', 'GET', null, '?select=id,name,is_office&deleted_at=is.null&order=name.asc'),
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
      { key: 'section_id', label: 'القسم', type: 'select', opts: [{ v: '', l: '-- اختر قسم --' }, ...sectionOpts] },
      { key: 'item_id', label: 'البند', type: 'select', opts: [{ v: '', l: '-- اختر بند --' }] },
      { key: 'payment_method', label: 'طريقة الدفع', type: 'select', opts: [{ v: '', l: '-- اختر --' }, { v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'إيداع بنكي' }, { v: 'transfer', l: 'تحويل' }] },
      { key: 'amount', label: 'المبلغ', type: 'number', req: true },
      { key: 'paid_amount', label: 'المدفوع', type: 'number' },
      { key: 'date', label: 'التاريخ *', type: 'date', req: true },
      { key: 'description', label: 'البيان' }
    ];
    const defaults = { date: new Date().toISOString().slice(0, 10), employee_name: c.employee_name || '-' };
    if (c.client_id) defaults.client_id = c.client_id;
    if (c.project_id) defaults.project_id = c.project_id;
    Spreadsheet.open('🔨 مصروف عهدة - مشروع', cols, async (rows) => {
      const total = rows.reduce((s, r) => s + (+r.amount || 0), 0);
      if (total > (+c.remaining_balance || 0)) { UI.toast('إجمالي المصروفات يتجاوز الرصيد المتاح للعهدة', 'error'); throw new Error('over balance'); }
      for (const r of rows) {
        await this._confirmOfficeVendorAsync(r.vendor_id, vendors);
        const project = projects.find(p => p.id === r.project_id);
        const vendor = vendors.find(v => v.id === r.vendor_id);
        const section = workSections.find(s => s.id === r.section_id);
        const item = workItems.find(i => i.id === r.item_id);
        if (!project) { UI.toast('مشروع غير موجود', 'error'); throw new Error('invalid project'); }
        if (r.client_id && project.client_id !== r.client_id) { UI.toast('المشروع لا ينتمي للعميل المختار', 'error'); throw new Error('client mismatch'); }
        let amount = +r.amount || 0;
        let paid_amount = +r.paid_amount || 0;
        const payment_method = r.payment_method || null;
        let payment_term = 'immediate';
        if (amount === 0 && paid_amount > 0) payment_term = 'settlement';
        else if (amount > paid_amount) payment_term = 'credit';
        const sectionName = section ? section.name : '';
        const expense_category = sectionName.includes('تصميم') ? 'design' : 'construction';
        const txResult = await this.save('transactions', {
          type: 'project_expense',
          expense_category,
          section_id: r.section_id || null,
          section_name: sectionName || null,
          item_id: r.item_id || null,
          item_name: item ? item.name : null,
          payment_method,
          payment_term,
          amount,
          paid_amount,
          client_id: project.client_id,
          party_id: project.client_id,
          party_name: project.client_name,
          party_type: 'client',
          project_id: r.project_id,
          project_name: project.name,
          vendor_id: r.vendor_id || null,
          vendor_name: vendor ? vendor.name : null,
          employee_id: c.employee_id || null,
          employee_name: c.employee_name || null,
          date: r.date || new Date().toISOString().slice(0, 10),
          description: r.description || 'مصروف عهدة'
        });
        const txId = Array.isArray(txResult) ? txResult[0]?.id : txResult?.id;
        await this.save('custody_expenses', {
          custody_id: c.id,
          linked_transaction_id: txId || null,
          amount,
          date: r.date || new Date().toISOString().slice(0, 10),
          description: r.description || 'مصروف عهدة'
        });
      }
      await this._updateCustodyAdvance(c.id);
      UI.toast(`تم حفظ ${rows.length} مصروف عهدة مشروع`);
      App.loadOffice();
    }, defaults, { clientProject: { clientKey: 'client_id', projectKey: 'project_id', projects }, sectionItem: { sectionKey: 'section_id', itemKey: 'item_id', items: workItems } });
  },

  async editCustody(id) {
    const rows = await API.request('custody_records', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const [sectors, employees, projects] = await Promise.all([
      API.request('sectors', 'GET', null, '?select=id,name&deleted_at=is.null&order=name.asc'),
      API.request('employees', 'GET', null, '?select=id,name&is_active=eq.true&deleted_at=is.null&order=name.asc'),
      API.request('projects', 'GET', null, '?select=id,name,client_id,client_name&deleted_at=is.null&order=name.asc')
    ]);
    const fields = [
      { name: 'custody_type', label: 'نوع العهد *', type: 'select', req: true, opts: [{v:'office',l:'مكتبية'},{v:'project',l:'مشروع'}] },
      { name: 'employee_id', label: 'الموظف *', type: 'select', req: true, opts: [{v:'',l:'-- اختر موظف --'}, ...employees.map(e => ({v:e.id,l:e.name}))] },
      { name: 'sector_id', label: 'التصنيف', type: 'select', opts: [{v:'',l:'-- اختر تصنيف --'}, ...sectors.map(s => ({v:s.id,l:s.name}))] },
      { name: 'project_id', label: 'المشروع', type: 'select', opts: [{v:'',l:'-- اختر مشروع --'}, ...projects.map(p => ({v:p.id,l:p.name}))] },
      { name: 'amount', label: 'المبلغ *', type: 'number', req: true },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    const overlay = UI.openModal('تعديل عهدة', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      const emp = employees.find(e => e.id === fd.get('employee_id'));
      const sector = sectors.find(s => s.id === fd.get('sector_id'));
      const proj = projects.find(p => p.id === fd.get('project_id'));
      const newAmount = +fd.get('amount') || 0;
      const consumed = (+rows[0].returned_amount || 0) + (+rows[0].returned_cash_amount || 0);
      if (newAmount < consumed) { UI.toast('لا يمكن تقليل المبلغ أقل من مجموع المصروفات والمرتجع المسجّل', 'error'); return; }
      await this.save('custody_records', {
        custody_type: fd.get('custody_type') || 'office',
        employee_id: fd.get('employee_id') || null,
        employee_name: emp ? emp.name : null,
        sector_id: fd.get('custody_type') === 'office' ? (fd.get('sector_id') || null) : null,
        sector_name: fd.get('custody_type') === 'office' ? (sector ? sector.name : null) : null,
        client_id: fd.get('custody_type') === 'project' ? (proj ? proj.client_id : null) : null,
        client_name: fd.get('custody_type') === 'project' ? (proj ? proj.client_name : null) : null,
        project_id: fd.get('custody_type') === 'project' ? (fd.get('project_id') || null) : null,
        project_name: fd.get('custody_type') === 'project' ? (proj ? proj.name : null) : null,
        amount: newAmount,
        date: fd.get('date') || null,
        notes: fd.get('notes') || null
      }, id);
      await this._updateCustodyAdvance(id);
      UI.toast('تم التحديث');
      App.loadOffice();
    });
    const form = overlay.querySelector('form');
    const typeSel = form.querySelector('[name="custody_type"]');
    const sectorGroup = form.querySelector('[name="sector_id"]').closest('.form-group');
    const projectGroup = form.querySelector('[name="project_id"]').closest('.form-group');
    const toggle = () => {
      if (typeSel.value === 'office') { sectorGroup.style.display = ''; projectGroup.style.display = 'none'; }
      else { sectorGroup.style.display = 'none'; projectGroup.style.display = ''; }
    };
    typeSel.addEventListener('change', toggle);
    toggle();
  },

  delCustody(id) {
    UI.confirm('هل أنت متأكد من حذف هذه العهدة؟', async () => {
      const rows = await API.request('custody_records', 'GET', null, `?select=employee_id,advance_transaction_id&id=eq.${id}&deleted_at=is.null`);
      const custody = rows[0];
      if (!custody) return;
      // Cascade: delete custody expenses and their linked transactions first.
      const expenses = await API.request('custody_expenses', 'GET', null, `?select=id,linked_transaction_id&custody_id=eq.${id}&deleted_at=is.null`);
      for (const exp of expenses) {
        if (exp.linked_transaction_id) await this.softDelete('transactions', exp.linked_transaction_id);
        await this.softDelete('custody_expenses', exp.id);
      }
      if (custody.advance_transaction_id) await this.softDelete('transactions', custody.advance_transaction_id);
      await this.softDelete('custody_records', id);
      UI.toast('تم الحذف');
      App.loadOffice();
    });
  },

  // ─── CUSTODY EXPENSES ───
  _custodyStatus(amount, consumed) {
    const amt = +amount || 0;
    const con = +consumed || 0;
    if (amt === 0 || con >= amt) return 'settled';
    if (con > 0) return 'partial';
    return 'active';
  },

  async _updateCustodyAdvance(custodyId) {
    const custody = await API.request('custody_records', 'GET', null, `?select=amount,remaining_balance,advance_transaction_id,employee_id,employee_name,date&id=eq.${custodyId}&deleted_at=is.null`);
    const c = custody[0];
    if (!c) return;
    const remaining = Math.max(0, +c.remaining_balance || 0);

    // Keep the linked advance transaction equal to the unspent/unreturned cash.
    if (c.advance_transaction_id && remaining >= 0) {
      await this.save('transactions', {
        amount: remaining,
        paid_amount: remaining,
        date: c.date || new Date().toISOString().slice(0, 10),
        description: 'عهدة نقدية للموظف ' + (c.employee_name || ''),
        employee_id: c.employee_id || null,
        employee_name: c.employee_name || null
      }, c.advance_transaction_id);
    }
  },

  async custodyExpenses(custodyId) {
    const [custody, expenses] = await Promise.all([
      API.request('custody_records', 'GET', null, `?select=*,employees(name)&id=eq.${custodyId}&deleted_at=is.null`),
      API.request('custody_expenses', 'GET', null, `?select=*&custody_id=eq.${custodyId}&deleted_at=is.null&order=date.desc&limit=100`)
    ]);
    const c = custody[0];
    if (!c) { UI.toast('العهدة غير موجودة', 'error'); return; }
    const totalExpenses = expenses.reduce((s, x) => s + (+x.amount || 0), 0);
    const returnedCash = +c.returned_cash_amount || 0;
    const remaining = +c.remaining_balance || 0;
    const empName = c.employees?.name || c.employee_name || '-';
    const summary = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">مبلغ العهدة</div><div class="kpi-value">${App.fmtMoney(c.amount || 0)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المصروفات</div><div class="kpi-value" style="color:var(--red)">${App.fmtMoney(totalExpenses)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المرتجع نقدًا</div><div class="kpi-value" style="color:var(--green)">${App.fmtMoney(returnedCash)}</div></div>
      <div class="kpi-card" style="flex:1;min-width:140px"><div class="kpi-label">المتبقي</div><div class="kpi-value" style="color:var(--gold)">${App.fmtMoney(remaining)}</div></div>
    </div>`;
    const rows = expenses.map((x, i) => [i+1, x.date || '-', App.fmtMoney(x.amount), App.esc(x.description || '-'), {html: UI.actions(x.id, 'Crud.editCustodyExpense', 'Crud.delCustodyExpense')}]);
    const table = rows.length ? App.table(['#', 'التاريخ', 'المبلغ', 'البيان', ''], rows) : '<p style="color:var(--text3)">لا توجد مصروفات لهذه العهدة</p>';
    const addBtn = `<div style="margin-bottom:12px"><button class="btn btn-primary" onclick="Crud.addCustodyExpense('${custodyId}')">➕ إضافة مصروف</button> <button class="btn btn-secondary" onclick="Crud.custodyReturn('${custodyId}')">💵 سداد باقي</button></div>`;
    UI.openModal(`🧾 مصروفات العهدة: ${App.esc(empName)}`, addBtn + summary + table, null);
  },

  async addCustodyExpense(custodyId) {
    const custodyRows = await API.request('custody_records', 'GET', null, `?select=*&id=eq.${custodyId}&deleted_at=is.null`);
    if (!custodyRows.length) { UI.toast('العهدة غير موجودة', 'error'); return; }
    const c = custodyRows[0];
    const available = +c.remaining_balance || 0;
    const pmOpts = [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const fields = [
      { name: 'amount', label: `المبلغ * (متاح: ${App.fmtMoney(available)})`, type: 'number', req: true },
      { name: 'payment_method', label: 'الحساب', type: 'select', opts: pmOpts, default: 'cash' },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'description', label: 'البيان', type: 'textarea' }
    ];
    UI.openModal('إضافة مصروف عهدة', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      const amount = +fd.get('amount') || 0;
      if (amount > available) { UI.toast('المبلغ يتجاوز الرصيد المتاح للعهدة', 'error'); return; }
      const desc = fd.get('description') || 'مصروف عهدة';
      const date = fd.get('date') || new Date().toISOString().slice(0, 10);
      const paymentMethod = fd.get('payment_method') || 'cash';
      // Create linked transaction for office/project balance
      let txPayload;
      if (c.custody_type === 'project') {
        txPayload = {
          type: 'project_expense',
          amount,
          paid_amount: amount,
          payment_method: paymentMethod,
          payment_term: 'immediate',
          expense_category: 'construction',
          client_id: c.client_id || null,
          party_id: c.client_id || null,
          party_name: c.client_name || null,
          party_type: 'client',
          project_id: c.project_id || null,
          project_name: c.project_name || null,
          employee_id: c.employee_id || null,
          employee_name: c.employee_name || null,
          date,
          description: desc
        };
      } else {
        txPayload = {
          type: 'office_expense',
          amount,
          payment_method: paymentMethod,
          employee_id: c.employee_id || null,
          employee_name: c.employee_name || null,
          sector_id: c.sector_id || null,
          sector_name: c.sector_name || null,
          date,
          description: desc
        };
      }
      const txResult = await this.save('transactions', txPayload);
      const txId = Array.isArray(txResult) ? txResult[0]?.id : txResult?.id;
      await this.save('custody_expenses', {
        custody_id: custodyId,
        linked_transaction_id: txId || null,
        amount,
        date,
        description: desc
      });
      await this._updateCustodyAdvance(custodyId);
      UI.toast('تم الحفظ');
      App.loadOffice();
      this.custodyExpenses(custodyId);
    });
  },

  async editCustodyExpense(id) {
    const rows = await API.request('custody_expenses', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const expense = rows[0];
    const custodyRows = await API.request('custody_records', 'GET', null, `?select=*&id=eq.${expense.custody_id}&deleted_at=is.null`);
    const c = custodyRows[0] || {};
    const available = (+c.remaining_balance || 0) + (+expense.amount || 0);
    const pmOpts = [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const fields = [
      { name: 'amount', label: `المبلغ * (متاح: ${App.fmtMoney(available)})`, type: 'number', req: true },
      { name: 'payment_method', label: 'الحساب', type: 'select', opts: pmOpts, default: expense.payment_method || 'cash' },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'description', label: 'البيان', type: 'textarea' }
    ];
    UI.openModal('تعديل مصروف عهدة', `<form>${UI.form(fields, expense)}</form>`, async (form) => {
      const fd = new FormData(form);
      const amount = +fd.get('amount') || 0;
      if (amount > available) { UI.toast('المبلغ يتجاوز الرصيد المتاح للعهدة', 'error'); return; }
      const desc = fd.get('description') || expense.description || 'مصروف عهدة';
      const date = fd.get('date') || expense.date;
      const paymentMethod = fd.get('payment_method') || 'cash';
      // Update linked transaction amount
      if (expense.linked_transaction_id) {
        await this.save('transactions', { amount, paid_amount: amount, payment_method: paymentMethod, date, description: desc }, expense.linked_transaction_id);
      }
      await this.save('custody_expenses', { amount, date, description: desc }, id);
      await this._updateCustodyAdvance(expense.custody_id);
      UI.toast('تم التحديث');
      App.loadOffice();
      this.custodyExpenses(expense.custody_id);
    });
  },

  delCustodyExpense(id) {
    UI.confirm('هل أنت متأكد من حذف هذا المصروف؟', async () => {
      const rows = await API.request('custody_expenses', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
      if (!rows.length) return;
      const expense = rows[0];
      if (expense.linked_transaction_id) await this.softDelete('transactions', expense.linked_transaction_id);
      await this.softDelete('custody_expenses', id);
      await this._updateCustodyAdvance(expense.custody_id);
      UI.toast('تم الحذف');
      App.loadOffice();
      this.custodyExpenses(expense.custody_id);
    });
  },

  async custodyReturn(custodyId) {
    const custodyRows = await API.request('custody_records', 'GET', null, `?select=*,employees(name)&id=eq.${custodyId}&deleted_at=is.null`);
    if (!custodyRows.length) { UI.toast('العهدة غير موجودة', 'error'); return; }
    const c = custodyRows[0];
    const returnedCash = +c.returned_cash_amount || 0;
    const remaining = +c.remaining_balance || 0;
    if (remaining <= 0) { UI.toast('لا يوجد رصيد متبقي للسداد', 'error'); return; }
    const pmOpts = [{ v: 'cash', l: 'نقدي' }, { v: 'bank', l: 'بنكي' }];
    const fields = [
      { name: 'amount', label: `المبلغ المرتجع * (متاح: ${App.fmtMoney(remaining)})`, type: 'number', req: true, default: remaining },
      { name: 'payment_method', label: 'الحساب', type: 'select', opts: pmOpts, default: 'cash' },
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'description', label: 'البيان', type: 'textarea' }
    ];
    UI.openModal('سداد باقي عهدة', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      const amount = +fd.get('amount') || 0;
      if (amount <= 0) { UI.toast('المبلغ يجب أن يكون أكبر من صفر', 'error'); return; }
      if (amount > remaining) { UI.toast('المبلغ يتجاوز الرصيد المتبقي', 'error'); return; }
      const date = fd.get('date') || new Date().toISOString().slice(0, 10);
      const desc = fd.get('description') || 'سداد باقي عهدة';
      await this.save('transactions', {
        type: 'custody_return',
        amount,
        payment_method: fd.get('payment_method') || 'cash',
        date,
        description: desc,
        employee_id: c.employee_id || null,
        employee_name: c.employee_name || null,
        sector_name: 'عهدة نقدية'
      });
      const newReturnedCash = returnedCash + amount;
      await API.request('custody_records', 'PATCH', { returned_cash_amount: newReturnedCash }, '?id=eq.' + custodyId);
      await this._updateCustodyAdvance(custodyId);
      UI.toast('تم تسجيل السداد');
      App.loadOffice();
      this.custodyExpenses(custodyId);
    });
  },

  async employeeAttendance(employeeId) {
    const [emp, records] = await Promise.all([
      API.request('employees', 'GET', null, `?select=name&id=eq.${employeeId}`),
      API.request('attendance_records', 'GET', null, `?select=*&employee_id=eq.${employeeId}&deleted_at=is.null&order=date.desc&limit=31`)
    ]);
    const name = emp[0]?.name || 'موظف';
    const statusBadge = (s) => {
      const colors = { present: 'green', absent: 'red', late: 'orange', half_day: 'blue', leave: 'gray' };
      const labels = { present: 'حاضر', absent: 'غائب', late: 'متأخر', half_day: 'نصف يوم', leave: 'إجازة' };
      return `<span class="badge badge-${colors[s] || 'gray'}">${labels[s] || App.esc(s)}</span>`;
    };
    const rows = records.map((r, i) => [i+1, r.date || '-', {html: statusBadge(r.status)}, r.check_in || '-', r.check_out || '-', App.esc(r.notes || '-'), {html: UI.actions(r.id, 'Crud.editAttendance', 'Crud.delAttendance', Auth.can('employees', 'edit'), Auth.can('employees', 'delete'))}]);
    const table = rows.length ? App.table(['#', 'التاريخ', 'الحالة', 'دخول', 'خروج', 'ملاحظات', ''], rows) : '<p style="color:var(--text3)">لا توجد سجلات حضور</p>';
    const addBtn = `<div style="margin-bottom:12px"><button class="btn btn-primary" onclick="Crud.addAttendance('${employeeId}')">➕ إضافة حضور</button></div>`;
    UI.openModal(`📋 حضور موظف: ${App.esc(name)}`, addBtn + table, null);
  },

  addAttendance(employeeId) {
    const fields = [
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'status', label: 'الحالة', type: 'select', opts: [{v:'present',l:'حاضر'},{v:'absent',l:'غائب'},{v:'late',l:'متأخر'},{v:'half_day',l:'نصف يوم'},{v:'leave',l:'إجازة'}] },
      { name: 'check_in', label: 'وقت الدخول', type: 'time' },
      { name: 'check_out', label: 'وقت الخروج', type: 'time' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('إضافة حضور', `<form>${UI.form(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      const status = fd.get('status') || 'present';
      const validStatuses = ['present','absent','late','half_day','leave'];
      if (!validStatuses.includes(status)) { UI.toast('حالة الحضور غير صالحة', 'error'); return; }
      const date = fd.get('date');
      if (!date) { UI.toast('التاريخ مطلوب', 'error'); return; }
      const existing = await API.request('attendance_records', 'GET', null, `?select=id&employee_id=eq.${employeeId}&date=eq.${date}&deleted_at=is.null`);
      if (existing.length) { UI.toast('يوجد سجل حضور لهذا الموظف في نفس التاريخ', 'error'); return; }
      await this.save('attendance_records', {
        employee_id: employeeId,
        date,
        status,
        check_in: fd.get('check_in') || null,
        check_out: fd.get('check_out') || null,
        notes: fd.get('notes') || null
      });
      UI.toast('تم حفظ الحضور');
      this.employeeAttendance(employeeId);
    });
  },

  async editAttendance(id) {
    const rows = await API.request('attendance_records', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const fields = [
      { name: 'date', label: 'التاريخ *', type: 'date', req: true },
      { name: 'status', label: 'الحالة', type: 'select', opts: [{v:'present',l:'حاضر'},{v:'absent',l:'غائب'},{v:'late',l:'متأخر'},{v:'half_day',l:'نصف يوم'},{v:'leave',l:'إجازة'}] },
      { name: 'check_in', label: 'وقت الدخول', type: 'time' },
      { name: 'check_out', label: 'وقت الخروج', type: 'time' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل حضور', `<form>${UI.form(fields, rows[0])}</form>`, async (form) => {
      const fd = new FormData(form);
      const status = fd.get('status') || 'present';
      const validStatuses = ['present','absent','late','half_day','leave'];
      if (!validStatuses.includes(status)) { UI.toast('حالة الحضور غير صالحة', 'error'); return; }
      const date = fd.get('date');
      if (!date) { UI.toast('التاريخ مطلوب', 'error'); return; }
      const existing = await API.request('attendance_records', 'GET', null, `?select=id&employee_id=eq.${rows[0].employee_id}&date=eq.${date}&deleted_at=is.null&id=neq.${id}`);
      if (existing.length) { UI.toast('يوجد سجل حضور لهذا الموظف في نفس التاريخ', 'error'); return; }
      await this.save('attendance_records', {
        date,
        status,
        check_in: fd.get('check_in') || null,
        check_out: fd.get('check_out') || null,
        notes: fd.get('notes') || null
      }, id);
      UI.toast('تم التحديث');
      this.employeeAttendance(rows[0].employee_id);
    });
  },

  delAttendance(id) {
    UI.confirm('هل أنت متأكد من حذف هذا السجل؟', async () => {
      const rows = await API.request('attendance_records', 'GET', null, `?select=employee_id&id=eq.${id}`);
      await this.softDelete('attendance_records', id);
      UI.toast('تم الحذف');
      if (rows.length) this.employeeAttendance(rows[0].employee_id);
    });
  },

  // ─── PAYROLL CRUD ───
  async editPayroll(id) {
    const rows = await API.request('payroll_records', 'GET', null, `?select=*&id=eq.${id}&deleted_at=is.null`);
    if (!rows.length) return;
    const pr = rows[0];
    const fields = [
      { name: 'base_salary', label: 'الراتب الأساسي', type: 'number', req: true },
      { name: 'deductions', label: 'الخصومات', type: 'number' },
      { name: 'bonuses', label: 'المكافآت', type: 'number' },
      { name: 'penalties', label: 'الجزاءات', type: 'number' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل راتب', `<form>${UI.form(fields, pr)}</form>`, async (form) => {
      const fd = new FormData(form);
      const base = +fd.get('base_salary') || 0;
      const ded = +fd.get('deductions') || 0;
      const bon = +fd.get('bonuses') || 0;
      const pen = +fd.get('penalties') || 0;
      const net = base - ded + bon - pen;
      await this.save('payroll_records', {
        base_salary: base,
        deductions: ded,
        bonuses: bon,
        penalties: pen,
        net_salary: net,
        notes: fd.get('notes') || null
      }, id);
      const expPayload = {
        amount: net,
        description: `راتب ${pr.employee_name || ''} - ${pr.month}/${pr.year}`,
        employee_name: pr.employee_name || null,
        date: `${pr.year}-${String(pr.month).padStart(2, '0')}-01`
      };
      if (pr.office_expense_id) {
        try { await this.save('transactions', expPayload, pr.office_expense_id); }
        catch (e) { /* update failure is non-fatal */ }
      } else {
        try {
          const exp = await this.save('transactions', { ...expPayload, type: 'office_expense', employee_id: pr.employee_id || null });
          const expId = Array.isArray(exp) ? exp[0]?.id : exp?.id;
          if (expId) await API.request('payroll_records', 'PATCH', { office_expense_id: expId }, `?id=eq.${id}`);
        } catch (e) { /* create failure is non-fatal */ }
      }
      UI.toast('تم التحديث');
      App.loadEmpPayroll(); App.loadOffice();
    });
  },

  async approvePayroll(id) {
    UI.confirm('هل أنت متأكد من اعتماد هذا الراتب؟', async () => {
      await this.save('payroll_records', { status: 'approved' }, id);
      UI.toast('تم الاعتماد');
      App.loadEmpPayroll();
    });
  },

  async payPayroll(id) {
    UI.confirm('هل أنت متأكد من تسجيل الدفع؟', async () => {
      const rows = await API.request('payroll_records', 'GET', null, `?select=*,employees(name)&id=eq.${id}&deleted_at=is.null`);
      if (!rows.length) return;
      const p = rows[0];
      if (p.status === 'paid') { UI.toast('الراتب مسجل كمدفوع مسبقاً', 'info'); return; }
      const now = new Date().toISOString();
      await this.save('payroll_records', { status: 'paid', paid_at: now }, id);
      // The office expense is created when payroll is generated. On pay, just ensure it exists and is not deleted.
      if (!p.office_expense_id) {
        try {
          const exp = await this.save('transactions', {
            type: 'office_expense',
            amount: +p.net_salary || 0,
            description: `راتب ${p.employee_name || p.employees?.name || ''} - ${p.month}/${p.year}`,
            employee_id: p.employee_id || null,
            employee_name: p.employee_name || p.employees?.name || null,
            date: now.slice(0, 10)
          });
          const expId = Array.isArray(exp) ? exp[0]?.id : exp?.id;
          if (expId) await API.request('payroll_records', 'PATCH', { office_expense_id: expId }, `?id=eq.${id}`);
        } catch (expErr) { /* create failure is non-fatal */ }
      } else {
        try { await this.save('transactions', { deleted_at: null }, p.office_expense_id); }
        catch (e) { /* restore failure is non-fatal */ }
      }
      UI.toast('تم تسجيل الدفع');
      App.loadEmpPayroll(); App.loadOffice();
    });
  },

  delPayroll(id) {
    UI.confirm('هل أنت متأكد من حذف سجل الراتب؟', async () => {
      const rows = await API.request('payroll_records', 'GET', null, `?select=office_expense_id&id=eq.${id}&deleted_at=is.null`);
      const officeExpenseId = rows[0]?.office_expense_id;
      await this.softDelete('payroll_records', id);
      if (officeExpenseId) await this.softDelete('transactions', officeExpenseId);
      UI.toast('تم الحذف');
      App.loadEmpPayroll(); App.loadOffice();
    });
  }
};
