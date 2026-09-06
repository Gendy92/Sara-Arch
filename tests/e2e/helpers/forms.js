export async function fillSpreadsheet(page, rows) {
  const spreadsheet = page.locator('.modal-overlay .spreadsheet');
  await spreadsheet.waitFor();

  const dataRows = spreadsheet.locator('tbody tr');
  const existingCount = await dataRows.count();

  for (let i = existingCount; i < rows.length; i += 1) {
    await page.locator('.modal-overlay button:has-text("+ إضافة صف")').click();
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = dataRows.nth(i);
    const values = rows[i];
    for (const [key, value] of Object.entries(values)) {
      const cell = row.locator(`[data-key="${key}"]`);
      const select = cell.locator('select');
      const count = await select.count();
      if (count > 0) {
        await select.selectOption(String(value));
        await select.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
      } else {
        const input = cell.locator('input, textarea');
        await input.fill(String(value));
      }
    }
  }
}

export async function saveSpreadsheet(page) {
  await page.locator('.modal-overlay button:has-text("💾 حفظ الكل")').click();
  await page.locator('.modal-overlay').waitFor({ state: 'detached' });
}

export async function fillModal(page, fields) {
  const overlay = page.locator('.modal-overlay');
  await overlay.waitFor();

  for (const [name, value] of Object.entries(fields)) {
    const field = overlay.locator(`[name="${name}"]`);
    const select = field.locator('select');
    const count = await select.count();
    if (count > 0) {
      await select.selectOption(String(value));
      await select.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    } else {
      await field.fill(String(value));
    }
  }
}

export async function submitModal(page) {
  await page.locator('.modal-overlay button[type="submit"]:has-text("حفظ")').click();
  await page.locator('.modal-overlay').waitFor({ state: 'detached' });
}

export async function selectSearchable(page, selector, value) {
  const wrapper = page.locator(`${selector}.searchable-select`);
  await wrapper.locator('.searchable-select-input').click();
  await wrapper.locator(`.searchable-select-option[data-value="${value}"]`).click();
}
