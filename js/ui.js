// UI Helpers + Spreadsheet

const UI = {
  toast(msg, type = 'success') {
    const colors = { success: '#4caf50', error: '#e53935', info: '#2196f3' };
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:20px;left:20px;z-index:99999;background:${colors[type]};color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);animation:slideIn 0.3s ease;direction:rtl;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, 3000);
  },

  openModal(title, content, onSubmit) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="UI.closeModal()">&times;</button></div><div class="modal-body">${content}</div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) UI.closeModal(); });
    if (onSubmit) {
      const form = overlay.querySelector('form');
      if (form) form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = 'جاري الحفظ...'; }
        try {
          await onSubmit(form);
          UI.closeModal();
        } catch (err) {
          console.error('Save error:', err);
          UI.toast('خطأ: ' + (err.message || 'فشل الحفظ'), 'error');
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.orig || 'حفظ'; }
        }
      });
    }
    document.body.style.overflow = 'hidden';
    return overlay;
  },

  closeModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) { overlay.remove(); document.body.style.overflow = ''; }
  },

  confirm(msg, onYes) {
    this.openModal('تأكيد', `<p style="margin-bottom:20px;color:var(--text2)">${msg}</p><div style="display:flex;gap:8px"><button class="btn btn-red" id="confirm-yes">نعم، متأكد</button><button class="btn btn-secondary" onclick="UI.closeModal()">إلغاء</button></div>`);
    document.getElementById('confirm-yes').addEventListener('click', () => { UI.closeModal(); onYes(); });
  },

  form(fields, values = {}) {
    return `<div class="form-grid">${fields.map(f => {
      const fieldName = f.name || f.key;
      const v = values[fieldName] !== undefined ? values[fieldName] : (f.default || '');
      if (f.type === 'textarea') return `<div class="form-group" style="grid-column:1/-1"><label>${f.label}${f.req ? ' *' : ''}</label><textarea name="${fieldName}" rows="3" ${f.req ? 'required' : ''}>${v}</textarea></div>`;
      if (f.type === 'select') return `<div class="form-group"><label>${f.label}${f.req ? ' *' : ''}</label><select name="${fieldName}" ${f.req ? 'required' : ''}>${f.opts.map(o => `<option value="${o.v}" ${v == o.v ? 'selected' : ''}>${o.l}</option>`).join('')}</select></div>`;
      if (f.type === 'date') return `<div class="form-group"><label>${f.label}${f.req ? ' *' : ''}</label><input type="date" name="${fieldName}" value="${v}" ${f.req ? 'required' : ''} /></div>`;
      if (f.type === 'number') return `<div class="form-group"><label>${f.label}${f.req ? ' *' : ''}</label><input type="number" name="${fieldName}" value="${v}" ${f.req ? 'required' : ''} step="any" /></div>`;
      return `<div class="form-group"><label>${f.label}${f.req ? ' *' : ''}</label><input type="text" name="${fieldName}" value="${v}" ${f.req ? 'required' : ''} /></div>`;
    }).join('')}</div><div style="display:flex;gap:8px;margin-top:20px"><button type="submit" class="btn btn-primary">حفظ</button><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">إلغاء</button></div>`;
  },

  actions(id, onEdit, onDel, canEdit = true, canDelete = true) {
    const editBtn = canEdit ? `<button class="btn btn-sm btn-secondary" onclick="${onEdit}('${id}')">تعديل</button>` : '';
    const delBtn = canDelete ? `<button class="btn btn-sm btn-red" onclick="${onDel}('${id}')">حذف</button>` : '';
    return `<div class="table-actions">${editBtn}${delBtn}</div>`;
  }
};

