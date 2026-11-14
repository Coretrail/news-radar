import { JetstreamConnection, resolutionFailure } from './jetstream.js';
import { setTimeout as delay } from 'node:timers/promises';
import { query, pool } from './db.js';
import { collectSource } from './connectors.js';
import { safeFetch } from './safe-fetch.js';
import { ingest } from './ingest.js';
let stopping = false;
let lastClean = 0;
const saved = (await query("SELECT value FROM collector_state WHERE key='jetstream_cursor'"))
  .rows[0]?.value;
const jet = new JetstreamConnection(
  {
    onRecord: async (source, account, event) => {
      const record = event.commit.record;
      await ingest(source, {
        externalId: `${event.did}/${event.commit.rkey}`,
        url: `https://bsky.app/profile/${account.handle}/post/${event.commit.rkey}`,
        title: record.text.slice(0, 240),
        summary: record.text,
        author: account.handle,
        publishedAt: record.createdAt,
        category: account.category,
        priority: account.priority,
        official: account.official || source.official,
      });
    },
    onStatus: async (status, error) => {
      await query(
        "UPDATE sources SET status=$1,error=$2,last_check=now(),last_success=CASE WHEN $1='live' THEN now() ELSE last_success END,failures=CASE WHEN $1='live' THEN 0 ELSE failures+1 END WHERE kind='bluesky'",
        [status, error || null],
      );
    },
  },
  saved,
);
async function state(key: string, value: any) {
  await query(
    'INSERT INTO collector_state(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()',
    [key, JSON.stringify(value)],
  );
}
async function poll(source: any) {
  try {
    const result = await collectSource(source);
    await query(
      `UPDATE sources SET status='ok',last_check=now(),last_success=now(),failures=0,error=NULL,etag=$2,last_modified=$3,next_poll=now()+interval '1 second'*interval_seconds,config=config-'test_requested' WHERE id=$1`,
      [source.id, result.etag, result.modified],
    );
    if (result.inserted)
      console.log(JSON.stringify({ source: source.name, inserted: result.inserted }));
  } catch (e: any) {
    const backoff = Math.min(3600, source.interval_seconds * 2 ** Math.min(source.failures + 1, 6));
    await query(
      `UPDATE sources SET status='error',last_check=now(),error=$2,failures=failures+1,next_poll=now()+interval '1 second'*$3,config=config-'test_requested' WHERE id=$1`,
      [source.id, String(e.message).slice(0, 400), backoff],
    );
    console.error(JSON.stringify({ source: source.name, error: e.message, backoff }));
  }
}
async function jetstream() {
  const source = (await query("SELECT * FROM sources WHERE kind='bluesky' ORDER BY id LIMIT 1"))
    .rows[0];
  if (!source?.enabled) {
    jet.reconcile(source, []);
    return;
  }
  const accounts = (
    await query(
      'SELECT a.* FROM accounts a JOIN categories c ON c.id=a.category WHERE a.enabled AND c.enabled',
    )
  ).rows;
  for (const a of accounts.filter(
    (a) => !a.did && new Date(a.resolve_after).getTime() <= Date.now(),
  )) {
    try {
      const r = await safeFetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(a.handle)}`,
      );
      if (r.status !== 200)
        throw Object.assign(Error('Perfil HTTP ' + r.status), { httpStatus: r.status });
      const p = JSON.parse(r.body);
      if (!p.did?.startsWith('did:')) throw Error('Perfil sem DID');
      a.did = p.did;
      await query(
        'UPDATE accounts SET did=$2,error=NULL,resolution_failures=0,resolve_after=now() WHERE id=$1',
        [a.id, a.did],
      );
    } catch (e: any) {
      const policy = resolutionFailure(e.httpStatus || 0, a.resolution_failures);
      await query(
        "UPDATE accounts SET error=$2,enabled=NOT $3,resolution_failures=resolution_failures+1,resolve_after=now()+interval '1 second'*$4 WHERE id=$1",
        [a.id, e.message, policy.disable, policy.retrySeconds],
      );
    }
  }
  const valid = accounts.filter((a) => a.did);
  jet.reconcile(source, valid);
  if (!valid.length)
    await query(
      "UPDATE sources SET status='error',error='Sem contas com DID válido',last_check=now(),config=config-'test_requested' WHERE id=$1",
      [source.id],
    );
  else if (source.config?.test_requested) {
    await query(
      "UPDATE sources SET status=$2,last_check=now(),config=config-'test_requested' WHERE id=$1",
      [source.id, jet.connected ? 'live' : 'pending'],
    );
  }
}
async function cleanup() {
  const retention =
    (await query("SELECT value FROM settings WHERE key='alerts'")).rows[0]?.value?.retention_days ||
    30;
  await query("DELETE FROM stories WHERE detected_at<now()-interval '1 day'*$1", [
    Math.min(retention, 30),
  ]);
  await query(
    'DELETE FROM stories WHERE id IN(SELECT id FROM stories ORDER BY detected_at DESC OFFSET 150000)',
  );
  await query('DELETE FROM sessions WHERE expires_at<now()');
  await query('DELETE FROM bootstrap WHERE expires_at<now()');
  await query("DELETE FROM audit WHERE created_at<now()-interval '30 days'");
  await query(
    "DELETE FROM devices WHERE id NOT IN(SELECT device_id FROM story_state) AND created_at<now()-interval '30 days'",
  );
  await state('retention', {
    days: retention,
    max_stories: 150000,
    last_cleanup: new Date().toISOString(),
  });
}
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    stopping = true;
    jet.close();
  });
console.log('Collector started');
while (!stopping) {
  try {
    await state('heartbeat', {
      status: 'running',
      pid: process.pid,
      jetstream_connected: jet.connected,
    });
    await jetstream();
    const due = (
      await query(
        "SELECT * FROM sources WHERE (enabled OR config->>'test_requested'='true') AND kind IN ('rss','hn') AND url IS NOT NULL AND next_poll<=now() ORDER BY next_poll LIMIT 12",
      )
    ).rows;
    let i = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (i < due.length && !stopping) await poll(due[i++]);
      }),
    );
    if (Date.now() - lastClean > 3600000) {
      await cleanup();
      lastClean = Date.now();
    }
    if (jet.cursor) await state('jetstream_cursor', { cursor: jet.cursor });
  } catch (e: any) {
    console.error('collector loop', e.message);
  }
  await delay(2000);
}
await state('heartbeat', { status: 'stopped' });
await pool.end();
process.exit(0);
