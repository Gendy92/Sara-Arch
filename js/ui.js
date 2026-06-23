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
    const safeTitle = App.esc ? App.esc(title) : String(title).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3>${safeTitle}</h3><button class="modal-close" onclick="UI.closeModal()">&times;</button></div><div class="modal-body">${content}</div></div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
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
          UI.toast('خطأ: ' + (err.message || 'فشل الحفظ'), 'error');
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.orig || 'حفظ'; }
        }
      });
    }
    document.body.style.overflow = 'hidden';
    this.initSearchableSelects(overlay);
    return overlay;
  },

  closeModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) { overlay.remove(); document.body.style.overflow = ''; document.body.classList.remove('modal-open'); }
  },

  confirm(msg, onYes, onNo, yesText = 'نعم، متأكد', noText = 'إلغاء') {
    const safeMsg = (typeof App !== 'undefined' && App.esc) ? App.esc(msg) : String(msg).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    this.openModal('تأكيد', `<p style="margin-bottom:20px;color:var(--text2);white-space:pre-line">${safeMsg}</p><div style="display:flex;gap:8px"><button class="btn btn-red" id="confirm-yes">${App.esc(yesText)}</button><button class="btn btn-secondary" id="confirm-no">${App.esc(noText)}</button></div>`);
    document.getElementById('confirm-yes').addEventListener('click', () => { UI.closeModal(); onYes(); });
    if (onNo) document.getElementById('confirm-no').addEventListener('click', () => { UI.closeModal(); onNo(); });
  },

  _escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  shortPlaceholder(label) {
    const clean = String(label || '').replace(/\*/g, '').trim();
    return clean.length > 6 ? clean.slice(0, 6) + '…' : clean;
  },

  searchableSelectHTML(selectAttrs, options, value) {
    const esc = (s) => App.esc ? App.esc(s) : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const optsHtml = options.map(o => `<option value="${this._escAttr(o.v)}" ${value == o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('');
    const dropdownOpts = options.map(o => `<div class="searchable-select-option" data-value="${this._escAttr(o.v)}">${esc(o.l)}</div>`).join('');
    const isDisabled = selectAttrs.includes('disabled');
    return `<div class="searchable-select">
      <input type="text" class="searchable-select-input" placeholder="-- اختر --" autocomplete="off" ${isDisabled ? 'disabled' : ''}>
      <select ${selectAttrs} style="position:absolute;opacity:0;height:0;width:0;pointer-events:none;">${optsHtml}</select>
      <div class="searchable-select-dropdown">${dropdownOpts}</div>
    </div>`;
  },

  _searchableSelectGlobalInit: false,
  _positionSearchableDropdown(dropdown, input) {
    const rect = input.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    const minWidth = Math.max(rect.width, isMobile ? 220 : 150);
    const maxDropdownHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    dropdown.style.position = 'fixed';
    dropdown.style.width = 'auto';
    dropdown.style.minWidth = `${minWidth}px`;
    dropdown.style.maxWidth = `min(600px, calc(100vw - 32px))`;
    // RTL-safe: align dropdown's right edge to trigger's right edge.
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
    dropdown.style.left = 'auto';
    dropdown.style.maxHeight = `${maxDropdownHeight}px`;
    dropdown.style.setProperty('--ss-width', `${minWidth}px`);
    // Flip to top if not enough space below and more space above.
    if (spaceBelow < maxDropdownHeight && spaceAbove > spaceBelow) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = `${window.innerHeight - rect.top + 2}px`;
    } else {
      dropdown.style.top = `${rect.bottom + 2}px`;
      dropdown.style.bottom = 'auto';
    }
  },
  _highlightSearchableOption(wrapper) {
    const select = wrapper.querySelector('select');
    const dropdown = wrapper.querySelector('.searchable-select-dropdown');
    const val = select ? select.value : '';
    dropdown.querySelectorAll('.searchable-select-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.value === val);
    });
  },
  initSearchableSelects(container) {
    const closeDropdown = (d) => {
      d.classList.remove('open');
      const wrapper = d.closest('.searchable-select');
      const inp = wrapper?.querySelector('.searchable-select-input');
      const sel = wrapper?.querySelector('select');
      if (inp && sel && !sel.value) inp.placeholder = '-- اختر --';
    };
    if (!UI._searchableSelectGlobalInit) {
      UI._searchableSelectGlobalInit = true;
      document.addEventListener('click', (e) => {
        if (e.target.closest('.searchable-select')) return;
        document.querySelectorAll('.searchable-select-dropdown.open').forEach(closeDropdown);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.searchable-select-dropdown.open').forEach(closeDropdown);
        }
      });
      const repositionOpen = () => {
        document.querySelectorAll('.searchable-select-dropdown.open').forEach(d => {
          const input = d.closest('.searchable-select')?.querySelector('.searchable-select-input');
          if (input) UI._positionSearchableDropdown(d, input);
        });
      };
      window.addEventListener('resize', repositionOpen);
      window.addEventListener('scroll', repositionOpen, true);
    }
    if (!container._searchableDelegated) {
      container._searchableDelegated = true;
      container.addEventListener('click', (e) => {
        const opt = e.target.closest('.searchable-select-option');
        if (!opt) return;
        const wrapper = opt.closest('.searchable-select');
        const input = wrapper.querySelector('.searchable-select-input');
        const select = wrapper.querySelector('select');
        input.value = opt.textContent;
        select.value = opt.dataset.value;
        wrapper.querySelector('.searchable-select-dropdown').classList.remove('open');
        UI._highlightSearchableOption(wrapper);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      container.addEventListener('input', (e) => {
        if (!e.target.classList.contains('searchable-select-input')) return;
        const wrapper = e.target.closest('.searchable-select');
        const dropdown = wrapper.querySelector('.searchable-select-dropdown');
        const term = e.target.value.trim().toLowerCase();
        dropdown.querySelectorAll('.searchable-select-option').forEach(opt => {
          opt.classList.toggle('hidden', term && !opt.textContent.toLowerCase().includes(term));
        });
        UI._positionSearchableDropdown(dropdown, e.target);
        document.querySelectorAll('.searchable-select-dropdown.open').forEach(d => { if (d !== dropdown) d.classList.remove('open'); });
        dropdown.classList.add('open');
      });
      container.addEventListener('focusin', (e) => {
        if (!e.target.classList.contains('searchable-select-input')) return;
        const wrapper = e.target.closest('.searchable-select');
        const dropdown = wrapper.querySelector('.searchable-select-dropdown');
        const sel = wrapper.querySelector('select');
        if (sel && !sel.value) e.target.placeholder = '🔍 ابحث...';
        UI._positionSearchableDropdown(dropdown, e.target);
        UI._highlightSearchableOption(wrapper);
        document.querySelectorAll('.searchable-select-dropdown.open').forEach(d => { if (d !== dropdown) closeDropdown(d); });
        dropdown.classList.add('open');
      });
    }
    container.querySelectorAll('.searchable-select').forEach(wrapper => {
      if (wrapper._searchableObserved) return;
      wrapper._searchableObserved = true;
      const select = wrapper.querySelector('select');
      const input = wrapper.querySelector('.searchable-select-input');
      const dropdown = wrapper.querySelector('.searchable-select-dropdown');
      const sync = () => {
        const val = select.value;
        if (!val) {
          input.value = '';
          input.placeholder = '-- اختر --';
          UI._highlightSearchableOption(wrapper);
          return;
        }
        const selected = Array.from(select.options).find(o => o.value === val);
        input.value = selected ? selected.textContent.trim() : '';
        input.placeholder = '';
        UI._highlightSearchableOption(wrapper);
      };
      const observer = new MutationObserver(() => {
        dropdown.innerHTML = Array.from(select.options).map(o => `<div class="searchable-select-option" data-value="${UI._escAttr(o.value)}">${o.textContent}</div>`).join('');
        sync();
      });
      observer.observe(select, { childList: true });
      select.addEventListener('change', sync);
      sync();
    });
  },

  form(fields, values = {}) {
    let html = '';
    let currentSection = null;
    let inGrid = false;
    fields.forEach(f => {
      if (f.section && f.section !== currentSection) {
        if (inGrid) { html += '</div>'; inGrid = false; }
        currentSection = f.section;
        html += `<div class="modal-section"><div class="modal-section-title">${currentSection}</div><div class="form-grid">`;
        inGrid = true;
      } else if (!f.section && currentSection) {
        // back to no-section fields
        if (inGrid) { html += '</div></div>'; inGrid = false; }
        currentSection = null;
      }
      if (!inGrid) {
        html += '<div class="form-grid">';
        inGrid = true;
      }
      html += this._fieldHtml(f, values);
    });
    if (inGrid) html += '</div>';
    if (currentSection) html += '</div>';
    return `${html}<div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">إلغاء</button><button type="submit" class="btn btn-primary">حفظ</button></div>`;
  },

  _fieldHtml(f, values = {}) {
    const fieldName = f.name || f.key;
    const v = values[fieldName] !== undefined ? values[fieldName] : (f.default || '');
    const vEsc = this._escAttr(v);
    const safeLabel = (typeof App !== 'undefined' && App.esc) ? App.esc(f.label) : String(f.label || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const safePlaceholder = (typeof App !== 'undefined' && App.esc) ? App.esc(this.shortPlaceholder(f.label)) : String(this.shortPlaceholder(f.label) || '').replace(/"/g,'&quot;');
    if (f.type === 'textarea') return `<div class="form-group" style="grid-column:1/-1"><label>${safeLabel}${f.req ? ' *' : ''}</label><textarea name="${fieldName}" rows="3" placeholder="${safePlaceholder}" ${f.req ? 'required' : ''} ${f.attr || ''}>${vEsc}</textarea></div>`;
    if (f.type === 'select') return `<div class="form-group"><label>${safeLabel}${f.req ? ' *' : ''}</label>${this.searchableSelectHTML(`name="${fieldName}" ${f.req ? 'required' : ''} ${f.attr || ''}`, f.opts, v)}</div>`;
    if (f.type === 'date') return `<div class="form-group"><label>${safeLabel}${f.req ? ' *' : ''}</label><input type="date" name="${fieldName}" value="${vEsc}" placeholder="${safePlaceholder}" ${f.req ? 'required' : ''} ${f.attr || ''} /></div>`;
    if (f.type === 'number') return `<div class="form-group"><label>${safeLabel}${f.req ? ' *' : ''}</label><input type="number" name="${fieldName}" value="${vEsc}" placeholder="${safePlaceholder}" ${f.req ? 'required' : ''} min="0" step="any" ${f.attr || ''} /></div>`;
    if (f.type === 'time') return `<div class="form-group"><label>${safeLabel}${f.req ? ' *' : ''}</label><input type="time" name="${fieldName}" value="${vEsc}" placeholder="${safePlaceholder}" ${f.req ? 'required' : ''} ${f.attr || ''} /></div>`;
    return `<div class="form-group"><label>${safeLabel}${f.req ? ' *' : ''}</label><input type="text" name="${fieldName}" value="${vEsc}" placeholder="${safePlaceholder}" ${f.req ? 'required' : ''} ${f.attr || ''} /></div>`;
  },

  actions(id, onEdit, onDel, canEdit = true, canDelete = true) {
    const safeId = App.esc ? App.esc(id) : String(id).replace(/&/g,'&amp;').replace(/'/g,'&#39;');
    const editBtn = canEdit ? `<button class="btn btn-sm btn-secondary" onclick="${onEdit}('${safeId}')">تعديل</button>` : '';
    const delBtn = canDelete ? `<button class="btn btn-sm btn-red" onclick="${onDel}('${safeId}')">حذف</button>` : '';
    return `<div class="table-actions">${editBtn}${delBtn}</div>`;
  }
};

// ─── EXCEL-LIKE SPREADSHEET COMPONENT ───
const Spreadsheet = {
  open(title, columns, onSave, defaults = {}, cascade = {}, excelMode = 'paste') {
    const content = this.render(columns, defaults, cascade);
    UI.openModal(title, content, null);

    const modal = document.querySelector('.modal-overlay .modal');
    const modalBody = modal.querySelector('.modal-body');
    const spreadsheetDiv = modalBody.querySelector('.spreadsheet');
    spreadsheetDiv._columns = columns;
    spreadsheetDiv._cascade = cascade;

    // Excel toolbar
    if (excelMode !== 'none') this.addExcelToolbar(modalBody, columns, spreadsheetDiv, excelMode, title);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.cssText = 'width:100%';
    saveBtn.textContent = '💾 حفظ الكل';
    saveBtn.onclick = async () => {
      try {
        const rows = this.getData(spreadsheetDiv);
        if (rows.length === 0) { UI.toast('لا يوجد بيانات للحفظ', 'error'); return; }
        saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ...';
        await onSave(rows);
        UI.closeModal();
      } catch (err) {
        UI.toast('خطأ: ' + (err.message || 'فشل الحفظ'), 'error');
        saveBtn.disabled = false; saveBtn.textContent = '💾 حفظ الكل';
      }
    };
    const footer = document.createElement('div');
    footer.className = 'modal-actions';

    // Move the "add row" button from inside the scrollable spreadsheet body
    // to the modal footer so it remains accessible when many rows exist.
    const addBtn = spreadsheetDiv.querySelector('button[onclick*="addRow"]');
    if (addBtn) {
      addBtn._spreadsheet = spreadsheetDiv;
      addBtn.removeAttribute('style');
      footer.appendChild(addBtn);
    }

    footer.appendChild(saveBtn);
    modal.appendChild(footer);
  },

  render(columns, defaults = {}, cascade = {}) {
    const esc = (s) => (typeof App !== 'undefined' && App.esc) ? App.esc(s) : String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const escAttr = (s) => UI._escAttr(s);
    const headerCells = columns.map(c => `<th>${esc(c.label)}${c.req ? ' <span style="color:#e53935">*</span>' : ''}</th>`).join('');
    const hasClientProjectCascade = cascade && cascade.clientProject;
    const hasSectionItemCascade = cascade && cascade.sectionItem;
    const inputCells = columns.map(c => {
      const def = defaults[c.key];
      let cascadeAttr = '';
      let disabledAttr = '';
      if (hasClientProjectCascade && (c.key === cascade.clientProject.clientKey || c.key === cascade.clientProject.projectKey)) cascadeAttr = ` onchange="Spreadsheet.handleClientProjectCascade(this)"`;
      if (hasClientProjectCascade && c.key === cascade.clientProject.projectKey && !def) disabledAttr = ' disabled';
      if (hasSectionItemCascade && c.key === cascade.sectionItem.sectionKey) cascadeAttr = ` onchange="Spreadsheet.handleSectionItemCascade(this)"`;
      if (hasSectionItemCascade && c.key === cascade.sectionItem.itemKey && !def) disabledAttr = ' disabled';
      if (c.type === 'select') {
        let opts = c.opts;
        if (hasClientProjectCascade && c.key === cascade.clientProject.projectKey && def) {
          const projData = cascade.clientProject.projects;
          const clientId = def[cascade.clientProject.clientKey] || defaults[cascade.clientProject.clientKey];
          if (clientId) {
            opts = c.opts.filter(o => !o.v || (projData.find(p => String(p.id) === String(o.v) && String(p.client_id) === String(clientId))));
          }
        }
        const attrs = `data-key="${c.key}"${cascadeAttr}${disabledAttr} ${c.attr || ''}`;
        return `<td>${UI.searchableSelectHTML(attrs, opts, def)}</td>`;
      }
      const inputType = c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text';
      const valAttr = def !== undefined ? `value="${escAttr(def)}"` : '';
      const minAttr = c.type === 'number' ? ' min="0"' : '';
      const extraAttr = c.attr || '';
      return `<td><input type="${inputType}" data-key="${c.key}" placeholder="${esc(UI.shortPlaceholder(c.label))}" ${valAttr}${minAttr} ${extraAttr} /></td>`;
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
          <input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="Spreadsheet.handleFile(this)">
        </label>` : '';
    toolbar.innerHTML = `
      <div style="font-weight:600;color:var(--gold);margin-bottom:10px">📥 استيراد من Excel</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button type="button" class="btn btn-sm btn-secondary" onclick="Spreadsheet.downloadTemplate(this)">📄 تحميل قالب Excel</button>
        ${uploadBtn}
      </div>
      <div style="color:var(--text3);font-size:11px;margin-bottom:6px">أو انسخ من Excel والصق هنا (Ctrl+V):</div>
      <textarea class="excel-paste" placeholder="انسخ صفوف من Excel والصقها هنا..." rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;color:var(--text);font-family:inherit;resize:vertical"></textarea>
      <button type="button" class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="Spreadsheet.handlePaste(this)">📋 تحليل البيانات الملصقة</button>
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
    ws['!cols'] = columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    // Reference sheet with dropdown options
    const refRows = [['العمود', 'القيمة (value)', 'الوصف (label)']];
    columns.forEach(col => {
      if (col.type === 'select' && col.opts) {
        col.opts.forEach(o => {
          if (o.v !== '') refRows.push([col.label.replace(/\*/g,'').trim(), o.v, o.l]);
        });
      }
    });
    if (refRows.length > 1) {
      const refWs = XLSX.utils.aoa_to_sheet(refRows);
      refWs['!cols'] = [{ wch: 22 }, { wch: 36 }, { wch: 36 }];
      XLSX.utils.book_append_sheet(wb, refWs, 'Reference');
    }

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

  async handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    const toolbar = input.closest('[data-toolbar="excel"]');
    const columns = toolbar._columns;
    const spreadsheetDiv = toolbar._spreadsheet;
    const MAX_SIZE = 2 * 1024 * 1024;
    const MAX_ROWS = 2000;
    const ALLOWED_TYPES = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/octet-stream'];

    if (file.size > MAX_SIZE) { UI.toast('حجم الملف كبير جداً — الحد 2 ميجابايت', 'error'); input.value = ''; return; }
    if (!ALLOWED_TYPES.includes(file.type)) { UI.toast('نوع الملف غير مدعوم — يُرجى رفع ملف Excel', 'error'); input.value = ''; return; }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      if (rows.length < 2) { UI.toast('الملف فارغ أو غير صالح', 'error'); input.value = ''; return; }
      const dataRows = rows.slice(1); // skip header
      if (dataRows.length > MAX_ROWS) { UI.toast(`عدد الصفوف يتجاوز الحد (${MAX_ROWS})`, 'error'); input.value = ''; return; }
      this.fillData(spreadsheetDiv, columns, dataRows);
      UI.toast(`تم استيراد ${dataRows.length} صفوف`, 'success');
    } catch (e) {
      UI.toast('خطأ في قراءة ملف Excel', 'error');
    }
    input.value = '';
  },

  handlePaste(btn) {
    const toolbar = btn.closest('[data-toolbar="excel"]');
    const columns = toolbar._columns;
    const spreadsheetDiv = toolbar._spreadsheet;
    const textarea = toolbar.querySelector('.excel-paste');
    const text = textarea.value.trim();
    const MAX_ROWS = 2000;
    if (!text) { UI.toast('لا يوجد بيانات ملصقة', 'error'); return; }

    // Parse TSV (tab-separated) or CSV
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    // Detect header: skip first line if it matches the first column label
    const firstColLabel = columns[0].label.replace(/\*/g,'').trim();
    let dataLines = lines;
    if (lines.length > 1 && lines[0].includes(firstColLabel)) {
      dataLines = lines.slice(1);
    }
    if (dataLines.length > MAX_ROWS) { UI.toast(`عدد الصفوف يتجاوز الحد (${MAX_ROWS})`, 'error'); return; }
    const rows = dataLines.map(line => {
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
    const cascade = spreadsheetDiv._cascade || {};

    rows.forEach((rowData, idx) => {
      const newRow = firstRow.cloneNode(true);
      // Map pasted values by column key
      const keyVals = {};
      columns.forEach((col, colIdx) => {
        keyVals[col.key] = rowData[colIdx] !== undefined ? String(rowData[colIdx]).trim() : '';
      });

      const setValue = (key, rawVal) => {
        const col = columns.find(c => c.key === key);
        const el = newRow.querySelector(`[data-key="${key}"]`);
        if (!el || !col) return;
        if (col.type === 'select') {
          const match = col.opts.find(o => o.v == rawVal || o.l === rawVal);
          el.value = match ? match.v : '';
        } else if (col.type === 'number') {
          const num = parseFloat(rawVal.replace(/,/g, ''));
          el.value = isNaN(num) ? '' : num;
        } else if (col.type === 'date') {
          const d = new Date(rawVal);
          el.value = !isNaN(d.getTime()) ? d.toISOString().slice(0,10) : rawVal;
        } else {
          el.value = rawVal;
        }
      };

      // 1. Set non-select fields first
      columns.forEach(col => {
        if (col.type !== 'select') setValue(col.key, keyVals[col.key]);
      });

      // 2. Set parent selects and trigger cascades
      if (cascade.clientProject) {
        setValue(cascade.clientProject.clientKey, keyVals[cascade.clientProject.clientKey]);
        const parentSel = newRow.querySelector(`[data-key="${cascade.clientProject.clientKey}"]`);
        if (parentSel) parentSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (cascade.sectionItem) {
        setValue(cascade.sectionItem.sectionKey, keyVals[cascade.sectionItem.sectionKey]);
        const parentSel = newRow.querySelector(`[data-key="${cascade.sectionItem.sectionKey}"]`);
        if (parentSel) parentSel.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 3. Set all selects (children will now have correct options)
      columns.forEach(col => {
        if (col.type === 'select') setValue(col.key, keyVals[col.key]);
      });

      // 4. Sync searchable dropdown display for all selects in this row
      newRow.querySelectorAll('select').forEach(sel => sel.dispatchEvent(new Event('change', { bubbles: true })));

      newRow.querySelector('.row-num').textContent = idx + 1;
      tbody.appendChild(newRow);
    });

    // Renumber all rows
    Array.from(tbody.children).forEach((tr, i) => { tr.querySelector('.row-num').textContent = i + 1; });
    UI.initSearchableSelects(spreadsheetDiv);
  },

  addRow(btn) {
    const spreadsheet = btn._spreadsheet || btn.closest('.spreadsheet');
    const tbody = spreadsheet.querySelector('tbody');
    const firstRow = tbody.querySelector('tr');
    const newRow = firstRow.cloneNode(true);
    newRow.querySelectorAll('input, select').forEach(el => { el.value = ''; el.disabled = false; });
    newRow.querySelectorAll('.searchable-select-input').forEach(inp => inp.value = '');
    newRow.querySelectorAll('.searchable-select').forEach(w => { w._searchableObserved = false; });
    // Re-attach cascade listener if needed
    const cascade = spreadsheet._cascade;
    if (cascade && cascade.clientProject) {
      const clientSel = newRow.querySelector(`select[data-key="${cascade.clientProject.clientKey}"]`);
      const projSel = newRow.querySelector(`select[data-key="${cascade.clientProject.projectKey}"]`);
      if (clientSel) clientSel.onchange = function() { Spreadsheet.handleClientProjectCascade(this); };
      if (projSel) { projSel.disabled = true; projSel.onchange = function() { Spreadsheet.handleClientProjectCascade(this); }; }
    }
    if (cascade && cascade.sectionItem) {
      const sectionSel = newRow.querySelector(`select[data-key="${cascade.sectionItem.sectionKey}"]`);
      const itemSel = newRow.querySelector(`select[data-key="${cascade.sectionItem.itemKey}"]`);
      if (sectionSel) sectionSel.onchange = function() { Spreadsheet.handleSectionItemCascade(this); };
      if (itemSel) itemSel.disabled = true;
    }
    newRow.querySelector('.row-num').textContent = tbody.children.length + 1;
    tbody.appendChild(newRow);
    UI.initSearchableSelects(newRow);
  },

  handleClientProjectCascade(el) {
    const row = el.closest('tr');
    const spreadsheet = el.closest('.spreadsheet');
    const cascade = spreadsheet._cascade;
    if (!cascade || !cascade.clientProject) return;
    const { clientKey, projectKey, projects } = cascade.clientProject;
    const clientSel = row.querySelector(`select[data-key="${clientKey}"]`);
    const projSel = row.querySelector(`select[data-key="${projectKey}"]`);
    const projInput = projSel?.closest('.searchable-select')?.querySelector('.searchable-select-input');
    if (!clientSel || !projSel) return;

    // Project changed → auto-select its client and keep the project selected
    if (el.dataset.key === projectKey) {
      const projectId = el.value;
      const project = projects.find(p => String(p.id) === String(projectId));
      if (project && String(clientSel.value) !== String(project.client_id)) {
        clientSel.value = project.client_id;
        clientSel.dispatchEvent(new Event('change', { bubbles: true }));
        const filtered = projects.filter(p => String(p.client_id) === String(project.client_id));
        projSel.innerHTML = '<option value="">-- اختر مشروع --</option>' + filtered.map(p => `<option value="${p.id}">${App.esc(p.name)}</option>`).join('');
        projSel.value = projectId;
        projSel.disabled = false;
      }
      return;
    }

    // Client changed → filter projects, preserving the selection if valid
    const clientId = el.value;
    const previousProject = projSel.value;
    if (!clientId) {
      projSel.innerHTML = '<option value="">-- اختر مشروع --</option>';
      projSel.disabled = true;
      if (projInput) projInput.disabled = true;
      projSel.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const filtered = projects.filter(p => String(p.client_id) === String(clientId));
    projSel.innerHTML = '<option value="">-- اختر مشروع --</option>' + filtered.map(p => `<option value="${p.id}">${App.esc(p.name)}</option>`).join('');
    projSel.disabled = false;
    if (projInput) projInput.disabled = false;
    if (previousProject && filtered.some(p => String(p.id) === String(previousProject))) {
      projSel.value = previousProject;
    } else {
      projSel.value = '';
    }
    projSel.dispatchEvent(new Event('change', { bubbles: true }));
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
    itemSel.innerHTML = '<option value="">-- اختر بند --</option>' + filtered.map(i => `<option value="${i.id}">${App.esc(i.name)}</option>`).join('');
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
        if (!key) return;
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
