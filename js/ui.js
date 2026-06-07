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
      const v = values[f.name] !== undefined ? values[f.name] : (f.default || '');
      if (f.type === 'textarea') return `<div class="form-group" style="grid-column:1/-1"><label>${f.label}${f.req ? ' *' : ''}</label><textarea name="${f.name}" rows="3" ${f.req ? 'required' : ''}>${v}</textarea></div>`;
      if (f.type === 'select') return `<div class="form-group"><label>${f.label}${f.req ? ' *' : ''}</label><select name="${f.name}" ${f.req ? 'required' : ''}>${f.opts.map(o => `<option value="${o.v}" ${v === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}</select></div>`;
      if (f.type === 'date') return `<div class="form-group"><label>${f.label}${f.req ? ' *' : ''}</label><input type="date" name="${f.name}" value="${v}" ${f.req ? 'required' : ''} /></div>`;
      if (f.type === 'number') return `<div class="form-group"><label>${f.label}${f.req ? ' *' : ''}</label><input type="number" name="${f.name}" value="${v}" ${f.req ? 'required' : ''} step="any" /></div>`;
      return `<div class="form-group"><label>${f.label}${f.req ? ' *' : ''}</label><input type="text" name="${f.name}" value="${v}" ${f.req ? 'required' : ''} /></div>`;
    }).join('')}</div><div style="display:flex;gap:8px;margin-top:20px"><button type="submit" class="btn btn-primary">حفظ</button><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">إلغاء</button></div>`;
  },

  actions(id, onEdit, onDel) {
    return `<div class="table-actions"><button class="btn btn-sm btn-secondary" onclick="${onEdit}('${id}')">تعديل</button><button class="btn btn-sm btn-red" onclick="${onDel}('${id}')">حذف</button></div>`;
  }
};

// ─── EXCEL-LIKE SPREADSHEET COMPONENT ───
const Spreadsheet = {
  open(title, columns, onSave) {
    const content = this.render(columns);
    UI.openModal(title, content, null);

    const modalBody = document.querySelector('.modal-body');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.cssText = 'margin-top:16px;width:100%';
    saveBtn.textContent = '💾 حفظ الكل';
    saveBtn.onclick = async () => {
      const rows = this.getData(modalBody);
      if (rows.length === 0) { UI.toast('لا يوجد بيانات للحفظ', 'error'); return; }
      saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ...';
      try {
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

  render(columns) {
    const headerCells = columns.map(c => `<th>${c.label}</th>`).join('');
    const inputCells = columns.map(c => {
      if (c.type === 'select') {
        return `<td><select data-key="${c.key}">${c.opts.map(o => `<option value="${o.v}">${o.l}</option>`).join('')}</select></td>`;
      }
      const inputType = c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text';
      return `<td><input type="${inputType}" data-key="${c.key}" placeholder="${c.label.replace(/\*/g,'').trim()}" /></td>`;
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

  addRow(btn) {
    const spreadsheet = btn.closest('.spreadsheet');
    const tbody = spreadsheet.querySelector('tbody');
    const firstRow = tbody.querySelector('tr');
    const newRow = firstRow.cloneNode(true);
    newRow.querySelectorAll('input, select').forEach(el => el.value = '');
    newRow.querySelector('.row-num').textContent = tbody.children.length + 1;
    tbody.appendChild(newRow);
  },

  removeRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    if (tbody.children.length <= 1) return;
    row.remove();
    Array.from(tbody.children).forEach((tr, i) => { tr.querySelector('.row-num').textContent = i + 1; });
  },

  getData(container) {
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
      if (hasData) rows.push(row);
    });
    return rows;
  }
};

window.UI = UI;
window.Spreadsheet = Spreadsheet;
