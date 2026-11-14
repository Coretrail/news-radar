import './safety.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { query, pool } from '../server/db.js';
const base = process.env.TEST_URL || 'http://localhost:8080';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
await context.addInitScript(() => {
  const Native = window.EventSource;
  (window as any).translationStreams = [];
  window.EventSource = class extends Native {
    constructor(url: string | URL, options?: EventSourceInit) {
      super(url, options);
      (window as any).translationStreams.push(this);
    }
  } as any;
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  let sample: any;
  for (let attempt = 0; attempt < 100; attempt++) {
    sample = (
      await query(
        "SELECT s.*,t.title_pt FROM stories s JOIN story_translations t ON t.story_id=s.id WHERE t.status='translated' AND t.title_pt!=s.title ORDER BY s.detected_at DESC LIMIT 1",
      )
    ).rows[0];
    if (sample) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(sample, 'Needs a real completed translation');
  const api = await context.request.get(base + '/api/stories/' + sample.id);
  assert.equal((await api.json()).title, sample.title_pt);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('searchbox').fill(sample.title_pt);
  const card = page.getByTestId('story-card').filter({ hasText: sample.title_pt });
  await card.first().waitFor();
  assert.ok(await card.first().getByText('PT-PT automático', { exact: true }).isVisible());
  await card.first().locator('.story-title').click();
  await page.locator('dialog[open]').waitFor();
  await page.getByText('Ver texto original', { exact: true }).click();
  assert.ok(
    await page.locator('dialog[open]').getByText(sample.title, { exact: true }).isVisible(),
  );
  assert.equal(
    await page
      .locator('dialog[open]')
      .getByRole('link', { name: 'Abrir fonte original' })
      .getAttribute('href'),
    sample.url,
  );
  await page.keyboard.press('Escape');
  const before = await page.locator('.new-posts').allTextContents();
  const updated = page.waitForResponse((r) => r.url().includes('/api/translations?'));
  await query("SELECT pg_notify('newsradar_translation',$1)", [
    JSON.stringify({ id: sample.id, status: 'translated' }),
  ]);
  await updated;
  await page.waitForTimeout(250);
  assert.deepEqual(
    await page.locator('.new-posts').allTextContents(),
    before,
    'Translation must not count as a new story',
  );
  // More than100 loaded stories plus a separate regional detail must all recover after reconnect.
  await page.getByRole('searchbox').fill('');
  const categoryResponse = page.waitForResponse((r) => {
    const u = new URL(r.url());
    return (
      u.pathname === '/api/stories' &&
      u.searchParams.get('category') === 'tecnologia' &&
      !u.searchParams.has('since') &&
      !u.searchParams.has('q')
    );
  });
  await page.getByRole('button', { name: 'Tecnologia', exact: true }).first().click();
  await categoryResponse;
  await page.locator('.feed-list[aria-busy="false"]').waitFor();
  let lastId = '';
  for (let i = 0; i < 3; i++) {
    const count = await page.getByTestId('story-card').count();
    const response = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return u.pathname === '/api/stories' && u.searchParams.get('offset') === String(count);
    });
    await page.getByRole('button', { name: 'Carregar mais publicações' }).click();
    const data = await (await response).json();
    lastId = data.items.at(-1).id;
    await page.waitForFunction(
      (previous) => document.querySelectorAll('[data-testid="story-card"]').length > previous,
      count,
    );
  }
  assert.ok((await page.getByTestId('story-card').count()) > 100);
  const detailResponse = page.waitForResponse((r) =>
    /\/api\/stories\/\d+$/.test(new URL(r.url()).pathname),
  );
  await page.locator('.right-column .local-item').first().click();
  const outsideId = (await (await detailResponse).json()).id;
  await page.locator('dialog[open]').waitFor();
  const requested = new Set<string>();
  page.on('request', (request) => {
    const u = new URL(request.url());
    if (u.pathname === '/api/translations')
      for (const id of (u.searchParams.get('ids') || '').split(',')) requested.add(id);
  });
  await page.evaluate(() =>
    (window as any).translationStreams.forEach((stream: EventSource) =>
      stream.dispatchEvent(new Event('connected')),
    ),
  );
  for (let i = 0; i < 80 && !requested.has(lastId); i++) await page.waitForTimeout(25);
  assert.ok(requested.has(lastId), 'Reconnect must recover translations beyond the first100 cards');
  assert.ok(requested.has(outsideId), 'Reconnect must also update a separately opened detail');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'artifacts/translation-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'artifacts/translation-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'Real PT-PT translations, Portuguese search, original disclosure, translation SSE and responsive browser checks passed',
  );
} finally {
  await browser.close();
  await pool.end();
}
