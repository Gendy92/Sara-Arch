export class ReportsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/reports');
    await this.page.locator('#reports-content').waitFor();
  }

  async switchTab(tab) {
    const labelMap = { cashflow: 'التدفق النقدي', pl: 'الأرباح والخسائر', office: 'تدفق المكتب', aging: 'مستحقات وتقادم' };
    await this.page.locator(`button:has-text("${labelMap[tab]}")`).click();
    await this.page.waitForTimeout(300);
  }

  async setDateRange(from, to) {
    await this.page.locator('#reports-from').fill(from);
    await this.page.locator('#reports-to').fill(to);
  }

  async refresh() {
    await this.page.locator('button:has-text("تحديث")').click();
    await this.page.waitForTimeout(400);
  }
}
