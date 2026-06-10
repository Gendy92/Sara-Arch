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
