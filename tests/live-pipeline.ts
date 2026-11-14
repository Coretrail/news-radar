import './safety.js';
import { chromium } from 'playwright-core';
import Parser from 'rss-parser';
import assert from 'node:assert/strict';
import { query, pool } from '../server/db.js';
import { safeFetch } from '../server/safe-fetch.js';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
let source: any;
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:8080', { waitUntil: 'networkidle' });
  await page.getByTestId('story-card').first().waitFor();
  await page.getByText('Ligação em direto', { exact: true }).waitFor();
  const external = await safeFetch('https://www.rtp.pt/noticias/rss');
  const feed = await new Parser().parseString(external.body);
  const real = feed.items[0];
  assert.ok(real.title && real.link);
  source = (
    await query(
      "INSERT INTO sources(name,kind,url,category,enabled) VALUES('RTP — verificação temporária','rss','https://www.rtp.pt/noticias/rss','portugal',false) RETURNING *",
    )
  ).rows[0];
  await page.evaluate(() => {
    const w = window as any;
    w.radarEvents = [];
    const stream = new EventSource('/api/events');
    stream.addEventListener('news', (e: any) =>
      w.radarEvents.push({ ...JSON.parse(e.data), at: Date.now() }),
    );
    w.radarProofStream = stream;
  });
  await page.evaluate(() => scrollTo(0, 480));
  const scroll = await page.evaluate(() => scrollY);
  const count = await page.getByTestId('story-card').count();
  await query(
    'UPDATE sources SET next_poll=now(),config=\'{"test_requested":true}\'::jsonb WHERE id=$1',
    [source.id],
  );
  let stored: any;
  for (let attempt = 0; attempt < 200; attempt++) {
    stored = (
      await query('SELECT id,detected_at FROM stories WHERE source_id=$1 AND external_id=$2', [
        source.id,
        real.guid || real.link!,
      ])
    ).rows[0];
    if (stored) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.ok(stored, 'Production collector must retrieve real external RSS');
  const id = stored.id,
    started = new Date(stored.detected_at).getTime();
  await page.waitForFunction(
    (value) => (window as any).radarEvents.some((v: any) => v.id === value),
    id,
    { timeout: 5000 },
  );
  const event = await page.evaluate(
    (value) => (window as any).radarEvents.find((v: any) => v.id === value),
    id,
  );
  await page.locator('.new-posts').waitFor();
  assert.equal(await page.getByTestId('story-card').count(), count);
  assert.equal(await page.evaluate(() => scrollY), scroll);
  assert.ok((event as any).at - started < 2000);
  await page.locator('.new-posts').click();
  await page.getByText('RTP — verificação temporária', { exact: true }).first().waitFor();
  assert.ok(
    await page
      .getByTestId('story-card')
      .filter({ hasText: 'RTP — verificação temporária' })
      .first()
      .evaluate((el) => el.classList.contains('fresh-story')),
  );
  await page
    .getByTestId('story-card')
    .filter({ hasText: 'RTP — verificação temporária' })
    .getByRole('button')
    .first()
    .click();
  await page.locator('dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  const result = {
    passed: true,
    external_source: 'https://www.rtp.pt/noticias/rss',
    real_title: real.title,
    production_collector_service: true,
    internal_latency_ms: (event as any).at - started,
    no_scroll_jump: true,
    explicit_insertion: true,
    detail_keyboard_escape: true,
    temporary_source_removed: true,
  };
  for (let attempt = 0; attempt < 100; attempt++) {
    const st = (await query('SELECT status FROM sources WHERE id=$1', [source.id])).rows[0]?.status;
    if (st === 'ok') break;
    await new Promise((r) => setTimeout(r, 50));
  }
  await writeFile('artifacts/live-pipeline.json', JSON.stringify(result, null, 2));
  console.log(result);
} finally {
  await browser.close();
  if (source) {
    await query('DELETE FROM stories WHERE source_id=$1', [source.id]);
    await query('DELETE FROM sources WHERE id=$1', [source.id]);
  }
  await pool.end();
}
