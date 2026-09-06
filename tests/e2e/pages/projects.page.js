import { fillModal, fillSpreadsheet, saveSpreadsheet, submitModal } from '../helpers/forms.js';

export class ProjectsPage {
  constructor(page) {
    this.page = page;
  }

  async gotoClient(clientName) {
    await this.page.goto('/#/clients');
    await this.page.locator('.client-card', { hasText: clientName }).first().waitFor();
  }

  async addProject(clientName, rows) {
    const card = this.page.locator('.client-card', { hasText: clientName }).first();
    await card.locator('button:has-text("+ إضافة مشروع")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }

  async openProject(projectName) {
    await this.page.locator(`a:has-text("${projectName}")`).first().click();
    await this.page.locator('#project-detail').waitFor();
  }

  async setRetention(projectName, percentage) {
    await this.openProject(projectName);
    await this.page.locator('button:has-text("تعديل")').first().click();
    await fillModal(this.page, { retention_percentage: String(percentage) });
    await submitModal(this.page);
  }

  async addDeposit(rows) {
    await this.page.goto('/#/transactions');
    await this.page.locator('button:has-text("💰 عربون مشروع")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }

  async addExpense(rows) {
    await this.page.goto('/#/transactions');
    await this.page.locator('button:has-text("🔨 مصروف مشروع")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }

  async releaseRetention(amount) {
    await this.page.locator('button:has-text("🔓 إرجاع ضمان")').click();
    await fillModal(this.page, { amount: String(amount) });
    await submitModal(this.page);
  }

  async closePeriod(endDate) {
    await this.page.locator('button:has-text("🔒 قفل دورة إشراف")').click();
    await fillModal(this.page, { date: endDate });
    await submitModal(this.page);
  }

  async openStatement() {
    await this.page.locator('button:has-text("كشف حساب")').first().click();
    await this.page.locator('.statement-preview, .modal-overlay').waitFor();
  }
}
