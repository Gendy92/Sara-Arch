// READ-ONLY smoke test against the LIVE site (https://gendy92.github.io/Sara-Arch/).
// Logs in, views the dashboard and two list screens, captures console errors.
// Never writes data: no add/edit/delete actions, no restore, no exports.
// Usage: node scripts/smoke-live.cjs  (env SARA_LIVE_PASSWORD, default 'admin')
'use strict';

const { chromium } = require('@playwright/test');

const BASE = process.env.E2E_BASE_URL || 'https://gendy92.github.io/Sara-Arch/';
const PASSWORD = process.env.SARA_LIVE_PASSWORD || 'admin';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ locale: 'ar-EG', timezoneId: 'Africa/Cairo' });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + (e && e.message ? e.message : String(e))));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form[data-form="login"]', { timeout: 60000 });
  console.log('PASS  live login screen rendered');

  await page.fill('form[data-form="login"] input[name="username"]', 'admin');
  await page.fill('form[data-form="login"] input[name="password"]', PASSWORD);
  await page.click('form[data-form="login"] button[type="submit"]');
  try {
    await page.locator('.kpi-grid').waitFor({ timeout: 45000 });
  } catch (e) {
    const msg = await page.evaluate(() => {
      const app = document.getElementById('app');
      return app ? app.innerText.replace(/\n+/g, ' | ').slice(0, 300) : '(no #app)';
    });
    console.log('FAIL  live login did not reach dashboard. Page says: ' + msg);
    process.exit(1);
  }
  console.log('PASS  live login OK — dashboard KPIs loaded');

  // Visit read-only list screens
  for (const [hash, name] of [['#/clients', 'العملاء'], ['#/vendors', 'الموردين'], ['#/reports', 'التقارير']]) {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const text = await page.evaluate(() => document.body.innerText.slice(0, 60).replace(/\n/g, ' '));
    console.log(`PASS  screen ${hash} rendered: "${text.slice(0, 50)}"`);
  }
  await page.screenshot({ path: 'smoke-live.png', fullPage: false });

  const fatal = errors.filter(e => !/favicon|net::ERR_ABORTED|Failed to load resource|sw\.js|serviceWorker/i.test(e));
  if (fatal.length) {
    console.log('WARN  console errors on live site:');
    fatal.slice(0, 8).forEach(e => console.log('   ' + e.slice(0, 200)));
    process.exitCode = 1;
  } else {
    console.log('PASS  no unexpected console errors');
  }
  await browser.close();
  console.log('LIVE SMOKE DONE');
})().catch(e => { console.error('LIVE SMOKE FAILED:', e.message); process.exit(1); });
