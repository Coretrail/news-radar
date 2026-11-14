import { createHash } from 'node:crypto';
import { franc } from 'franc-min';
export const TRANSLATION_VERSION = 'opus-ct2-ptPT-v2';
export const isoLanguages: Record<string, string> = {
  eng: 'en',
  por: 'pt',
  fra: 'fr',
  spa: 'es',
  deu: 'de',
  ita: 'it',
  rus: 'ru',
  ukr: 'uk',
  zho: 'zh',
  jpn: 'ja',
  kor: 'ko',
  ara: 'ar',
  nld: 'nl',
  pol: 'pl',
  tur: 'tr',
  swe: 'sv',
  dan: 'da',
  fin: 'fi',
  ces: 'cs',
  ron: 'ro',
  ell: 'el',
  heb: 'he',
  hin: 'hi',
  ind: 'id',
  vie: 'vi',
};
const ptWords =
  /\b(?:notícias|português|discussão|partilhado|comunidade|bombeiros|município|governo|medidas|Portugal|ficheiro|utilizador|incêndio|pel[ao]s?|n[ao]s?|d[ao]s?|uma|para|que|com|mais|são)\b/giu;
export function detectLanguage(text: string, hint = 'auto') {
  const t = text.trim();
  if (!t) return hint === 'auto' ? 'und' : hint;
  if (t.length < 20 && /(?:incêndio|notícias|vítimas|bombeiros|município|português)/iu.test(t))
    return 'pt';
  const detected =
    isoLanguages[franc(t, { minLength: 20, only: Object.keys(isoLanguages) })] || 'und';
  if (hint === 'pt') return 'pt';
  if (hint === 'en') {
    const markers = t.match(ptWords) || [];
    return detected === 'pt' && markers.length >= 2 ? 'pt' : 'en';
  }
  return detected;
}
export function storyLanguages(title: string, summary: string, hint = 'auto') {
  const titleLanguage = detectLanguage(title, hint),
    summaryLanguage = detectLanguage(summary, hint);
  const context = hint === 'auto' ? detectLanguage(title + ' ' + summary, 'auto') : hint;
  return {
    title: titleLanguage === 'und' && context === 'pt' ? 'pt' : titleLanguage,
    summary: summaryLanguage === 'und' && context === 'pt' ? 'pt' : summaryLanguage,
  };
}
export function sourceLanguage(source: { name?: string; kind?: string; config?: any }) {
  if (source.config?.language) return source.config.language;
  if (
    [
      'RTP',
      'Observador',
      'ECO',
      'Pplware',
      'SAPO TEK',
      'Jornal de Negócios',
      'Rádio Covilhã',
      'Beira Baixa TV',
      'IPMA — avisos',
      'Público',
    ].includes(source.name || '')
  )
    return 'pt';
  if (
    source.kind === 'hn' ||
    [
      'BBC',
      'The Guardian',
      'Ars Technica',
      'TechCrunch',
      'The Hacker News',
      'BleepingComputer',
      'NASA',
      'ESA',
      'CISA',
    ].includes(source.name || '')
  )
    return 'en';
  return 'auto';
}
export function splitText(text: string, max = 320) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' '),
    chunks: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > max) {
      chunks.push(current);
      current = word;
    } else current = current ? current + ' ' + word : word;
  }
  if (current) chunks.push(current);
  return chunks;
}
function sameCase(original: string, replacement: string) {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  return /^[A-ZÀ-Ý]/u.test(original)
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;
}
export function adaptEuropeanPortuguese(text: string, source = '') {
  let result = text;
  const swaps: Record<string, string> = {
    usuários: 'utilizadores',
    usuário: 'utilizador',
    aplicativos: 'aplicações',
    aplicativo: 'aplicação',
    equipe: 'equipa',
    equipes: 'equipas',
    ônibus: 'autocarro',
    caminhão: 'camião',
    caminhões: 'camiões',
    planejamento: 'planeamento',
    econômico: 'económico',
    econômica: 'económica',
    econômicos: 'económicos',
    econômicas: 'económicas',
    bilhão: 'mil milhões',
    bilhões: 'mil milhões',
    trilhão: 'bilião',
    trilhões: 'biliões',
  };
  for (const [from, to] of Object.entries(swaps))
    result = result.replace(new RegExp('(?<![\\p{L}])' + from + '(?![\\p{L}])', 'giu'), (m) =>
      sameCase(m, to),
    );
  result = result.replace(/\b(?:um|1) mil milhões\b/giu, (m) => sameCase(m, 'mil milhões'));
  result = result
    .replace(/telefones celulares/giu, (m) => sameCase(m, 'telemóveis'))
    .replace(/telefone celular/giu, (m) => sameCase(m, 'telemóvel'));
  if (/\b(?:mobile|phones?|cellphones?|smartphones?)\b/i.test(source))
    result = result
      .replace(/\bcelulares\b/giu, (m) => sameCase(m, 'telemóveis'))
      .replace(/\bcelular\b/giu, (m) => sameCase(m, 'telemóvel'));
  if (/\b(?:files?|filesystem|documents?|saved)\b/i.test(source))
    result = result
      .replace(/\barquivos\b/giu, (m) => sameCase(m, 'ficheiros'))
      .replace(/\barquivo\b/giu, (m) => sameCase(m, 'ficheiro'));
  if (/\b(?:trains?|railway|railroad)\b/i.test(source))
    result = result
      .replace(/\btrens\b/giu, (m) => sameCase(m, 'comboios'))
      .replace(/\btrem\b/giu, (m) => sameCase(m, 'comboio'));
  if (/\b(?:screens?|displays?|monitors?)\b/i.test(source))
    result = result
      .replace(/\btelas\b/giu, (m) => sameCase(m, 'ecrãs'))
      .replace(/\btela\b/giu, (m) => sameCase(m, 'ecrã'));
  if (/\bfacts?\b/i.test(source))
    result = result
      .replace(/\bfatos\b/giu, (m) => sameCase(m, 'factos'))
      .replace(/\bfato\b/giu, (m) => sameCase(m, 'facto'));
  result = result.replace(
    /\b(salvou|salvar|salvando)(?= (?:o|os|um|uma|as) (?:ficheiros?|documentos?|alterações|configurações))/giu,
    (m) =>
      sameCase(
        m,
        ({ salvou: 'guardou', salvar: 'guardar', salvando: 'a guardar' } as Record<string, string>)[
          m.toLowerCase()
        ],
      ),
  );
  result = result.replace(
    /\b(está|estão|estava|estavam) ([\p{L}]+?)(ando|endo|indo)\b/giu,
    (_, aux, stem, end) =>
      `${aux} a ${stem}${{ ando: 'ar', endo: 'er', indo: 'ir' }[end.toLowerCase() as 'ando' | 'endo' | 'indo']}`,
  );
  result = result
    .replace(/\bem seus\b/giu, (m) => sameCase(m, 'nos seus'))
    .replace(/\bem seu\b/giu, (m) => sameCase(m, 'no seu'))
    .replace(/\bem suas\b/giu, (m) => sameCase(m, 'nas suas'))
    .replace(/\bem sua\b/giu, (m) => sameCase(m, 'na sua'));
  result = result
    .replace(/\bem um\b/giu, (m) => sameCase(m, 'num'))
    .replace(/\bem uma\b/giu, (m) => sameCase(m, 'numa'))
    .replace(/\bem uns\b/giu, (m) => sameCase(m, 'nuns'))
    .replace(/\bem umas\b/giu, (m) => sameCase(m, 'numas'));
  result = result.replace(/\bnesta semana\b/giu, (m) => sameCase(m, 'esta semana'));
  result = result.replace(/\bse reunirá(?![\p{L}])/giu, (m, offset, whole) =>
    /\b(?:não|nunca|que|quando|se)\s+$/iu.test(whole.slice(Math.max(0, offset - 50), offset))
      ? m
      : sameCase(m, 'irá reunir-se'),
  );
  if (/\b(?:aircraft|planes?|airports?|landed|landing)\b/i.test(source)) {
    const landing: Record<string, string> = {
      pousou: 'aterrou',
      pousaram: 'aterraram',
      pousar: 'aterrar',
      pousando: 'aterrando',
      pouso: 'aterragem',
      pousos: 'aterragens',
    };
    result = result.replace(/\b(?:pousou|pousaram|pousar|pousando|pousos|pouso)\b/giu, (m) =>
      sameCase(m, landing[m.toLowerCase()]),
    );
  }
  result = result.replace(
    /\b(precisa|precisam|precisava|precisavam) ([\p{L}]+(?:ar|er|ir))\b/giu,
    '$1 de $2',
  );
  return result.trim();
}
export const translationKey = (text: string, language: string, version = TRANSLATION_VERSION) =>
  createHash('sha256')
    .update(JSON.stringify([text, language, 'pt-PT', version]))
    .digest('hex');
export function presentStory<T extends Record<string, any>>(row: T) {
  const translated =
    row.translation_status === 'translated' &&
    typeof row.title_pt === 'string' &&
    typeof row.summary_pt === 'string';
  return {
    ...row,
    original_title: row.title,
    original_summary: row.summary,
    title: translated ? row.title_pt : row.title,
    summary: translated ? row.summary_pt : row.summary,
    translation_locale: 'pt-PT',
    translation_status: row.translation_status || 'pending',
  };
}
