import './safety.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext();
await context.addInitScript(() => {
  const Native = window.EventSource;
  (window as any).radarStreams = [];
  window.EventSource = class extends Native {
    constructor(url: string | URL, options?: EventSourceInit) {
      super(url, options);
      (window as any).radarStreams.push(this);
    }
  } as any;
});
const page = await context.newPage();
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:8080', { waitUntil: 'networkidle' });
  await page.getByTestId('story-card').first().waitFor();
  assert.equal(await page.locator('.new-posts').count(), 0);
  await page.evaluate(() =>
    (window as any).radarStreams.forEach((s: EventSource) =>
      s.dispatchEvent(new Event('connected')),
    ),
  );
  await page.waitForTimeout(500);
  const text = await page.locator('.new-posts').allTextContents();
  assert.equal(
    text.length,
    0,
    'No arrivals: reconnect must not show old stories as new: ' + text.join(''),
  );
  console.log('SSE reconnection without arrivals: no false-new counter');
} finally {
  await browser.close();
}
