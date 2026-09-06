import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleMsgs = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r) => requestFailures.push({ url: r.url(), error: r.failure()?.errorText }));

  await page.goto('http://localhost:3456/#/login', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  console.log('--- console messages ---');
  consoleMsgs.forEach((m) => console.log(`[${m.type}] ${m.text}`));
  console.log('--- page errors ---');
  pageErrors.forEach((e) => console.log(e));
  console.log('--- request failures ---');
  requestFailures.forEach((f) => console.log(`${f.url} :: ${f.error}`));

  await browser.close();
})();
