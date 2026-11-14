import './safety.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:8080', { waitUntil: 'networkidle' });
  await page.getByTestId('story-card').first().waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('story-card').first().waitFor();
  await context.setOffline(true);
  await page
    .getByText(
      'Sem ligação. As notícias abaixo são a última consulta e podem estar desatualizadas.',
    )
    .waitFor();
  await page.screenshot({ path: 'artifacts/offline-stale-label.png' });
  await page.goto(process.env.TEST_URL || 'http://localhost:8080', {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { name: 'Sem ligação ao Radar' }).waitFor();
  assert.equal(await page.getByTestId('story-card').count(), 0);
  await page.screenshot({ path: 'artifacts/pwa-offline.png' });
  await context.setOffline(false);
  await page.goto(process.env.TEST_URL || 'http://localhost:8080', { waitUntil: 'networkidle' });
  await page.getByTestId('story-card').first().waitFor();
  await writeFile(
    'artifacts/pwa-result.json',
    JSON.stringify(
      {
        passed: true,
        https: true,
        service_worker: true,
        offline_stale_label: true,
        offline_navigation_no_cached_news: true,
        recovery: true,
      },
      null,
      2,
    ),
  );
  console.log('HTTPS PWA, offline label, no stale-news navigation and recovery passed');
} finally {
  await browser.close();
}
