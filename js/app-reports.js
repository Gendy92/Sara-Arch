// App Reports
Object.assign(App, {
  async exportAgingVendorsExcel() {
    try {
      const rows = (this._agingData?.vendors || []).map(r => [r.name, r.balance, r.lastDate ? new Date(r.lastDate).toLocaleDateString('ar-EG') : '-']);
      const ws = XLSX.utils.aoa_to_sheet([
        ['مستحقات للموردين'],
        ['المورد', 'المبلغ المستحق', 'آخر معاملة'],
        ...rows
      ]);
      ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'مستحقات الموردين');
      XLSX.writeFile(wb, `مستحقات-الموردين-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e) {
      UI.toast('خطأ في تصدير Excel: ' + e.message, 'error');
    }
  },
});
