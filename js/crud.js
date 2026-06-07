// CRUD Module - Modals, Forms, Toasts, and Data Operations

const UI = {
  // ─── TOASTS ───
  toast(msg, type = 'success') {
    const colors = {
      success: 'var(--green)',
      error: 'var(--red)',
      info: 'var(--blue)',
      warning: 'var(--orange)'
    };
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;top:20px;left:20px;z-index:9999;
      background:${colors[type] || colors.info};
      color:#fff;padding:12px 20px;border-radius:8px;
      font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);
      animation:slideIn 0.3s ease;direction:rtl;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  // ─── MODAL ───
  openModal(title, content, onSubmit) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="UI.closeModal()">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) UI.closeModal();
    });

    // Handle form submission if provided
    if (onSubmit) {
      const form = overlay.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          onSubmit(form);
        });
      }
    }

    document.body.style.overflow = 'hidden';
  },

  closeModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  },

  // ─── CONFIRM DIALOG ───
  confirm(msg, onYes) {
    this.openModal('تأكيد', `
      <p style="margin-bottom:20px;color:var(--text2)">${msg}</p>
      <div style="display:flex;gap:8px;justify-content:flex-start">
        <button class="btn btn-red" id="confirm-yes">نعم، متأكد</button>
        <button class="btn btn-secondary" onclick="UI.closeModal()">إلغاء</button>
      </div>
    `);
    document.getElementById('confirm-yes').addEventListener('click', () => {
      UI.closeModal();
      onYes();
    });
  },

  // ─── FORM BUILDER ───
  buildForm(fields, values = {}) {
    const inputs = fields.map(f => {
      const val = values[f.name] !== undefined ? values[f.name] : (f.default || '');
      if (f.type === 'textarea') {
        return `<div class="form-group"><label>${f.label}${f.required ? ' *' : ''}</label><textarea name="${f.name}" rows="3" ${f.required ? 'required' : ''}>${val}</textarea></div>`;
      }
      if (f.type === 'select') {
        const options = f.options.map(o => `<option value="${o.value}" ${val === o.value ? 'selected' : ''}>${o.label}</option>`).join('');
        return `<div class="form-group"><label>${f.label}${f.required ? ' *' : ''}</label><select name="${f.name}" ${f.required ? 'required' : ''}>${options}</select></div>`;
      }
      if (f.type === 'date') {
        return `<div class="form-group"><label>${f.label}${f.required ? ' *' : ''}</label><input type="date" name="${f.name}" value="${val}" ${f.required ? 'required' : ''} /></div>`;
      }
      if (f.type === 'number') {
        return `<div class="form-group"><label>${f.label}${f.required ? ' *' : ''}</label><input type="number" name="${f.name}" value="${val}" ${f.required ? 'required' : ''} step="any" /></div>`;
      }
      return `<div class="form-group"><label>${f.label}${f.required ? ' *' : ''}</label><input type="text" name="${f.name}" value="${val}" ${f.required ? 'required' : ''} /></div>`;
    }).join('');

    return `<div class="form-grid">${inputs}</div>
      <div style="display:flex;gap:8px;margin-top:20px">
        <button type="submit" class="btn btn-primary">حفظ</button>
        <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">إلغاء</button>
      </div>`;
  },

  // ─── TABLE HELPERS ───
  actionButtons(id, onEdit, onDelete) {
    return `
      <div class="table-actions">
        <button class="btn btn-sm btn-secondary" onclick="${onEdit}('${id}')">تعديل</button>
        <button class="btn btn-sm btn-red" onclick="${onDelete}('${id}')">حذف</button>
      </div>`;
  }
};

