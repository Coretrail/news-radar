import { query, pool } from './db.js';
import { classify, normalizeUrl, plainText, fingerprint, publicationDate } from './domain.js';
export type Item = {
  externalId: string;
  url: string;
  title: string;
  summary?: string;
  author?: string;
  publishedAt?: string;
  category?: string;
  priority?: string;
  official?: boolean;
};
let cache: { at: number; rules: any[]; categories: any[] } = { at: 0, rules: [], categories: [] };
export async function ingest(source: any, item: Item): Promise<string | null> {
  const title = plainText(item.title).slice(0, 500);
  if (!title) return null;
  const canonical = normalizeUrl(item.url);
  if (Date.now() - cache.at > 15000) {
    cache = {
      at: Date.now(),
      rules: (await query('SELECT * FROM rules WHERE enabled')).rows,
      categories: (await query('SELECT * FROM categories')).rows,
    };
  }
  const categoryRules = cache.categories.flatMap((c) =>
    c.keywords.map((term: string) => ({ term, category: c.id, priority: c.priority })),
  );
  const meta = classify(
    title + ' ' + plainText(item.summary),
    item.category || source.category,
    [...categoryRules, ...cache.rules],
    item.official ?? source.official,
  );
  if (meta.excluded) return null;
  const cat = cache.categories.find((c) => c.id === meta.category);
  if (!cat?.enabled) return null;
  const rank: Record<string, number> = { info: 0, priority: 1, urgent: 2 };
  const priority = [meta.priority, item.priority || 'info', source.priority || 'info'].sort(
    (a, b) => rank[b] - rank[a],
  )[0];
  const fp = fingerprint(title);
  const cluster = fingerprint(canonical);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    // Keep ingestion IDs in commit order so SSE recovery cannot skip a slower source.
    await c.query('SELECT pg_advisory_xact_lock(1082026)');
    const r = await c.query(
      `INSERT INTO stories(source_id,external_id,url,canonical_url,title,summary,author,category,priority,status,published_at,fingerprint,cluster_key,tags)
 SELECT $1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce((SELECT cluster_key FROM stories WHERE canonical_url=$3 OR fingerprint=$11 ORDER BY detected_at DESC LIMIT 1),$12),$13
 WHERE NOT EXISTS(SELECT 1 FROM stories WHERE source_id=$1 AND canonical_url=$3) ON CONFLICT(source_id,external_id) DO NOTHING RETURNING id`,
      [
        source.id,
        item.externalId.slice(0, 1000),
        canonical,
        title,
        plainText(item.summary).slice(0, 700),
        item.author?.slice(0, 200) || null,
        meta.category,
        priority,
        meta.status,
        publicationDate(item.publishedAt),
        fp,
        cluster,
        meta.tags,
      ],
    );
    const id = r.rows[0]?.id;
    if (id) {
      if (priority !== 'info')
        await c.query('INSERT INTO alerts(story_id,level) VALUES($1,$2)', [id, priority]);
      await c.query('UPDATE sources SET item_count=item_count+1 WHERE id=$1', [source.id]);
      await c.query("SELECT pg_notify('newsradar_news',$1)", [
        JSON.stringify({ id, priority, detectedAt: Date.now() }),
      ]);
    }
    await c.query('COMMIT');
    return id || null;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
