import { fillModal, fillSpreadsheet, saveSpreadsheet, submitModal } from '../helpers/forms.js';

export class VendorsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/vendors');
    await this.page.locator('#vendors-tbl').waitFor();
  }

  async addVendor(rows) {
    await this.page.locator('button:has-text("+ إضافة مورد")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }

  async openVendor(name) {
    await this.page.locator(`a:has-text("${name}")`).first().click();
    await this.page.locator('#vendor-detail').waitFor();
  }

  async addPayment(amount) {
    await this.page.locator('button:has-text("💰 دفع")').first().click();
    await fillModal(this.page, { amount: String(amount) });
    await submitModal(this.page);
  }
}
