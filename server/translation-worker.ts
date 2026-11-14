import { config } from './config.js';
import { pool, query } from './db.js';
import { LocalTranslationEngine } from './translation/engine.js';
import {
  claimTranslation,
  completeTranslation,
  failTranslation,
  readTranslationCache,
  writeTranslationCache,
  translationStats,
} from './translation/queue.js';
import {
  storyLanguages,
  sourceLanguage,
  splitText,
  adaptEuropeanPortuguese,
  TRANSLATION_VERSION,
} from './translation/domain.js';
import { setTimeout as delay } from 'node:timers/promises';
if (!config.translationEnabled) {
  console.log('Translation disabled. Set TRANSLATION_ENABLED=true after provisioning models.');
  await pool.end();
  process.exit(0);
}
const lock = await pool.connect();
if (!(await lock.query('SELECT pg_try_advisory_lock(1082027) acquired')).rows[0].acquired) {
  console.log('Translation worker already active');
  lock.release();
  await pool.end();
  process.exit(0);
}
let stopping = false;
const engine = new LocalTranslationEngine();
lock.on('error', () => {
  stopping = true;
  engine.close();
});
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    stopping = true;
    engine.close();
  });
await query(
  "UPDATE story_translations SET status='pending',lease_token=NULL,lease_until=NULL WHERE status='processing'",
);
await query(
  "UPDATE story_translations SET status='pending',attempts=0,retry_at=now() WHERE status='translated' AND model_version!=$1",
  [TRANSLATION_VERSION],
);
let processed = 0,
  lastStats = 0,
  lastCleanup = 0,
  settings: any = { enabled: true };
async function heartbeat(status: string, error?: string) {
  const stats = await translationStats();
  await query(
    `INSERT INTO collector_state(key,value) VALUES('translation',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()`,
    [
      JSON.stringify({
        status,
        target: 'pt-PT',
        local_only: true,
        model_version: TRANSLATION_VERSION,
        processed,
        ...stats,
        error: error?.slice(0, 300),
      }),
    ],
  );
  lastStats = Date.now();
}
async function field(text: string, language: string) {
  if (!text.trim()) return { text, language, native: true };
  if (language === 'pt') return { text, language, native: true };
  const cached = await readTranslationCache(text, language);
  if (cached !== null) return { text: cached, language, native: false };
  const chunks = splitText(text);
  const translated = await engine.translate(chunks, language);
  if (translated.length !== chunks.length) throw Error('Resposta incompleta do motor local');
  const output = adaptEuropeanPortuguese(translated.join(' '), text);
  if (!output || output.length > Math.max(text.length * 4, 600))
    throw Error('Tradução automática fora dos limites de validação');
  await writeTranslationCache(text, language, output);
  return { text: output, language, native: false };
}
console.log('Local translation worker started');
while (!stopping) {
  try {
    if (Date.now() - lastStats > 5000) {
      settings = (await query("SELECT value FROM settings WHERE key='translation'")).rows[0]
        ?.value || { enabled: true };
      await heartbeat(settings.enabled ? 'running' : 'paused');
    }
    if (!settings.enabled) {
      engine.close();
      await delay(1500);
      continue;
    }
    const job = await claimTranslation();
    if (!job) {
      await delay(1000);
      continue;
    }
    try {
      const start = Date.now();
      let hint = sourceLanguage({
        name: job.source_name,
        kind: job.source_kind,
        config: job.source_config,
      });
      if (
        job.source_kind === 'bluesky' &&
        [
          'cnn.com',
          'theguardian.com',
          'arstechnica.com',
          'techcrunch.com',
          'bbcnews.bsky.social',
          'bleepingcomputer.com',
        ].includes((job as any).author)
      )
        hint = 'en';
      const languages = storyLanguages(job.title, job.summary, hint);
      const title = await field(job.title, languages.title);
      const summary = await field(job.summary, languages.summary);
      await completeTranslation(job, {
        title: title.text,
        summary: summary.text,
        language: !title.native ? title.language : summary.language,
        native: title.native && summary.native,
      });
      processed++;
      if (processed % 20 === 0)
        console.log(JSON.stringify({ processed, last_ms: Date.now() - start }));
    } catch (e: any) {
      if (stopping) {
        await query(
          "UPDATE story_translations SET status='pending',lease_token=NULL,lease_until=NULL,retry_at=now() WHERE story_id=$1 AND lease_token=$2",
          [job.id, job.lease_token],
        );
      } else {
        await failTranslation(job, e);
        console.error(JSON.stringify({ story_id: job.id, error: e.message }));
      }
    }
    if (Date.now() - lastCleanup > 3600000) {
      await query("DELETE FROM translation_cache WHERE last_used<now()-interval '30 days'");
      await query(
        'DELETE FROM translation_cache WHERE cache_key IN(SELECT cache_key FROM translation_cache ORDER BY last_used DESC OFFSET 300000)',
      );
      lastCleanup = Date.now();
    }
  } catch (e: any) {
    console.error('translation loop', e.message);
    await delay(2000);
  }
}
engine.close();
try {
  await heartbeat('stopped');
  await lock.query('SELECT pg_advisory_unlock(1082027)');
} finally {
  lock.release();
  await pool.end();
}
