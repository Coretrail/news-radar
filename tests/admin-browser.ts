import './safety.js';
import { chromium } from 'playwright-core';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { query, pool } from '../server/db.js';
import { hashPassword } from '../server/auth.js';
const name = 'browser-' + randomUUID().slice(0, 8),
  password = randomBytes(24).toString('base64url'),
  term = 'browser-rule-' + randomUUID().slice(0, 8);
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
try {
  await query('INSERT INTO admins(username,password_hash) VALUES($1,$2)', [
    name,
    await hashPassword(password),
  ]);
  await page.goto(process.env.TEST_URL || 'http://localhost:8080', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Definições', exact: true }).click();
  await page.waitForTimeout(500);
  assert.equal(
    new URL(page.url()).protocol,
    new URL(process.env.TEST_URL || 'http://localhost:8080').protocol,
    'Admin navigation preserves the configured browser origin',
  );
  await page.getByLabel('Utilizador', { exact: true }).fill(name);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Palavras-chave', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Palavras-chave', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByLabel('Palavra-chave', { exact: true }).fill(term);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByText(term, { exact: true }).waitFor();
  assert.equal(
    (await query('SELECT count(*) FROM rules WHERE term=$1', [term])).rows[0].count,
    '1',
  );
  await page.getByRole('button', { name: 'Sistema', exact: true }).click();
  await page.getByText('Estado dos serviços', { exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/admin-system.png' });
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.getByRole('heading', { name: 'Acesso administrativo', exact: true }).waitFor();
  console.log('Admin origin navigation, login, rule persistence, system metrics and logout passed');
} catch (e) {
  await page.screenshot({ path: 'artifacts/admin-failure.png' });
  console.log((await page.locator('body').innerText()).slice(-2500));
  throw e;
} finally {
  await browser.close();
  await query('DELETE FROM rules WHERE term=$1', [term]);
  await query('DELETE FROM audit WHERE admin_id=(SELECT id FROM admins WHERE username=$1)', [name]);
  await query('DELETE FROM admins WHERE username=$1', [name]);
  await pool.end();
}
