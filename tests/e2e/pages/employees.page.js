import { fillSpreadsheet, saveSpreadsheet } from '../helpers/forms.js';

export class EmployeesPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/employees');
    await this.page.locator('#emp-tbl').waitFor();
  }

  async addEmployee(rows) {
    await this.page.locator('button:has-text("+ إضافة موظفين")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }
}
