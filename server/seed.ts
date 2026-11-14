import { config } from './config.js';
import { readFile } from 'node:fs/promises';
import { query, pool } from './db.js';
const categories = [
  ['portugal', 'Portugal'],
  [config.localCategoryId, config.localRegionName],
  ['mundo', 'Mundo'],
  ['tecnologia', 'Tecnologia'],
  ['ia', 'Inteligência Artificial'],
  ['ciberseguranca', 'Cibersegurança'],
  ['ciencia', 'Ciência e espaço'],
  ['economia', 'Economia e negócios'],
];
for (const [position, [id, name]] of categories.entries())
  await query('INSERT INTO categories(id,name,position) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [
    id,
    name,
    position,
  ]);
const probes = JSON.parse(
  await readFile(new URL('./initial-sources.json', import.meta.url), 'utf8'),
);
for (const s of config.seedSources === 'none'
  ? []
  : config.seedSources === 'minimal'
    ? probes.filter((source: any) => source.name === 'BBC')
    : probes) {
  s.category = s.category === 'local' ? config.localCategoryId : s.category;
  const restricted = s.name === 'Público';
  await query(
    `INSERT INTO sources(name,kind,url,category,enabled,official,interval_seconds,status,error) VALUES($1,'rss',$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(name) DO NOTHING`,
    [
      s.name,
      s.url,
      s.category,
      s.name === 'BBC' && !restricted,
      ['NASA', 'ESA', 'CISA', 'CNCS'].includes(s.name),
      s.category === config.localCategoryId ? 180 : 120,
      s.name === 'BBC' && !restricted ? 'pending' : 'unavailable',
      restricted
        ? 'Review publisher terms before enabling this optional feed'
        : s.name === 'BBC'
          ? null
          : 'Optional feed: review availability and publisher terms before enabling',
    ],
  );
}
if (config.seedSources !== 'none')
  await query(
    `INSERT INTO sources(name,kind,url,category,interval_seconds) VALUES('Hacker News','hn','https://hacker-news.firebaseio.com/v0/newstories.json','tecnologia',30) ON CONFLICT DO NOTHING`,
  );
if (config.seedSources === 'all')
  await query(
    `INSERT INTO sources(name,kind,url,category,interval_seconds,enabled) VALUES('Bluesky Jetstream','bluesky','https://jetstream2.us-east.bsky.network/subscribe','mundo',30,false) ON CONFLICT DO NOTHING`,
  );
if (config.seedSources === 'all')
  await query(
    `INSERT INTO sources(name,kind,url,category,official,interval_seconds,enabled,config) VALUES('IPMA — avisos','rss','https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json','portugal',true,120,false,'{"format":"ipma"}') ON CONFLICT DO NOTHING`,
  );
if (config.seedSources === 'all') {
  for (const [name, kind] of [
    ['Reddit', 'reddit'],
    ['Facebook', 'facebook'],
    ['X', 'x'],
  ]) {
    await query(
      "INSERT INTO sources(name,kind,category,enabled,status,error) VALUES($1,$2,'mundo',false,'unavailable','Connector not implemented; requires official API integration and permissions') ON CONFLICT DO NOTHING",
      [name, kind],
    );
  }
}
if (!(await query('SELECT 1 FROM rules LIMIT 1')).rowCount) {
  for (const term of [
    'última hora',
    'breaking news',
    'alerta vermelho',
    'sismo forte',
    'major earthquake',
    'ataque em curso',
    'critical vulnerability',
    'exploração ativa',
  ])
    await query("INSERT INTO rules(term,group_name,priority) VALUES($1,'Urgência','urgent')", [
      term,
    ]);
  for (const [term, cat] of [
    ['OpenAI', 'ia'],
    ['ChatGPT', 'ia'],
    ['inteligência artificial', 'ia'],
    ['ransomware', 'ciberseguranca'],
    ['CVE-', 'ciberseguranca'],
    ['NASA', 'ciencia'],
    ['Artemis', 'ciencia'],
    ['inflação', 'economia'],
    ['Banco Central', 'economia'],
  ])
    await query(
      "INSERT INTO rules(term,category,group_name,priority) VALUES($1,$2,'Temas','priority')",
      [term, cat],
    );
}
await query(
  `INSERT INTO settings VALUES('alerts','{"quiet_start":22,"quiet_end":8,"retention_days":30}') ON CONFLICT DO NOTHING`,
);
// Apply the environment's initial translation preference once; preserve later admin choices.
const initialized = await query(
  "INSERT INTO settings(key,value) VALUES('installation_defaults','{}') ON CONFLICT DO NOTHING RETURNING key",
);
if (initialized.rowCount) {
  await query(
    "UPDATE settings SET value=jsonb_set(value,'{enabled}',$1::jsonb) WHERE key='translation'",
    [JSON.stringify(config.translationEnabled)],
  );
}
console.log('Configuration seeded (existing source/category settings preserved)');
await pool.end();
