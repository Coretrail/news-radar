import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFetch } from '../server/safe-fetch.js';
test('pedido HTTPS real mantém DNS validado com lookup all do Node 24', async () => {
  const r = await safeFetch('https://www.rtp.pt/noticias/rss');
  assert.equal(r.status, 200);
  assert.match(r.body, /<rss/);
});
