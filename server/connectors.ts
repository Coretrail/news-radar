import Parser from 'rss-parser';
import { safeFetch } from './safe-fetch.js';
import { ingest } from './ingest.js';
import { query } from './db.js';
const parser = new Parser({ customFields: { item: [['dc:creator', 'creator']] } });
export async function collectSource(source: any) {
  const headers: Record<string, string> = {};
  if (source.etag) headers['If-None-Match'] = source.etag;
  if (source.last_modified) headers['If-Modified-Since'] = source.last_modified;
  let inserted = 0;
  const result = await safeFetch(source.url, headers);
  if (result.status === 304)
    return { inserted: 0, etag: source.etag, modified: source.last_modified };
  if (result.status < 200 || result.status >= 300) throw Error('HTTP ' + result.status);
  if (source.kind === 'hn') {
    const ids = JSON.parse(result.body);
    if (!Array.isArray(ids)) throw Error('Resposta HN inválida');
    const recent = ids.slice(0, 80);
    const existing = new Set(
      (
        await query('SELECT external_id FROM stories WHERE source_id=$1 AND external_id=ANY($2)', [
          source.id,
          recent.map(String),
        ])
      ).rows.map((r) => r.external_id),
    );
    const pending = recent.filter((id: any) => !existing.has(String(id)));
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (cursor < pending.length) {
          const id = pending[cursor++];
          const r = await safeFetch(
            `https://hacker-news.firebaseio.com/v0/item/${Number(id)}.json`,
          );
          if (r.status !== 200) throw Error('HN item HTTP ' + r.status);
          const s = JSON.parse(r.body);
          if (!s || s.deleted || s.dead || s.type !== 'story') continue;
          if (
            await ingest(source, {
              externalId: String(s.id),
              url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
              title: s.title,
              summary: s.text || 'Discussão e artigo partilhado na comunidade Hacker News.',
              author: s.by,
              publishedAt: new Date(s.time * 1000).toISOString(),
            })
          )
            inserted++;
        }
      }),
    );
  } else if (source.config?.format === 'ipma') {
    const warnings = JSON.parse(result.body);
    if (!Array.isArray(warnings)) throw Error('Resposta IPMA inválida');
    const area: Record<string, string> = {
      CBR: 'Castelo Branco',
      BGC: 'Bragança',
      CTB: 'Castelo Branco',
      LIS: 'Lisboa',
      POR: 'Porto',
      COI: 'Coimbra',
      FAR: 'Faro',
      SET: 'Setúbal',
      AVE: 'Aveiro',
      LEI: 'Leiria',
      SAN: 'Santarém',
      VCT: 'Viana do Castelo',
      VRL: 'Vila Real',
      VIS: 'Viseu',
      GUA: 'Guarda',
      EVR: 'Évora',
      BEJ: 'Beja',
      PTG: 'Portalegre',
      BRA: 'Braga',
    };
    for (const w of warnings) {
      if (w.awarenessLevelID === 'green' || new Date(w.endTime + 'Z').getTime() < Date.now())
        continue;
      const level: Record<string, string> = {
        red: 'vermelho',
        orange: 'laranja',
        yellow: 'amarelo',
      };
      const id = [
        w.idAreaAviso,
        w.awarenessTypeName,
        w.startTime,
        w.endTime,
        w.awarenessLevelID,
      ].join('|');
      if (
        await ingest(source, {
          externalId: id,
          url: `https://www.ipma.pt/pt/otempo/prev-sam/?p=${encodeURIComponent(w.idAreaAviso)}&radar_aviso=${encodeURIComponent(id)}`,
          title: `IPMA: aviso ${level[w.awarenessLevelID] || w.awarenessLevelID} — ${w.awarenessTypeName} em ${area[w.idAreaAviso] || w.idAreaAviso}`,
          summary: `${w.text || 'Aviso meteorológico oficial.'} Válido de ${w.startTime} UTC até ${w.endTime} UTC.`,
          author: 'IPMA',
          publishedAt: w.startTime + 'Z',
          priority: w.awarenessLevelID === 'red' ? 'urgent' : 'priority',
        })
      )
        inserted++;
    }
  } else {
    if (/<!DOCTYPE|<!ENTITY/i.test(result.body)) throw Error('DTD/entidades XML bloqueadas');
    const feed = await parser.parseString(result.body);
    if (!Array.isArray(feed.items) || !feed.items.length)
      throw Error('Feed sem publicações RSS/Atom válidas');
    for (const s of feed.items.slice(0, 100)) {
      if (!s.link || !s.title) continue;
      const date = s.isoDate || s.pubDate;
      if (date && new Date(date).getTime() < Date.now() - 30 * 86400000) continue;
      try {
        if (
          await ingest(source, {
            externalId: s.guid || s.link,
            url: s.link,
            title: s.title,
            summary: s.contentSnippet || s.summary || s.content || '',
            author: s.creator,
            publishedAt: date,
          })
        )
          inserted++;
      } catch (e) {
        if (e instanceof TypeError) continue;
        throw e;
      }
    }
  }
  return {
    inserted,
    etag: result.headers.etag || null,
    modified: result.headers['last-modified'] || null,
  };
}