// ─── CRUD OPERATIONS ───
const Crud = {
  // Generic save handler
  async save(table, data, id = null) {
    if (id) {
      const { error } = await sb.from(table).update(data).eq('id', id);
      if (error) throw error;
      return { id, ...data };
    } else {
      const { data: inserted, error } = await sb.from(table).insert(data).select().single();
      if (error) throw error;
      return inserted;
    }
  },

  async softDelete(table, id) {
    const { error } = await sb.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  // ─── CLIENTS ───
  openAddClient() {
    const fields = [
      { name: 'name', label: 'اسم العميل', required: true },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد الإلكتروني' },
      { name: 'address', label: 'العنوان' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('عميل جديد', `<form id="client-form">${UI.buildForm(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('clients', {
          name: fd.get('name'),
          phone: fd.get('phone') || null,
          email: fd.get('email') || null,
          address: fd.get('address') || null,
          notes: fd.get('notes') || null
        });
        UI.toast('تم حفظ العميل بنجاح');
        App.loadClients();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  async openEditClient(id) {
    const { data, error } = await sb.from('clients').select('*').eq('id', id).single();
    if (error || !data) { UI.toast('لم يتم العثور على العميل', 'error'); return; }

    const fields = [
      { name: 'name', label: 'اسم العميل', required: true },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد الإلكتروني' },
      { name: 'address', label: 'العنوان' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل عميل', `<form id="client-form">${UI.buildForm(fields, data)}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('clients', {
          name: fd.get('name'),
          phone: fd.get('phone') || null,
          email: fd.get('email') || null,
          address: fd.get('address') || null,
          notes: fd.get('notes') || null
        }, id);
        UI.toast('تم تحديث العميل بنجاح');
        App.loadClients();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  deleteClient(id) {
    UI.confirm('هل أنت متأكد من حذف هذا العميل؟', async () => {
      try {
        await this.softDelete('clients', id);
        UI.toast('تم حذف العميل');
        App.loadClients();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  // ─── PROJECTS ───
  openAddProject() {
    const fields = [
      { name: 'name', label: 'اسم المشروع', required: true },
      { name: 'client_name', label: 'اسم العميل' },
      { name: 'value', label: 'القيمة التعاقدية', type: 'number', default: 0 },
      { name: 'status', label: 'الحالة', type: 'select', options: [
        { value: 'active', label: 'نشط' },
        { value: 'completed', label: 'منتهي' },
        { value: 'on_hold', label: 'معلق' },
        { value: 'cancelled', label: 'ملغي' }
      ]},
      { name: 'start_date', label: 'تاريخ البدء', type: 'date' },
      { name: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('مشروع جديد', `<form id="project-form">${UI.buildForm(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('projects', {
          name: fd.get('name'),
          client_name: fd.get('client_name') || null,
          value: +fd.get('value') || 0,
          status: fd.get('status') || 'active',
          start_date: fd.get('start_date') || null,
          end_date: fd.get('end_date') || null,
          notes: fd.get('notes') || null
        });
        UI.toast('تم حفظ المشروع بنجاح');
        App.loadProjects();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  async openEditProject(id) {
    const { data, error } = await sb.from('projects').select('*').eq('id', id).single();
    if (error || !data) { UI.toast('لم يتم العثور على المشروع', 'error'); return; }

    const fields = [
      { name: 'name', label: 'اسم المشروع', required: true },
      { name: 'client_name', label: 'اسم العميل' },
      { name: 'value', label: 'القيمة التعاقدية', type: 'number' },
      { name: 'status', label: 'الحالة', type: 'select', options: [
        { value: 'active', label: 'نشط' },
        { value: 'completed', label: 'منتهي' },
        { value: 'on_hold', label: 'معلق' },
        { value: 'cancelled', label: 'ملغي' }
      ]},
      { name: 'start_date', label: 'تاريخ البدء', type: 'date' },
      { name: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل مشروع', `<form id="project-form">${UI.buildForm(fields, data)}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('projects', {
          name: fd.get('name'),
          client_name: fd.get('client_name') || null,
          value: +fd.get('value') || 0,
          status: fd.get('status') || 'active',
          start_date: fd.get('start_date') || null,
          end_date: fd.get('end_date') || null,
          notes: fd.get('notes') || null
        }, id);
        UI.toast('تم تحديث المشروع بنجاح');
        App.loadProjects();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  deleteProject(id) {
    UI.confirm('هل أنت متأكد من حذف هذا المشروع؟', async () => {
      try {
        await this.softDelete('projects', id);
        UI.toast('تم حذف المشروع');
        App.loadProjects();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  // ─── EMPLOYEES ───
  openAddEmployee() {
    const fields = [
      { name: 'name', label: 'اسم الموظف', required: true },
      { name: 'job_title', label: 'الوظيفة' },
      { name: 'salary', label: 'الراتب', type: 'number', default: 0 },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد الإلكتروني' },
      { name: 'hire_date', label: 'تاريخ التعيين', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('موظف جديد', `<form id="employee-form">${UI.buildForm(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('employees', {
          name: fd.get('name'),
          job_title: fd.get('job_title') || null,
          salary: +fd.get('salary') || 0,
          phone: fd.get('phone') || null,
          email: fd.get('email') || null,
          hire_date: fd.get('hire_date') || null,
          notes: fd.get('notes') || null
        });
        UI.toast('تم حفظ الموظف بنجاح');
        App.loadEmployees();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  async openEditEmployee(id) {
    const { data, error } = await sb.from('employees').select('*').eq('id', id).single();
    if (error || !data) { UI.toast('لم يتم العثور على الموظف', 'error'); return; }

    const fields = [
      { name: 'name', label: 'اسم الموظف', required: true },
      { name: 'job_title', label: 'الوظيفة' },
      { name: 'salary', label: 'الراتب', type: 'number' },
      { name: 'phone', label: 'الهاتف' },
      { name: 'email', label: 'البريد الإلكتروني' },
      { name: 'hire_date', label: 'تاريخ التعيين', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' }
    ];
    UI.openModal('تعديل موظف', `<form id="employee-form">${UI.buildForm(fields, data)}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('employees', {
          name: fd.get('name'),
          job_title: fd.get('job_title') || null,
          salary: +fd.get('salary') || 0,
          phone: fd.get('phone') || null,
          email: fd.get('email') || null,
          hire_date: fd.get('hire_date') || null,
          notes: fd.get('notes') || null
        }, id);
        UI.toast('تم تحديث الموظف بنجاح');
        App.loadEmployees();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  deleteEmployee(id) {
    UI.confirm('هل أنت متأكد من حذف هذا الموظف؟', async () => {
      try {
        await this.softDelete('employees', id);
        UI.toast('تم حذف الموظف');
        App.loadEmployees();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  // ─── TRANSACTIONS ───
  openAddTransaction() {
    const fields = [
      { name: 'type', label: 'النوع', type: 'select', required: true, options: [
        { value: 'income', label: 'إيراد' },
        { value: 'expense', label: 'مصروف' },
        { value: 'deposit', label: 'عربون' },
        { value: 'supervision', label: 'إشراف' },
        { value: 'office_expense', label: 'مصروف مكتبي' }
      ]},
      { name: 'amount', label: 'المبلغ', type: 'number', required: true, default: 0 },
      { name: 'party_name', label: 'الجهة / الاسم' },
      { name: 'project_name', label: 'المشروع' },
      { name: 'date', label: 'التاريخ', type: 'date' },
      { name: 'description', label: 'الوصف', type: 'textarea' }
    ];
    UI.openModal('معاملة جديدة', `<form id="transaction-form">${UI.buildForm(fields)}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('transactions', {
          type: fd.get('type'),
          amount: +fd.get('amount') || 0,
          party_name: fd.get('party_name') || null,
          project_name: fd.get('project_name') || null,
          date: fd.get('date') || new Date().toISOString().slice(0, 10),
          description: fd.get('description') || null
        });
        UI.toast('تم حفظ المعاملة بنجاح');
        App.loadTransactions();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  async openEditTransaction(id) {
    const { data, error } = await sb.from('transactions').select('*').eq('id', id).single();
    if (error || !data) { UI.toast('لم يتم العثور على المعاملة', 'error'); return; }

    const fields = [
      { name: 'type', label: 'النوع', type: 'select', required: true, options: [
        { value: 'income', label: 'إيراد' },
        { value: 'expense', label: 'مصروف' },
        { value: 'deposit', label: 'عربون' },
        { value: 'supervision', label: 'إشراف' },
        { value: 'office_expense', label: 'مصروف مكتبي' }
      ]},
      { name: 'amount', label: 'المبلغ', type: 'number', required: true },
      { name: 'party_name', label: 'الجهة / الاسم' },
      { name: 'project_name', label: 'المشروع' },
      { name: 'date', label: 'التاريخ', type: 'date' },
      { name: 'description', label: 'الوصف', type: 'textarea' }
    ];
    UI.openModal('تعديل معاملة', `<form id="transaction-form">${UI.buildForm(fields, data)}</form>`, async (form) => {
      const fd = new FormData(form);
      try {
        await this.save('transactions', {
          type: fd.get('type'),
          amount: +fd.get('amount') || 0,
          party_name: fd.get('party_name') || null,
          project_name: fd.get('project_name') || null,
          date: fd.get('date') || new Date().toISOString().slice(0, 10),
          description: fd.get('description') || null
        }, id);
        UI.toast('تم تحديث المعاملة بنجاح');
        App.loadTransactions();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  },

  deleteTransaction(id) {
    UI.confirm('هل أنت متأكد من حذف هذه المعاملة؟', async () => {
      try {
        await this.softDelete('transactions', id);
        UI.toast('تم حذف المعاملة');
        App.loadTransactions();
      } catch (e) {
        UI.toast('خطأ: ' + e.message, 'error');
      }
    });
  }
};

window.UI = UI;
window.Crud = Crud;
