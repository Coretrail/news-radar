import './safety.js';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright-core';
// UI regression: opening a setup fragment on an already-open /admin must work.
// Authentication writes are intercepted; this synthetic token is never stored in a DB.
const base = process.env.TEST_URL || 'http://localhost:8080';
const token = randomBytes(32).toString('base64url');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const context = await browser.newContext();
  await context.route('**/api/auth/status', (route) =>
    route.fulfill({ json: { initialized: false, authenticated: false } }),
  );
  let submitted: string | undefined;
  await context.route('**/api/auth/setup', (route) => {
    submitted = route.request().postDataJSON().token;
    return route.fulfill({ json: { ok: true } });
  });
  await context.route('**/api/auth/login', (route) => route.fulfill({ json: { ok: true } }));
  const page = await context.newPage();
  await page.goto(base + '/admin', { waitUntil: 'networkidle' });
  await page.getByText('npm run admin:setup', { exact: true }).waitFor();
  await page.goto(base + '/admin#setup=' + token);
  await page.getByLabel('Utilizador', { exact: true }).fill('demo-admin');
  await page.locator('input[name=password]').fill(randomBytes(24).toString('base64url'));
  assert.equal(new URL(page.url()).hash, '');
  const setup = page.waitForResponse((response) => response.url().endsWith('/api/auth/setup'));
  await page.getByRole('button', { name: 'Criar administrador e entrar', exact: true }).click();
  assert.equal((await setup).status(), 200);
  assert.equal(submitted, token);
  console.log(
    'Administrator setup fragment works on an already-open admin page and is removed from the address bar',
  );
} finally {
  await browser.close();
}
