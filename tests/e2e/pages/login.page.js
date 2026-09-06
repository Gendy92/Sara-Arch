export class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('form[data-form="login"] button[type="submit"]');
  }

  async goto() {
    await this.page.goto('/#/login');
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError() {
    await this.page.locator('text=خطأ في الدخول').waitFor();
  }
}
