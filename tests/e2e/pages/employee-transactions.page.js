import { fillModal, submitModal } from '../helpers/forms.js';

export class EmployeeTransactionsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/employee-transactions');
    await this.page.locator('#emp-tx-standalone-tbl').waitFor();
  }

  async addTransaction(fields) {
    await this.page.locator('button:has-text("+ إضافة معاملة")').click();
    await fillModal(this.page, fields);
    await submitModal(this.page);
  }

  async filterByType(type) {
    await this.page.locator('#emp-tx-type-filter').selectOption(type);
  }

  async search(term) {
    const searchInput = this.page.locator('#emp-tx-standalone-tbl-search');
    await searchInput.fill(term);
    await searchInput.press('Enter');
    await this.page.waitForTimeout(300);
  }
}
