import { query, pool } from '../db.js';
import { randomUUID } from 'node:crypto';
import { translationKey, TRANSLATION_VERSION } from './domain.js';
export type TranslationJob = {
  id: string;
  title: string;
  summary: string;
  source_name: string;
  source_kind: string;
  source_config: any;
  attempts: number;
  lease_token: string;
};
export async function claimTranslation(): Promise<TranslationJob | null> {
  const token = randomUUID();
  const r = await query(
    `WITH candidate AS(SELECT t.story_id FROM story_translations t JOIN stories s ON s.id=t.story_id WHERE (t.status='pending' OR (t.status='failed' AND t.retry_at<=now() AND t.attempts<5) OR(t.status='processing' AND t.lease_until<now())) ORDER BY CASE s.priority WHEN 'urgent' THEN 0 WHEN 'priority' THEN 1 ELSE 2 END,s.detected_at DESC FOR UPDATE OF t SKIP LOCKED LIMIT 1), claimed AS(UPDATE story_translations t SET status='processing',lease_token=$1,lease_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() FROM candidate c WHERE t.story_id=c.story_id RETURNING t.*) SELECT s.*,c.attempts,c.lease_token,src.name source_name,src.kind source_kind,src.config source_config FROM claimed c JOIN stories s ON s.id=c.story_id JOIN sources src ON src.id=s.source_id`,
    [token],
  );
  return r.rows[0] || null;
}
export async function completeTranslation(
  job: TranslationJob,
  result: { title: string; summary: string; language: string; native: boolean },
) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query(
      `UPDATE story_translations SET status=$3,title_pt=$4,summary_pt=$5,source_language=$6,model_version=$7,error=NULL,lease_until=NULL,lease_token=NULL,updated_at=clock_timestamp() WHERE story_id=$1 AND lease_token=$2 RETURNING story_id`,
      [
        job.id,
        job.lease_token,
        result.native ? 'original' : 'translated',
        result.native ? null : result.title,
        result.native ? null : result.summary,
        result.language,
        TRANSLATION_VERSION,
      ],
    );
    if (r.rowCount)
      await c.query("SELECT pg_notify('newsradar_translation',$1)", [
        JSON.stringify({ id: job.id, status: result.native ? 'original' : 'translated' }),
      ]);
    await c.query('COMMIT');
    return !!r.rowCount;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
export async function failTranslation(job: TranslationJob, error: Error) {
  await query(
    `WITH failed AS(UPDATE story_translations SET status='failed',error=$3,retry_at=now()+interval '1 second'*$4,lease_until=NULL,lease_token=NULL,updated_at=now() WHERE story_id=$1 AND lease_token=$2 RETURNING story_id) SELECT pg_notify('newsradar_translation',json_build_object('id',story_id::text,'status','failed')::text) FROM failed`,
    [
      job.id,
      job.lease_token,
      error.message.slice(0, 300),
      Math.min(3600, 15 * 2 ** Math.min(job.attempts - 1, 8)),
    ],
  );
}
export async function readTranslationCache(text: string, language: string) {
  const r = await query(
    'UPDATE translation_cache SET last_used=now() WHERE cache_key=$1 RETURNING translated_text',
    [translationKey(text, language)],
  );
  return r.rows[0]?.translated_text ?? null;
}
export async function writeTranslationCache(text: string, language: string, translated: string) {
  await query(
    `INSERT INTO translation_cache(cache_key,source_language,model_version,translated_text) VALUES($1,$2,$3,$4) ON CONFLICT(cache_key) DO UPDATE SET last_used=now()`,
    [translationKey(text, language), language, TRANSLATION_VERSION, translated],
  );
}
export async function translationStats() {
  return (
    await query(
      `SELECT count(*) FILTER(WHERE status='translated')::int translated,count(*) FILTER(WHERE status='original')::int original,count(*) FILTER(WHERE status IN('pending','processing'))::int pending,count(*) FILTER(WHERE status='failed')::int failed FROM story_translations`,
    )
  ).rows[0];
}
