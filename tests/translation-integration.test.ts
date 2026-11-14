import './safety.js';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { query, pool } from '../server/db.js';
import { ingest } from '../server/ingest.js';
import { buildApp } from '../server/app.js';
import {
  claimTranslation,
  completeTranslation,
  failTranslation,
  readTranslationCache,
  writeTranslationCache,
} from '../server/translation/queue.js';
let source: any, app: any;
const cacheText = 'Isolated translation cache fixture';
before(async () => {
  assert.equal(
    process.env.PGDATABASE,
    'newsradar_test',
    'This suite must run in its isolated database',
  );
  await query(
    "INSERT INTO categories(id,name,position) VALUES('tecnologia','Tecnologia',0) ON CONFLICT DO NOTHING",
  );
  source = (
    await query(
      "INSERT INTO sources(name,kind,category,enabled) VALUES('Translation integration','rss','tecnologia',false) RETURNING *",
    )
  ).rows[0];
  app = await buildApp();
});
beforeEach(async () => {
  await query('DELETE FROM stories WHERE source_id=$1', [source.id]);
});
after(async () => {
  if (app) await app.close();
  if (source) {
    await query('DELETE FROM stories WHERE source_id=$1', [source.id]);
    await query('DELETE FROM sources WHERE id=$1', [source.id]);
  }
  await query('DELETE FROM translation_cache WHERE cache_key LIKE $1', ['test-%']);
  await pool.end();
});
const item = (name: string, priority = 'info') =>
  ingest(source, {
    externalId: name,
    url: 'https://example.org/' + name,
    title: 'New measures to protect children online',
    summary: 'The government announced new safety measures.',
    priority,
  });
test('ingestão cria fila e API publica original imediatamente sem aguardar tradução', async () => {
  const id = await item('queue');
  assert.ok(id);
  assert.equal(
    (await query('SELECT status FROM story_translations WHERE story_id=$1', [id])).rows[0].status,
    'pending',
  );
  const r = await app.inject('/api/stories/' + id);
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().title, 'New measures to protect children online');
  assert.equal(r.json().translation_status, 'pending');
});
test('fila privilegia urgente, recupera lease expirada e rejeita resultados de lease antiga', async () => {
  await item('normal');
  const urgent = await item('urgent', 'urgent');
  const a = await claimTranslation();
  assert.ok(a);
  assert.equal(a.id, urgent);
  await query(
    "UPDATE story_translations SET lease_until=now()-interval '1 second' WHERE story_id=$1",
    [urgent],
  );
  const b = await claimTranslation();
  assert.ok(b);
  assert.equal(b.id, urgent);
  assert.notEqual(a.lease_token, b.lease_token);
  assert.equal(
    await completeTranslation(a, {
      title: 'Obsoleto',
      summary: 'Obsoleto',
      language: 'en',
      native: false,
    }),
    false,
  );
  assert.equal(
    await completeTranslation(b, {
      title: 'Novas medidas',
      summary: 'Medidas de segurança.',
      language: 'en',
      native: false,
    }),
    true,
  );
});
test('tradução persiste sem alterar origem e pesquisa encontra português e inglês', async () => {
  const id = await item('projection');
  const job = await claimTranslation();
  assert.ok(job);
  await completeTranslation(job, {
    title: 'Novas medidas para proteger crianças',
    summary: 'O governo anunciou medidas de segurança.',
    language: 'en',
    native: false,
  });
  const r = await app.inject('/api/stories/' + id);
  assert.equal(r.json().title, 'Novas medidas para proteger crianças');
  assert.equal(r.json().original_title, 'New measures to protect children online');
  assert.equal(r.json().translation_status, 'translated');
  assert.equal(
    (await query('SELECT title FROM stories WHERE id=$1', [id])).rows[0].title,
    'New measures to protect children online',
  );
  for (const q of ['crianças', 'children']) {
    const result = (await app.inject('/api/stories?q=' + encodeURIComponent(q))).json();
    assert.ok(
      result.items.some((s: any) => s.id === id),
      q,
    );
  }
});
test('falha mantém notícia disponível e usa retry com backoff; cache é persistente', async () => {
  const id = await item('retry');
  const job = await claimTranslation();
  assert.ok(job);
  await failTranslation(job, Error('Temporary local engine failure'));
  const row = (await query('SELECT * FROM story_translations WHERE story_id=$1', [id])).rows[0];
  assert.equal(row.status, 'failed');
  assert.ok(new Date(row.retry_at).getTime() > Date.now());
  assert.equal(await claimTranslation(), null);
  assert.equal(
    (await app.inject('/api/stories/' + id)).json().title,
    'New measures to protect children online',
  );
  await writeTranslationCache(cacheText, 'en', 'Cache de tradução');
  assert.equal(await readTranslationCache(cacheText, 'en'), 'Cache de tradução');
  assert.equal(await readTranslationCache(cacheText, 'fr'), null);
});
test('conclusão envia evento SSE de tradução separado de novas notícias', async () => {
  const id = await item('event');
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  const controller = new AbortController();
  const response = await fetch(url + '/api/events', { signal: controller.signal });
  const reader = response.body!.getReader();
  await reader.read();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const job = await claimTranslation();
    assert.ok(job);
    await completeTranslation(job, {
      title: 'Novas medidas',
      summary: 'Resumo português.',
      language: 'en',
      native: false,
    });
    let body = '';
    while (!body.includes('event: translation')) {
      const part = await reader.read();
      if (part.done) break;
      body += new TextDecoder().decode(part.value);
    }
    assert.match(body, /event: translation/);
    assert.ok(body.includes(String(id)));
    assert.doesNotMatch(body, /event: news/);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
});
