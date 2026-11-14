/** Reproducible screenshots of the real UI using explicitly illustrative demo data.
 * No database, production URL, credentials or external news are accessed. */
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
const now = new Date().toISOString();
const categories = [
  ['portugal', 'Portugal'],
  ['local', 'Notícias locais'],
  ['mundo', 'Mundo'],
  ['tecnologia', 'Tecnologia'],
  ['ia', 'Inteligência Artificial'],
  ['ciberseguranca', 'Cibersegurança'],
  ['ciencia', 'Ciência e espaço'],
  ['economia', 'Economia e negócios'],
].map(([id, name], position) => ({ id, name, position }));
const titles = [
  [
    'ciencia',
    'Novo observatório abre as portas à comunidade',
    'Uma iniciativa de ciência aberta aproxima investigadores e visitantes.',
  ],
  [
    'tecnologia',
    'Comunidade apresenta ferramentas para uma web mais acessível',
    'Projeto colaborativo disponibiliza recursos abertos para programadores.',
  ],
  [
    'local',
    'Biblioteca municipal promove encontro de tecnologia e cultura',
    'Atividades gratuitas convidam a comunidade a partilhar ideias e experiências.',
  ],
  [
    'ia',
    'Investigadores partilham método de avaliação de modelos de linguagem',
    'A proposta inclui exemplos reproduzíveis e documentação pública.',
  ],
  [
    'ciberseguranca',
    'Atualização de segurança disponível para aplicação de demonstração',
    'Exemplo ilustrativo de um alerta: consultar sempre a publicação original.',
  ],
  [
    'mundo',
    'Rede de cidades organiza encontro sobre mobilidade sustentável',
    'Representantes discutem iniciativas locais e colaboração entre comunidades.',
  ],
  [
    'economia',
    'Cooperativa apresenta plataforma aberta para pequenos negócios',
    'Ferramentas partilhadas apoiam a gestão e a colaboração entre equipas.',
  ],
  [
    'local',
    'Jardim comunitário recebe novo espaço para oficinas',
    'A iniciativa junta vizinhos num programa de atividades ao ar livre.',
  ],
].map(([category, title, summary], index) => ({
  id: String(100 - index),
  title,
  summary,
  category,
  category_name: categories.find((c) => c.id === category)!.name,
  url: `https://example.org/demo/${index}`,
  source_name: ['Demo Ciência', 'Demo Tecnologia', 'Demo Região'][index % 3],
  source_kind: 'rss',
  priority: index === 4 ? 'urgent' : index === 2 ? 'priority' : 'info',
  status: index === 0 ? 'official' : 'unconfirmed',
  published_at: new Date(Date.now() - index * 90000).toISOString(),
  detected_at: new Date(Date.now() - index * 80000).toISOString(),
  translation_status: 'original',
  favorite: false,
  cluster_count: '1',
  tags: [],
}));
const sources = [1, 2, 3].map((id) => ({
  id,
  name: ['Demo Ciência', 'Demo Tecnologia', 'Demo Região'][id - 1],
  kind: 'rss',
  category: 'tecnologia',
  enabled: true,
  status: 'ok',
  last_success: now,
  item_count: 12,
}));
const streams = new Set<http.ServerResponse>();
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://localhost');
  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write('event: connected\ndata: {}\n\n');
    streams.add(res);
    req.on('close', () => streams.delete(res));
    return;
  }
  let result: unknown;
  if (url.pathname === '/api/config')
    result = {
      timeZone: 'Europe/Lisbon',
      localCategoryId: 'local',
      localRegionName: 'Notícias locais',
    };
  else if (url.pathname === '/api/categories') result = categories;
  else if (url.pathname === '/api/sources') result = sources;
  else if (url.pathname === '/api/overview')
    result = {
      stats: { today: '24', total: '128', last_update: now },
      alerts: titles.filter((s) => s.priority === 'urgent'),
      local: titles.filter((s) => s.category === 'local'),
      trends: [
        {
          topic: 'Ciência aberta',
          category: 'ciencia',
          count: 8,
          sources: 3,
          recent: 4,
          previous: 2,
        },
        { topic: 'Comunidade', category: 'local', count: 6, sources: 2, recent: 3, previous: 2 },
        {
          topic: 'Tecnologia',
          category: 'tecnologia',
          count: 5,
          sources: 2,
          recent: 2,
          previous: 1,
        },
      ],
      sources: { active: 3, operational: 3, failed: 0 },
      collector: [
        {
          key: 'heartbeat',
          value: { status: 'running', jetstream_connected: false },
          updated_at: now,
        },
      ],
      quiet: false,
    };
  else if (url.pathname === '/api/stories')
    result = {
      items: titles.filter(
        (s) => !url.searchParams.get('category') || s.category === url.searchParams.get('category'),
      ),
      total: titles.length,
      cursor: '100',
    };
  else if (url.pathname.startsWith('/api/')) result = [];
  if (result !== undefined) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }
  try {
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (relative.includes('..')) throw Error('invalid path');
    const file = path.resolve('dist', relative);
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
const address = server.address() as { port: number };
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1050 },
    deviceScaleFactor: 1,
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' });
  await page.getByTestId('story-card').first().waitFor();
  await page.getByText('Ligação em direto', { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/dashboard-mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error('Mobile overflow');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'Public screenshots generated from synthetic demo fixtures; no private data accessed.',
  );
} finally {
  await browser.close();
  for (const stream of streams) stream.end();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
