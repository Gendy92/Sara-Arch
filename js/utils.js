// ─── SHARED UTILITIES ───
// Pure helper functions used across the app. Kept separate so they can be
// unit-tested independently of the DOM or Supabase.

const Utils = {
  esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  fmtMoney(n, currency = 'ج.م') {
    return (+n || 0).toLocaleString('ar-EG') + ' ' + currency;
  },

  fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('ar-EG') : '-';
  },

  fmtTxType(type) {
    const map = {
      project_deposit: 'عربون مشروع',
      project_expense: 'مصروف مشروع',
      office_expense: 'مصروف مكتبي',
      owner_deposit: 'توريد صاحب المكتب',
      owner_withdrawal: 'سحب صاحب المكتب',
      supervision: 'إشراف مشروع',
      design: 'تصميم مشروع',
      income: 'إيراد',
      expense: 'مصروف',
      deposit: 'عربون',
      withdrawal: 'سحب',
      client_return: 'مرتجع عميل',
      vendor_settlement: 'تسديد متأخرات مورد',
      office_income: 'إيراد مكتب',
      transfer: 'تحويل داخلي',
      custody_return: 'رد عهدة',
      retention_withheld: 'ضمان أعمال محجوز',
      retention_released: 'إرجاع ضمان أعمال'
    };
    return map[type] || type;
  },

  ilikeOr(fields, term) {
    if (!term) return '';
    const t = encodeURIComponent(`*${term}*`);
    return `&or=(${fields.map(f => `${f}.ilike.${t}`).join(',')})`;
  },

  clamp(num, min, max) {
    return Math.min(Math.max(+num || 0, min), max);
  },

  isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
