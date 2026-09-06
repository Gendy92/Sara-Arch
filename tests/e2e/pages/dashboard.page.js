export class DashboardPage {
  constructor(page) {
    this.page = page;
  }

  async waitForLoaded() {
    await this.page.locator('.kpi-grid').waitFor();
  }

  getKpi(label) {
    return this.page.locator('.kpi-card', { hasText: label });
  }
}
