export class NotificationsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/notifications');
    await this.page.locator('#notifications-tbl').waitFor();
  }

  getBellBadge() {
    return this.page.locator('#bell-badge');
  }

  async openBellDropdown() {
    await this.page.locator('#bell-btn').click();
    await this.page.locator('#notification-dropdown .notification-item').first().waitFor();
  }

  async markFirstReadInDropdown() {
    await this.page.locator('#notification-dropdown button:has-text("تحديد كمقروء")').first().click();
  }

  async setFilter(filter) {
    // filter: 'all' | 'unread' | 'archived'
    const label = filter === 'unread' ? 'غير مقروء' : filter === 'archived' ? 'مؤرشف' : 'الكل';
    await this.page.locator(`#notifications-tbl button:has-text("${label}")`).first().click();
    await this.page.waitForTimeout(300);
  }

  async archiveFirst() {
    await this.page.locator('#notifications-tbl button:has-text("أرشفة")').first().click();
    await this.page.waitForTimeout(300);
  }
}
