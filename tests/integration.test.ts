import './safety.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/app.js';
import { query, pool } from '../server/db.js';
import { ingest } from '../server/ingest.js';
import { hashPassword } from '../server/auth.js';
let app: any;
let storyId: string;
let source: any;
let cookie = '';
after(async () => {
  if (source) {
    await query('DELETE FROM stories WHERE source_id=$1', [source.id]);
    await query('DELETE FROM sources WHERE id=$1', [source.id]);
  }
  await query("DELETE FROM admins WHERE username='integration-check'");
  if (app) await app.close();
  await pool.end();
});
test('cadeia PostgreSQL/API: idempotência, pesquisa e estado por dispositivo', async () => {
  app = await buildApp();
  source = (
    await query(
      "INSERT INTO sources(name,kind,category,enabled) VALUES('Integration temporary','rss','tecnologia',false) RETURNING *",
    )
  ).rows[0];
  const item = {
    externalId: 'test-1',
    url: 'https://example.org/integration',
    title: 'Integration persistence check',
    summary: 'Temporary controlled fixture',
    publishedAt: new Date().toISOString(),
  };
  const inserted = await ingest(source, item);
  assert.ok(inserted);
  storyId = inserted;
  assert.equal(await ingest(source, item), null);
  let r = await app.inject('/api/stories?q=Integration%20persistence');
  assert.equal(r.statusCode, 200);
  assert.ok(r.json().items.some((s: any) => s.id === storyId));
  cookie = r.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
  r = await app.inject({
    method: 'PATCH',
    url: `/api/stories/${storyId}/state`,
    headers: { cookie },
    payload: { favorite: true, read: true },
  });
  assert.equal(r.statusCode, 200);
  r = await app.inject({ url: '/api/stories?view=favorites', headers: { cookie } });
  assert.ok(r.json().items.some((s: any) => s.id === storyId && s.favorite && s.read_at));
  r = await app.inject(`/api/stories?source=${source.id}&q=${encodeURIComponent("' OR 1=1 --")}`);
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().items.length, 0);
});
test('admin exige sessão e recusa pedidos cross-origin', async () => {
  assert.equal((await app.inject('/api/admin/sources')).statusCode, 401);
  await query('INSERT INTO admins(username,password_hash) VALUES($1,$2)', [
    'integration-check',
    await hashPassword('Testing-only-password-123'),
  ]);
  let r = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'integration-check', password: 'Testing-only-password-123' },
  });
  assert.equal(r.statusCode, 200);
  const session = r.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
  assert.equal(
    (await app.inject({ url: '/api/admin/sources', headers: { cookie: session } })).statusCode,
    200,
  );
  r = await app.inject({
    method: 'PATCH',
    url: `/api/admin/sources/${source.id}`,
    headers: { cookie: session, origin: 'https://evil.example' },
    payload: { enabled: true },
  });
  assert.equal(r.statusCode, 403);
  r = await app.inject({
    method: 'PATCH',
    url: `/api/admin/sources/${source.id}`,
    headers: { cookie: session },
    payload: { url: 'https://127.0.0.1/' },
  });
  assert.equal(r.statusCode, 400);
});
test('paginação e datas inválidas não produzem erros de base de dados', async () => {
  for (const url of [
    '/api/stories?limit=999999',
    '/api/stories?from=garbage',
    '/api/stories?offset=-1',
  ])
    assert.equal((await app.inject(url)).statusCode, 400, url);
  assert.equal((await app.inject('/api/stories?category=castelo-branco')).statusCode, 200);
});

test('overview devolve métricas, alertas e destaques locais reais', async () => {
  const r = await app.inject('/api/overview');
  assert.equal(r.statusCode, 200);
  assert.ok(Array.isArray(r.json().local));
  assert.ok(Number(r.json().stats.total) > 0);
});

test('rebaixar urgente elimina alerta ativo e cursor recupera apenas novos IDs', async () => {
  const adminRow = (
    await query(
      "INSERT INTO admins(username,password_hash) VALUES('regression-check',$1) RETURNING id",
      [await hashPassword('Regression-check-password')],
    )
  ).rows[0];
  try {
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'regression-check', password: 'Regression-check-password' },
    });
    const session = r.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/stories/' + storyId,
      headers: { cookie: session },
      payload: { priority: 'urgent', status: 'unconfirmed' },
    });
    assert.ok((await app.inject('/api/overview')).json().alerts.some((a: any) => a.id === storyId));
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/stories/' + storyId,
      headers: { cookie: session },
      payload: { priority: 'info', status: 'corrected' },
    });
    assert.equal(
      (await app.inject('/api/overview')).json().alerts.some((a: any) => a.id === storyId),
      false,
    );
    const list = (await app.inject('/api/stories')).json();
    assert.match(list.cursor, /^\d+$/);
    const updates = await app.inject('/api/updates?after=' + list.cursor);
    assert.equal(updates.statusCode, 200);
    assert.equal(updates.json().ids.length, 0);
  } finally {
    await query('DELETE FROM audit WHERE admin_id=$1', [adminRow.id]);
    await query('DELETE FROM admins WHERE id=$1', [adminRow.id]);
  }
});

test('publicações concorrentes preservam ordem de cursor após commits', async () => {
  const second = (
    await query(
      "INSERT INTO sources(name,kind,category,enabled) VALUES('Integration cursor ordering','rss','tecnologia',false) RETURNING *",
    )
  ).rows[0];
  const lock = await pool.connect(),
    listener = await pool.connect();
  const events: string[] = [];
  listener.on('notification', (n) => events.push(JSON.parse(n.payload!).id));
  await listener.query('LISTEN newsradar_news');
  try {
    await lock.query('BEGIN');
    await lock.query('SELECT id FROM sources WHERE id=$1 FOR UPDATE', [source.id]);
    const a = ingest(source, {
      externalId: 'cursor-a',
      url: 'https://example.org/cursor-a',
      title: 'Cursor ordering first',
      publishedAt: new Date().toISOString(),
    });
    for (let i = 0; i < 100; i++) {
      const blocked = (
        await query(
          "SELECT 1 FROM pg_stat_activity WHERE query LIKE 'UPDATE sources SET item_count%' AND wait_event_type='Lock'",
        )
      ).rowCount;
      if (blocked) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    const b = ingest(second, {
      externalId: 'cursor-b',
      url: 'https://example.org/cursor-b',
      title: 'Cursor ordering second',
      publishedAt: new Date().toISOString(),
    });
    await new Promise((r) => setTimeout(r, 50));
    await lock.query('COMMIT');
    const ids = await Promise.all([a, b]);
    await new Promise((r) => setTimeout(r, 20));
    const seen = events.filter((id) => ids.includes(id)).map(Number);
    assert.deepEqual(
      seen,
      [...seen].sort((a, b) => a - b),
    );
    assert.equal(seen.length, 2);
  } finally {
    await lock.query('ROLLBACK');
    lock.release();
    await listener.query('UNLISTEN *');
    listener.release();
    await query('DELETE FROM stories WHERE source_id=$1', [second.id]);
    await query('DELETE FROM sources WHERE id=$1', [second.id]);
  }
});