// ─── EXCEL-LIKE SPREADSHEET COMPONENT ───
const Spreadsheet = {
  open(title, columns, onSave, defaults = {}, cascade = {}, excelMode = 'paste') {
    const content = this.render(columns, defaults, cascade);
    UI.openModal(title, content, null);

    const modalBody = document.querySelector('.modal-body');
    const spreadsheetDiv = modalBody.querySelector('.spreadsheet');
    spreadsheetDiv._columns = columns;
    spreadsheetDiv._cascade = cascade;

    // Excel toolbar
    if (excelMode !== 'none') this.addExcelToolbar(modalBody, columns, spreadsheetDiv, excelMode, title);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.cssText = 'margin-top:16px;width:100%';
    saveBtn.textContent = '💾 حفظ الكل';
    saveBtn.onclick = async () => {
      try {
        const rows = this.getData(spreadsheetDiv);
        if (rows.length === 0) { UI.toast('لا يوجد بيانات للحفظ', 'error'); return; }
        saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ...';
        await onSave(rows);
        UI.closeModal();
      } catch (err) {
        console.error('Bulk save error:', err);
        UI.toast('خطأ: ' + (err.message || 'فشل الحفظ'), 'error');
        saveBtn.disabled = false; saveBtn.textContent = '💾 حفظ الكل';
      }
    };
    modalBody.appendChild(saveBtn);
  },

  render(columns, defaults = {}, cascade = {}) {
    const headerCells = columns.map(c => `<th>${c.label}${c.req ? ' <span style="color:#e53935">*</span>' : ''}</th>`).join('');
    const hasClientProjectCascade = cascade && cascade.clientProject;
    const hasSectionItemCascade = cascade && cascade.sectionItem;
    const inputCells = columns.map(c => {
      const def = defaults[c.key];
      let cascadeAttr = '';
      let disabledAttr = '';
      if (hasClientProjectCascade && c.key === cascade.clientProject.clientKey) cascadeAttr = ` onchange="Spreadsheet.handleClientProjectCascade(this)"`;
      if (hasClientProjectCascade && c.key === cascade.clientProject.projectKey && !def) disabledAttr = ' disabled';
      if (hasSectionItemCascade && c.key === cascade.sectionItem.sectionKey) cascadeAttr = ` onchange="Spreadsheet.handleSectionItemCascade(this)"`;
      if (hasSectionItemCascade && c.key === cascade.sectionItem.itemKey && !def) disabledAttr = ' disabled';
      if (c.type === 'select') {
        let optsHtml = c.opts.map(o => `<option value="${o.v}" ${def !== undefined && o.v == def ? 'selected' : ''}>${o.l}</option>`).join('');
        if (hasClientProjectCascade && c.key === cascade.clientProject.projectKey && def) {
          const projData = cascade.clientProject.projects;
          const clientId = def[cascade.clientProject.clientKey] || defaults[cascade.clientProject.clientKey];
          if (clientId) {
            optsHtml = c.opts.filter(o => !o.v || (projData.find(p => String(p.id) === String(o.v) && String(p.client_id) === String(clientId)))).map(o => `<option value="${o.v}">${o.l}</option>`).join('');
          }
        }
        return `<td><select data-key="${c.key}"${cascadeAttr}${disabledAttr}>${optsHtml}</select></td>`;
      }
      const inputType = c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text';
      const valAttr = def !== undefined ? `value="${def}"` : '';
      return `<td><input type="${inputType}" data-key="${c.key}" placeholder="${c.label.replace(/\*/g,'').trim()}" ${valAttr} /></td>`;
    }).join('');

    return `<div class="spreadsheet">
      <table>
        <thead><tr><th class="row-num">#</th>${headerCells}<th></th></tr></thead>
        <tbody>
          <tr>
            <td class="row-num">1</td>
            ${inputCells}
            <td><button type="button" class="btn btn-sm btn-red" onclick="Spreadsheet.removeRow(this)">×</button></td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="btn btn-secondary" onclick="Spreadsheet.addRow(this)" style="margin-top:12px">+ إضافة صف</button>
    </div>`;
  },

  addExcelToolbar(container, columns, spreadsheetDiv, mode = 'paste', title = 'Template') {
    const toolbar = document.createElement('div');
    toolbar.dataset.toolbar = 'excel';
    toolbar.dataset.title = title;
    toolbar.style.cssText = 'margin:16px 0;padding:16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px';
    const uploadBtn = mode === 'full' ? `<label class="btn btn-sm btn-secondary" style="cursor:pointer">
          📁 رفع ملف Excel
          <input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="Spreadsheet.handleFile(this, '${columns.map(c => c.key).join(',')}')">
        </label>` : '';
    toolbar.innerHTML = `
      <div style="font-weight:600;color:var(--gold);margin-bottom:10px">📥 استيراد من Excel</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button type="button" class="btn btn-sm btn-secondary" onclick="Spreadsheet.downloadTemplate(this)">📄 تحميل قالب Excel</button>
        ${uploadBtn}
      </div>
      <div style="color:var(--text3);font-size:11px;margin-bottom:6px">أو انسخ من Excel والصق هنا (Ctrl+V):</div>
      <textarea class="excel-paste" placeholder="انسخ صفوف من Excel والصقها هنا..." rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;color:var(--text);font-family:inherit;resize:vertical"></textarea>
      <button type="button" class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="Spreadsheet.handlePaste(this, '${columns.map(c => c.key).join(',')}')">📋 تحليل البيانات الملصقة</button>
    `;
    toolbar._columns = columns;
    toolbar._spreadsheet = spreadsheetDiv;
    container.insertBefore(toolbar, container.querySelector('.btn-primary'));
  },

  downloadTemplate(btn) {
    const toolbar = btn.closest('[data-toolbar="excel"]');
    if (!toolbar) { UI.toast('لم يتم العثور على شريط الأدوات', 'error'); return; }
    const columns = toolbar._columns;
    if (!columns || !columns.length) return;

    const headers = columns.map(c => c.label.replace(/\*/g,'').trim());
    const example = columns.map(c => {
      if (c.type === 'select') {
        const realOpt = c.opts.find(o => o.v !== '');
        return realOpt ? realOpt.l : '';
      }
      if (c.type === 'number') return '1000';
      if (c.type === 'date') return new Date().toISOString().slice(0,10);
      return 'مثال';
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    // Manual Blob download (more reliable than XLSX.writeFile)
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Build unique filename: Sara_Function_Date_User_Timestamp.xlsx
    const titleText = toolbar.dataset.title || 'Template';
    const safeTitle = titleText.replace(/[^\w\u0600-\u06FF\s]/g, '').replace(/\s+/g, '_');
    const userName = (Auth.user?.displayName || Auth.fromEmail?.(Auth.user?.email) || 'user').replace(/\s+/g, '_');
    const dateStr = new Date().toISOString().slice(0,10);
    const ts = Date.now();
    a.download = `Sara_${safeTitle}_${dateStr}_${userName}_${ts}.xlsx`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async handleFile(input, keysStr) {
    const file = input.files[0];
    if (!file) return;
    const toolbar = input.closest('[data-toolbar="excel"]');
    const columns = toolbar._columns;
    const spreadsheetDiv = toolbar._spreadsheet;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      if (rows.length < 2) { UI.toast('الملف فارغ أو غير صالح', 'error'); return; }
      const dataRows = rows.slice(1); // skip header
      this.fillData(spreadsheetDiv, columns, dataRows);
      UI.toast(`تم استيراد ${dataRows.length} صفوف`, 'success');
    } catch (e) {
      console.error('Excel parse error:', e);
      UI.toast('خطأ في قراءة ملف Excel', 'error');
    }
    input.value = '';
  },

  handlePaste(btn, keysStr) {
    const toolbar = btn.closest('[data-toolbar="excel"]');
    const columns = toolbar._columns;
    const spreadsheetDiv = toolbar._spreadsheet;
    const textarea = toolbar.querySelector('.excel-paste');
    const text = textarea.value.trim();
    if (!text) { UI.toast('لا يوجد بيانات ملصقة', 'error'); return; }

    // Parse TSV (tab-separated) or CSV
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const rows = lines.map(line => {
      // Try tab first, then comma
      if (line.includes('\t')) return line.split('\t');
      // Simple CSV split (not handling quoted commas for simplicity)
      return line.split(',');
    });

    this.fillData(spreadsheetDiv, columns, rows);
    UI.toast(`تم استيراد ${rows.length} صفوف`, 'success');
    textarea.value = '';
  },

  fillData(spreadsheetDiv, columns, rows) {
    const tbody = spreadsheetDiv.querySelector('tbody');
    // Clear existing rows except first
    while (tbody.children.length > 1) tbody.removeChild(tbody.lastChild);
    const firstRow = tbody.querySelector('tr');

    rows.forEach((rowData, idx) => {
      const newRow = firstRow.cloneNode(true);
      newRow.querySelectorAll('input, select').forEach((el, colIdx) => {
        const col = columns[colIdx];
        if (!col) return;
        const rawVal = rowData[colIdx] !== undefined ? String(rowData[colIdx]).trim() : '';

        if (col.type === 'select') {
          // Try match by value first, then by label
          const match = col.opts.find(o => o.v == rawVal || o.l === rawVal);
          el.value = match ? match.v : '';
        } else if (col.type === 'number') {
          const num = parseFloat(rawVal.replace(/,/g, ''));
          el.value = isNaN(num) ? '' : num;
        } else if (col.type === 'date') {
          // Try to normalize date
          const d = new Date(rawVal);
          el.value = !isNaN(d.getTime()) ? d.toISOString().slice(0,10) : rawVal;
        } else {
          el.value = rawVal;
        }
      });
      newRow.querySelector('.row-num').textContent = idx + 1;
      tbody.appendChild(newRow);
    });

    // Renumber all rows
    Array.from(tbody.children).forEach((tr, i) => { tr.querySelector('.row-num').textContent = i + 1; });
  },

  addRow(btn) {
    const spreadsheet = btn.closest('.spreadsheet');
    const tbody = spreadsheet.querySelector('tbody');
    const firstRow = tbody.querySelector('tr');
    const newRow = firstRow.cloneNode(true);
    newRow.querySelectorAll('input, select').forEach(el => { el.value = ''; el.disabled = false; });
    // Re-attach cascade listener if needed
    const cascade = spreadsheet._cascade;
    if (cascade && cascade.clientProject) {
      const clientSel = newRow.querySelector(`select[data-key="${cascade.clientProject.clientKey}"]`);
      const projSel = newRow.querySelector(`select[data-key="${cascade.clientProject.projectKey}"]`);
      if (clientSel) clientSel.onchange = function() { Spreadsheet.handleClientProjectCascade(this); };
      if (projSel) projSel.disabled = true;
    }
    if (cascade && cascade.sectionItem) {
      const sectionSel = newRow.querySelector(`select[data-key="${cascade.sectionItem.sectionKey}"]`);
      const itemSel = newRow.querySelector(`select[data-key="${cascade.sectionItem.itemKey}"]`);
      if (sectionSel) sectionSel.onchange = function() { Spreadsheet.handleSectionItemCascade(this); };
      if (itemSel) itemSel.disabled = true;
    }
    newRow.querySelector('.row-num').textContent = tbody.children.length + 1;
    tbody.appendChild(newRow);
  },

  handleClientProjectCascade(el) {
    const row = el.closest('tr');
    const spreadsheet = el.closest('.spreadsheet');
    const cascade = spreadsheet._cascade;
    if (!cascade || !cascade.clientProject) return;
    const { clientKey, projectKey, projects } = cascade.clientProject;
    const projSel = row.querySelector(`select[data-key="${projectKey}"]`);
    if (!projSel) return;
    const clientId = el.value;
    if (!clientId) {
      projSel.innerHTML = '<option value="">-- اختر مشروع --</option>';
      projSel.disabled = true;
      return;
    }
    const filtered = projects.filter(p => String(p.client_id) === String(clientId));
    projSel.innerHTML = '<option value="">-- اختر مشروع --</option>' + filtered.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    projSel.disabled = false;
  },

  handleSectionItemCascade(el) {
    const row = el.closest('tr');
    const spreadsheet = el.closest('.spreadsheet');
    const cascade = spreadsheet._cascade;
    if (!cascade || !cascade.sectionItem) return;
    const { sectionKey, itemKey, items } = cascade.sectionItem;
    const itemSel = row.querySelector(`select[data-key="${itemKey}"]`);
    if (!itemSel) return;
    const sectionId = el.value;
    if (!sectionId) {
      itemSel.innerHTML = '<option value="">-- اختر بند --</option>';
      itemSel.disabled = true;
      return;
    }
    const filtered = items.filter(i => String(i.section_id) === String(sectionId));
    itemSel.innerHTML = '<option value="">-- اختر بند --</option>' + filtered.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    itemSel.disabled = false;
  },

  removeRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    if (tbody.children.length <= 1) return;
    row.remove();
    Array.from(tbody.children).forEach((tr, i) => { tr.querySelector('.row-num').textContent = i + 1; });
  },

  getData(container) {
    const columns = container._columns || [];
    const requiredKeys = columns.filter(c => c.req).map(c => c.key);
    const rows = [];
    container.querySelectorAll('tbody tr').forEach(tr => {
      const row = {}; let hasData = false;
      tr.querySelectorAll('input, select').forEach(el => {
        const key = el.dataset.key;
        let val = el.value.trim();
        if (val) {
          hasData = true;
          if (el.type === 'number') val = +val;
        } else { val = null; }
        row[key] = val;
      });
      if (hasData) {
        const missing = requiredKeys.filter(k => !row[k]);
        if (missing.length > 0) {
          const missingLabels = columns.filter(c => missing.includes(c.key)).map(c => c.label.replace(/\*/g,'').trim());
          throw new Error('الحقول المطلوبة: ' + missingLabels.join(', '));
        }
        rows.push(row);
      }
    });
    return rows;
  }
};

window.UI = UI;
window.Spreadsheet = Spreadsheet;
