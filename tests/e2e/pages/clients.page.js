import { fillSpreadsheet, saveSpreadsheet } from '../helpers/forms.js';

export class ClientsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/clients');
    await this.page.locator('#clients-list').waitFor();
  }

  async addClient(rows) {
    await this.page.locator('button:has-text("+ إضافة عميل")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }

  async search(term) {
    const searchInput = this.page.locator('#clients-list-search');
    await searchInput.fill(term);
    await searchInput.press('Enter');
    await this.page.waitForTimeout(300);
  }

  async openClient(name) {
    await this.page.locator('.client-card-header', { hasText: name }).locator(`a:has-text("${name}")`).first().click();
    await this.page.locator('#client-detail').waitFor();
  }

  async openEditForClient(name) {
    const card = this.page.locator('.client-card', { hasText: name }).first();
    await card.locator('button:has-text("تعديل")').first().click();
  }
}
