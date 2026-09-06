import { fillSpreadsheet, saveSpreadsheet, fillModal, submitModal } from '../helpers/forms.js';

export class OfficePage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/office');
    await this.page.locator('#office-kpis').waitFor();
  }

  async addIncome(rows) {
    await this.page.locator('button:has-text("📈 إيراد مكتبي")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }

  async addExpense(rows) {
    await this.page.locator('button:has-text("🏢 مصروف مكتبي")').first().click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }

  async addTransfer(fields) {
    await this.page.locator('button:has-text("🔄 تحويل بين الحسابات")').click();
    await fillModal(this.page, fields);
    await submitModal(this.page);
  }

  async addCustody(rows) {
    await this.page.locator('button:has-text("💼 عهد نقدية")').click();
    await fillSpreadsheet(this.page, rows);
    await saveSpreadsheet(this.page);
  }

  async addCustodyExpense(custodyId, sectorId, amount) {
    await this.page.locator('button:has-text("🔨 مصروف عهدة")').first().click();
    await this.page.locator('.modal-overlay [name="custody_id"]').selectOption(custodyId);
    await this.page.locator('.modal-overlay [name="custody_id"]').evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await this.page.locator('.modal-overlay [name="expense_type"]').selectOption('office');
    await this.page.locator('.modal-overlay [name="expense_type"]').evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

    const today = new Date().toISOString().slice(0, 10);
    await fillSpreadsheet(this.page, [
      { sector_id: sectorId, amount: String(amount), payment_method: 'cash', date: today, description: 'مصروف عهدة' }
    ]);
    await saveSpreadsheet(this.page);
  }
}
