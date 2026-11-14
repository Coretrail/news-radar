import './safety.js';
import { chromium } from 'playwright-core';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { query, pool } from '../server/db.js';
import { hashPassword } from '../server/auth.js';

const base = process.env.TEST_URL || 'http://localhost:8080';
const username = 'navigation-' + randomUUID().slice(0, 8);
const password = randomBytes(24).toString('base64url');
const fixtureHandle = `navigation-fixture-${randomUUID().slice(0, 8)}.test`;
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(5000);
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await query("INSERT INTO accounts(handle,category,enabled) VALUES($1,'tecnologia',false)", [
    fixtureHandle,
  ]);
  await query('INSERT INTO admins(username,password_hash) VALUES($1,$2)', [
    username,
    await hashPassword(password),
  ]);
  const login = await context.request.post(base + '/api/auth/login', {
    data: { username, password },
  });
  assert.equal(login.status(), 200);
  await page.goto(base + '/admin', { waitUntil: 'networkidle' });
  await page.locator('.admin-list .admin-row').first().waitFor();
  await page.getByRole('button', { name: 'Categorias', exact: true }).click();
  await page
    .locator('.admin-list .admin-row')
    .filter({ hasText: 'Sem filtro obrigatório' })
    .first()
    .waitFor();
  assert.equal(await page.locator('.admin-list .admin-row').count(), 8);
  assert.deepEqual(errors, [], 'Navigation must not crash React');
  console.log('Fontes → Categorias: eight real categories rendered without browser errors');
  // Each section uses its real endpoint; switching back from the system object must be safe too.
  for (const title of ['Contas', 'Palavras-chave', 'Alertas', 'Sistema', 'Categorias', 'Fontes']) {
    await page.getByRole('button', { name: title, exact: true }).click();
    if (title === 'Sistema')
      await page.getByRole('heading', { name: 'Estado dos serviços', exact: true }).waitFor();
    else if (title === 'Alertas')
      await page.getByRole('heading', { name: 'Histórico de alertas', exact: true }).waitFor();
    else await page.locator('.admin-toolbar').waitFor();
  }

  // A real categories response is held until another section has finished loading.
  let release!: () => void, intercepted!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    intercepted = resolve;
  });
  await page.route('**/api/admin/categories', async (route) => {
    const response = await route.fetch();
    intercepted();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Categorias', exact: true }).click();
  await waiting;
  assert.ok(await page.getByRole('status').filter({ hasText: 'A carregar secção' }).isVisible());
  assert.equal(await page.locator('.admin-list .admin-row').count(), 0);
  await page.getByRole('button', { name: 'Contas', exact: true }).click();
  await page.locator('.admin-toolbar').waitFor();
  const account = (await (await context.request.get(base + '/api/admin/accounts')).json()).find(
    (record: any) => record.handle === fixtureHandle,
  );
  assert.ok(account);
  await page.getByText(account.handle, { exact: true }).waitFor();
  const late = page.waitForResponse((r) => r.url().endsWith('/api/admin/categories'));
  release();
  await (await late).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  assert.ok(await page.getByText(account.handle, { exact: true }).isVisible());
  assert.equal(await page.locator('.admin-tabs button.active').innerText(), 'Contas');
  await page.unroute('**/api/admin/categories');

  // An unavailable endpoint leaves a working retry path instead of unmounting the admin.
  await page.route('**/api/admin/categories', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Falha temporária no teste' }),
    }),
  );
  await page.getByRole('button', { name: 'Categorias', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Falha temporária no teste' }).waitFor();
  await page.unroute('**/api/admin/categories');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await page.locator('.admin-toolbar').waitFor();
  assert.equal(await page.locator('.admin-list .admin-row').count(), 8);
  await page
    .locator('.admin-list .admin-row')
    .first()
    .getByRole('button', { name: 'Editar', exact: true })
    .click();
  await page.getByRole('dialog', { name: 'Editar registo' }).waitFor();
  if (new URL(base).protocol === 'https:') {
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText('Alterações guardadas.', { exact: true }).waitFor();
  } else {
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
  await page.locator('.admin-toolbar').waitFor();
  assert.equal(await page.locator('.admin-list .admin-row').count(), 8);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'artifacts/admin-categories-fixed.png' });
  console.log(
    'All admin sections, delayed responses, loading, error/retry and category editor: passed',
  );
} catch (e) {
  console.error('Browser errors:', errors);
  await page.screenshot({ path: 'artifacts/admin-navigation-failure.png' });
  throw e;
} finally {
  await query('DELETE FROM accounts WHERE handle=$1', [fixtureHandle]);
  await browser.close();
  await query('DELETE FROM audit WHERE admin_id=(SELECT id FROM admins WHERE username=$1)', [
    username,
  ]);
  await query('DELETE FROM admins WHERE username=$1', [username]);
  await pool.end();
}
