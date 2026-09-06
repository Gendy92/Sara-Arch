import { fillSpreadsheet, saveSpreadsheet } from '../helpers/forms.js';

export class UsersPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/users');
    await this.page.locator('#users-tbl').waitFor();
  }

  async addUser(rows) {
    await this.page.locator('button:has-text("+ إضافة مستخدمين")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }
}
