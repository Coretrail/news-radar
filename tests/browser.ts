import './safety.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://localhost:8080';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('artifacts', { recursive: true });
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByTestId('story-card').first().waitFor();
  assert.ok((await page.getByTestId('story-card').count()) > 0);
  assert.match(await page.locator('body').innerText(), /Notícias Radar/);
  await page.screenshot({ path: 'artifacts/desktop-dark.png', fullPage: true });
  const first = page.getByTestId('story-card').first();
  const originalUrl = await first
    .getByRole('link', { name: 'Abrir original', exact: true })
    .getAttribute('href');
  assert.ok(originalUrl);
  await first.getByRole('button', { name: 'Guardar favorito' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Favoritos', exact: true }).first().click();
  await page
    .locator('a[href=' + JSON.stringify(originalUrl) + ']')
    .first()
    .waitFor();
  await page.getByRole('button', { name: 'Feed em direto', exact: true }).first().click();
  const sampleTitle = await first.locator('h3').innerText();
  const searchTerm = sampleTitle.split(/\s+/).find((word) => word.length >= 4) || sampleTitle;
  await page.getByRole('searchbox').fill(searchTerm);
  await page.waitForTimeout(700);
  assert.ok((await page.getByTestId('story-card').count()) > 0);
  await page.getByRole('searchbox').fill('zzzz-no-results-918273');
  await page.getByText('Sem publicações para estes filtros.').waitFor();
  await page.getByRole('searchbox').fill('');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.screenshot({ path: 'artifacts/desktop-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  for (const [name, width, height] of [
    ['tablet', 820, 1180],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${name} horizontal overflow`,
    );
  }
  await page.goto(base + '/admin', { waitUntil: 'networkidle' });
  assert.ok(await page.getByRole('heading', { name: /Acesso administrativo/ }).isVisible());
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(
    'artifacts/browser-result.json',
    JSON.stringify(
      {
        passed: true,
        errors,
        tests: [
          'real stories',
          'favorite reload',
          'search',
          'empty state',
          'light theme',
          'tablet',
          'mobile no overflow',
          'admin guarded',
        ],
      },
      null,
      2,
    ),
  );
  console.log('Browser checks passed');
} finally {
  await browser.close();
}
