import { config } from './config.js';
import { createHash } from 'node:crypto';
export type Priority = 'urgent' | 'priority' | 'info';
export type Rule = {
  term: string;
  priority?: Priority;
  category?: string;
  enabled?: boolean;
  exclude?: boolean;
  group_name?: string;
};
export const fold = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
export function plainText(value: string = '') {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}
export function normalizeUrl(raw: string) {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
    throw Error('URL inválido');
  u.hash = '';
  for (const k of [...u.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$|mc_)/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.toString();
}
export const fingerprint = (v: string) =>
  createHash('sha256')
    .update(
      fold(v)
        .replace(/[^a-z0-9]+/g, ' ')
        .trim(),
    )
    .digest('hex');
export function classify(text: string, fallback: string, rules: Rule[], official = false) {
  const t = fold(text);
  let category = fallback,
    priority: Priority = 'info';
  let excluded = false;
  const tags: string[] = [];
  for (const r of rules) {
    if (r.enabled === false || !r.term || !t.includes(fold(r.term))) continue;
    if (r.exclude) {
      excluded = true;
      continue;
    }
    tags.push(r.term);
    if (r.category) category = r.category;
    if (r.priority === 'urgent' || (r.priority === 'priority' && priority === 'info'))
      priority = r.priority;
  }
  if (config.localRegionKeywords.some((keyword) => t.includes(fold(keyword)))) {
    category = config.localCategoryId;
    if (priority === 'info') priority = 'priority';
    tags.push(config.localRegionName);
  }
  if (
    category !== config.localCategoryId &&
    /inteligencia artificial|artificial intelligence|\bopenai\b|\bllm\b|\bchatgpt\b/.test(t)
  ) {
    category = 'ia';
    tags.push('Inteligência Artificial');
  }
  let status = official ? 'official' : 'unconfirmed';
  if (/\brumou?r\b|alegad[oa]|unverified|unconfirmed/.test(t)) status = 'rumor';
  return { category, priority, status, excluded, tags: [...new Set(tags)].slice(0, 12) };
}
export function isQuiet(date = new Date(), start = 22, end = 8, timeZone = config.timeZone) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}
export function publicationDate(raw?: string | number) {
  const d = raw ? new Date(raw) : new Date();
  return Number.isFinite(d.getTime()) && d.getTime() < Date.now() + 300000 ? d : new Date();
}
