export class TransactionsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/transactions');
    await this.page.locator('#tx-kpis').waitFor();
  }

  getKpi(label) {
    return this.page.locator('.kpi-card', { hasText: label });
  }

  async filter(type) {
    const labels = { all: 'الكل', deposit: 'الإيداعات', expense: 'المصروفات' };
    await this.page.locator(`button:has-text("${labels[type]}")`).click();
    await this.page.waitForTimeout(300);
  }
}
