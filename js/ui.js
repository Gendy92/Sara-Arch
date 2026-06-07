// UI Helpers

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
      if (form) form.addEventListener('submit', (e) => { e.preventDefault(); onSubmit(form); });
    }
    document.body.style.overflow = 'hidden';
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
