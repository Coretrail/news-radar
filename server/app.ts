import { config } from './config.js';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { statfs } from 'node:fs/promises';
import { query, pool } from './db.js';
import { hashPassword, verifyPassword, newToken, tokenHash } from './auth.js';
import { validateTarget } from './safe-fetch.js';
import { isQuiet } from './domain.js';
import { presentStory } from './translation/domain.js';
import { translationStats } from './translation/queue.js';
const translationColumns =
  'tr.status translation_status,tr.title_pt,tr.summary_pt,tr.source_language,tr.model_version';
const priority = z.enum(['info', 'priority', 'urgent']);
const category = z.string().min(1).max(80);
const num = z.coerce.number().int();
const str = z.string().max(200);
const sourceSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(['rss', 'hn', 'bluesky', 'reddit', 'facebook', 'x']),
  url: z.string().max(2000).nullable().optional(),
  category,
  enabled: z.boolean(),
  official: z.boolean(),
  interval_seconds: num.min(30).max(86400),
  priority,
});
const schemas = {
  sources: sourceSchema,
  categories: z.object({
    name: z.string().min(1).max(120),
    position: num.min(0).max(100),
    enabled: z.boolean(),
    keywords: z.array(z.string().min(1).max(80)).max(100),
    priority,
  }),
  rules: z.object({
    term: z.string().min(1).max(100),
    group_name: z.string().max(80),
    category: category.nullable(),
    priority,
    exclude: z.boolean(),
    enabled: z.boolean(),
  }),
  accounts: z.object({
    handle: z
      .string()
      .regex(/^[a-zA-Z0-9.-]+$/)
      .max(253),
    category,
    enabled: z.boolean(),
    priority,
    terms: z.array(z.string().max(100)).max(50),
    official: z.boolean(),
  }),
};
const credentials = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(12).max(200),
});
function cookies(request: any) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.appUrl.startsWith('https:'),
    path: '/',
  };
}
function checkedId(raw: any) {
  return z
    .string()
    .regex(/^\d{1,18}$/)
    .parse(String(raw));
}
export async function buildApp() {
  const app = Fastify({
    logger:
      process.env.NODE_ENV === 'test'
        ? false
        : {
            level: 'info',
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              'body.password',
              'body.token',
            ],
          },
    trustProxy: config.trustProxy,
    bodyLimit: 65536,
  });
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.setErrorHandler((error: any, _req, reply) => {
    const status = error instanceof z.ZodError ? 400 : error.statusCode || 500;
    if (status >= 500) app.log.error({ message: error.message }, 'request failed');
    reply.status(status).send({
      error:
        status >= 500
          ? 'Erro interno. Consultar diagnóstico.'
          : error instanceof z.ZodError
            ? 'Dados inválidos'
            : error.message,
    });
  });
  app.addHook('onRequest', async (req, reply) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin;
      const host = req.host;
      if (origin) {
        let allowed = false;
        try {
          allowed = new URL(origin).host === host;
        } catch {}
        if (!allowed) return reply.code(403).send({ error: 'Origem não autorizada' });
      }
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return reply.code(403).send({ error: 'Pedido externo bloqueado' });
    }
  });
  const admin = async (req: any, reply: any) => {
    const token = req.cookies.nr_session;
    if (!token) return reply.code(401).send({ error: 'Autenticação necessária' });
    const r = await query(
      'SELECT admin_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',
      [tokenHash(token)],
    );
    if (!r.rowCount) return reply.code(401).send({ error: 'Sessão expirada' });
    req.adminId = r.rows[0].admin_id;
  };
  const device = async (req: any, reply: any) => {
    let id = req.cookies.nr_device;
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
      id = randomUUID();
      reply.setCookie('nr_device', id, { ...cookies(req), maxAge: 31536000 });
    }
    await query('INSERT INTO devices(id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
    return id;
  };
  const audit = async (req: any, action: string, details: any = {}) =>
    query('INSERT INTO audit(admin_id,action,details) VALUES($1,$2,$3)', [
      req.adminId,
      action,
      JSON.stringify(details),
    ]);
  app.get('/api/config', async () => ({
    timeZone: config.timeZone,
    localCategoryId: config.localCategoryId,
    localRegionName: config.localRegionName,
  }));
  app.get('/api/health', async () => {
    await query('SELECT 1');
    return { status: 'ok', time: new Date().toISOString() };
  });
  app.get(
    '/api/categories',
    async () => (await query('SELECT * FROM categories WHERE enabled ORDER BY position')).rows,
  );
  app.get(
    '/api/sources',
    async () =>
      (
        await query(
          'SELECT id,name,kind,category,enabled,official,status,last_check,last_success,error,failures,item_count,interval_seconds FROM sources ORDER BY name',
        )
      ).rows,
  );
  app.get('/api/stories', async (req, reply) => {
    const f = z
      .object({
        q: z.string().max(200).optional(),
        since: z
          .string()
          .regex(/^\d{1,18}$/)
          .optional(),
        category: str.optional(),
        source: num.positive().optional(),
        author: str.optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        priority: priority.optional(),
        status: z.enum(['official', 'confirmed', 'unconfirmed', 'rumor', 'corrected']).optional(),
        view: z.enum(['favorites', 'history', 'all']).default('all'),
        limit: num.min(1).max(100).default(30),
        offset: num.min(0).max(20000).default(0),
      })
      .parse(req.query);
    const cursor = (await query('SELECT coalesce(max(id),0)::text cursor FROM stories')).rows[0]
      .cursor;
    const d = await device(req, reply),
      params: any[] = [d],
      where: string[] = ['c.enabled'];
    const bind = (v: any) => {
      params.push(v);
      return '$' + params.length;
    };
    if (f.q) {
      const p = bind(f.q);
      where.push(
        `(to_tsvector('simple',s.title||' '||s.summary||' '||coalesce(s.author,'')) @@ plainto_tsquery('simple',${p}) OR to_tsvector('simple',coalesce(tr.title_pt,'')||' '||coalesce(tr.summary_pt,'')) @@ plainto_tsquery('simple',${p}) OR s.title ILIKE '%'||${p}||'%' OR src.name ILIKE '%'||${p}||'%' OR c.name ILIKE '%'||${p}||'%' OR coalesce(s.author,'') ILIKE '%'||${p}||'%')`,
      );
    }
    if (f.since) where.push(`s.id>${bind(f.since)}`);
    if (f.category) where.push(`s.category=${bind(f.category)}`);
    if (f.source) where.push(`s.source_id=${bind(f.source)}`);
    if (f.author) where.push(`s.author ILIKE '%'||${bind(f.author)}||'%'`);
    if (f.from) where.push(`s.published_at>=${bind(f.from)}::date`);
    if (f.to) where.push(`s.published_at<${bind(f.to)}::date+interval '1 day'`);
    if (f.priority) where.push(`s.priority=${bind(f.priority)}`);
    if (f.status) where.push(`s.status=${bind(f.status)}`);
    if (f.view === 'favorites') where.push('st.favorite=true');
    if (f.view === 'history') where.push('st.read_at IS NOT NULL');
    const base = `FROM stories s JOIN sources src ON src.id=s.source_id LEFT JOIN story_translations tr ON tr.story_id=s.id JOIN categories c ON c.id=s.category LEFT JOIN story_state st ON st.story_id=s.id AND st.device_id=$1 WHERE ${where.join(' AND ')}`;
    const count = (await query('SELECT count(*) ' + base, params)).rows[0].count;
    const items = (
      await query(
        `SELECT s.*,${translationColumns},src.name source_name,src.kind source_kind,src.official source_official,c.name category_name,coalesce(st.favorite,false) favorite,st.read_at,(SELECT count(*) FROM stories g WHERE g.cluster_key=s.cluster_key) cluster_count ${base} ORDER BY ${f.view === 'history' ? 'st.read_at' : 's.detected_at'} DESC,s.id DESC LIMIT ${bind(f.limit)} OFFSET ${bind(f.offset)}`,
        params,
      )
    ).rows;
    return {
      items: items.map(presentStory),
      total: Number(count),
      offset: f.offset,
      limit: f.limit,
      cursor,
    };
  });
  app.get('/api/translations', async (req) => {
    const { ids } = z
      .object({
        ids: z
          .string()
          .max(2200)
          .regex(/^\d+(,\d+){0,99}$/),
      })
      .parse(req.query);
    return (
      await query(
        `SELECT s.id,s.title,s.summary,${translationColumns} FROM stories s LEFT JOIN story_translations tr ON tr.story_id=s.id WHERE s.id=ANY($1::bigint[])`,
        [ids.split(',')],
      )
    ).rows.map(presentStory);
  });
  app.get('/api/updates', async (req) => {
    const after = z.object({ after: z.string().regex(/^\d{1,18}$/) }).parse(req.query).after;
    const r = await query('SELECT id FROM stories WHERE id>$1 ORDER BY id LIMIT 1000', [after]);
    return { ids: r.rows.map((r) => r.id) };
  });
  app.get('/api/stories/:id', async (req, reply) => {
    const id = checkedId((req.params as any).id),
      d = await device(req, reply);
    const r = await query(
      `SELECT s.*,${translationColumns},src.name source_name,src.kind source_kind,c.name category_name,coalesce(st.favorite,false) favorite,st.read_at FROM stories s JOIN sources src ON src.id=s.source_id LEFT JOIN story_translations tr ON tr.story_id=s.id JOIN categories c ON c.id=s.category LEFT JOIN story_state st ON st.story_id=s.id AND st.device_id=$2 WHERE s.id=$1`,
      [id, d],
    );
    if (!r.rowCount) return reply.code(404).send({ error: 'Publicação não encontrada' });
    const related = (
      await query(
        `SELECT s.id,s.title,s.summary,s.url,s.published_at,${translationColumns},src.name source_name FROM stories s JOIN sources src ON src.id=s.source_id LEFT JOIN story_translations tr ON tr.story_id=s.id WHERE s.cluster_key=$1 ORDER BY s.published_at`,
        [r.rows[0].cluster_key],
      )
    ).rows;
    return { ...presentStory(r.rows[0]), related: related.map(presentStory) };
  });
  app.patch('/api/stories/:id/state', async (req, reply) => {
    const id = checkedId((req.params as any).id),
      d = await device(req, reply),
      b = z
        .object({ favorite: z.boolean().optional(), read: z.boolean().optional() })
        .parse(req.body);
    if (!(await query('SELECT 1 FROM stories WHERE id=$1', [id])).rowCount)
      return reply.code(404).send({ error: 'Publicação não encontrada' });
    await query(
      `INSERT INTO story_state(device_id,story_id,favorite,read_at) VALUES($1,$2,coalesce($3,false),CASE WHEN $4 THEN now() END) ON CONFLICT(device_id,story_id) DO UPDATE SET favorite=coalesce($3,story_state.favorite),read_at=CASE WHEN $4 IS NULL THEN story_state.read_at WHEN $4 THEN now() END`,
      [d, id, b.favorite ?? null, b.read ?? null],
    );
    return { ok: true };
  });
  app.get('/api/overview', async () => {
    const stats = (
      await query(
        `SELECT count(*) total,count(*) FILTER(WHERE detected_at>now()-interval '24 hours') today,max(detected_at) last_update FROM stories`,
      )
    ).rows[0];
    const alerts = (
      await query(
        `SELECT a.id alert_id,s.*,${translationColumns},src.name source_name FROM alerts a JOIN stories s ON s.id=a.story_id JOIN sources src ON src.id=s.source_id LEFT JOIN story_translations tr ON tr.story_id=s.id WHERE a.level='urgent' AND s.published_at>now()-interval '24 hours' ORDER BY a.created_at DESC LIMIT 8`,
      )
    ).rows;
    const trends = (
      await query(
        `WITH terms AS(SELECT s.id,s.source_id,s.category,s.detected_at,unnest(s.tags) topic FROM stories s WHERE s.detected_at>now()-interval '24 hours') SELECT topic,category,count(*)::int count,count(DISTINCT source_id)::int sources,count(*) FILTER(WHERE detected_at>now()-interval '1 hour')::int recent,count(*) FILTER(WHERE detected_at BETWEEN now()-interval '2 hours' AND now()-interval '1 hour')::int previous FROM terms GROUP BY topic,category ORDER BY recent DESC,count(*) DESC LIMIT 6`,
      )
    ).rows;
    const local = (
      await query(
        `SELECT s.*,${translationColumns},src.name source_name FROM stories s JOIN sources src ON src.id=s.source_id LEFT JOIN story_translations tr ON tr.story_id=s.id WHERE s.category=$1 ORDER BY detected_at DESC LIMIT 4`,
        [config.localCategoryId],
      )
    ).rows;
    const sources = (
      await query(
        `SELECT count(*) FILTER(WHERE enabled) active,count(*) FILTER(WHERE enabled AND status IN ('ok','live')) operational,count(*) FILTER(WHERE enabled AND status='error') failed FROM sources`,
      )
    ).rows[0];
    const state = (await query('SELECT * FROM collector_state')).rows;
    const prefs = (await query("SELECT value FROM settings WHERE key='alerts'")).rows[0]?.value || {
      quiet_start: 22,
      quiet_end: 8,
    };
    return {
      stats,
      alerts: alerts.map(presentStory),
      trends,
      local: local.map(presentStory),
      sources,
      collector: state,
      quiet: isQuiet(new Date(), prefs.quiet_start, prefs.quiet_end),
      server_time: new Date().toISOString(),
    };
  });
  const clients = new Set<any>();
  let listener: any;
  let listenerTimer: any;
  async function listen() {
    try {
      listener = await pool.connect();
      listener.on('notification', (n: any) => {
        for (const client of clients) {
          if (client.writableLength > 262144) {
            client.destroy();
            clients.delete(client);
          } else
            client.write(
              n.channel === 'newsradar_translation'
                ? `event: translation\ndata: ${n.payload}\n\n`
                : `event: news\nid: ${JSON.parse(n.payload).id}\ndata: ${n.payload}\n\n`,
            );
        }
      });
      listener.on('error', () => {
        listener?.release(true);
        listener = null;
        listenerTimer = setTimeout(listen, 2000);
      });
      await listener.query('LISTEN newsradar_news');
      await listener.query('LISTEN newsradar_translation');
    } catch {
      listenerTimer = setTimeout(listen, 2000);
    }
  }
  await listen();
  app.get(
    '/api/events',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (clients.size >= 100) return reply.code(503).send({ error: 'Limite de ligações' });
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      raw.write('retry: 2000\nevent: connected\ndata: {}\n\n');
      clients.add(raw);
      const timer = setInterval(() => raw.write(': heartbeat\n\n'), 15000);
      req.raw.on('close', () => {
        clearInterval(timer);
        clients.delete(raw);
      });
    },
  );
  app.get('/api/auth/status', async (req) => {
    const count = Number((await query('SELECT count(*) FROM admins')).rows[0].count);
    let authenticated = false;
    if (req.cookies.nr_session)
      authenticated = !!(
        await query('SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at>now()', [
          tokenHash(req.cookies.nr_session),
        ])
      ).rowCount;
    return { initialized: count > 0, authenticated };
  });
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } },
    async (req, reply) => {
      const b = credentials.parse(req.body);
      const r = await query('SELECT * FROM admins WHERE username=$1', [b.username]);
      if (!r.rowCount || !(await verifyPassword(b.password, r.rows[0].password_hash)))
        return reply.code(401).send({ error: 'Credenciais inválidas' });
      const token = newToken();
      await query("INSERT INTO sessions VALUES($1,$2,now()+interval '8 hours')", [
        tokenHash(token),
        r.rows[0].id,
      ]);
      reply.setCookie('nr_session', token, { ...cookies(req), maxAge: 28800 });
      return { ok: true };
    },
  );
  app.post(
    '/api/auth/setup',
    { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } },
    async (req, reply) => {
      const b = credentials.extend({ token: z.string().min(30).max(100) }).parse(req.body);
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query('LOCK TABLE admins IN EXCLUSIVE MODE');
        const token = await c.query(
          'DELETE FROM bootstrap WHERE token_hash=$1 AND expires_at>now() RETURNING *',
          [tokenHash(b.token)],
        );
        if (!token.rowCount || (await c.query('SELECT 1 FROM admins')).rowCount) {
          await c.query('ROLLBACK');
          return reply.code(403).send({ error: 'Inicialização inválida ou já efetuada' });
        }
        await c.query('INSERT INTO admins(username,password_hash) VALUES($1,$2)', [
          b.username,
          await hashPassword(b.password),
        ]);
        await c.query('DELETE FROM bootstrap');
        await c.query('COMMIT');
        return { ok: true };
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      } finally {
        c.release();
      }
    },
  );
  app.post('/api/auth/logout', async (req, reply) => {
    if (req.cookies.nr_session)
      await query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(req.cookies.nr_session)]);
    reply.clearCookie('nr_session', { path: '/' });
    return { ok: true };
  });
  app.get('/api/admin/system', { preHandler: admin }, async () => {
    const disk = await statfs(config.diskPath);
    return {
      translation: {
        ...(await translationStats()),
        enabled:
          (await query("SELECT value FROM settings WHERE key='translation'")).rows[0]?.value
            ?.enabled !== false,
      },
      hostname: os.hostname(),
      uptime: os.uptime(),
      cores: os.availableParallelism(),
      load: os.loadavg(),
      memory: { total: os.totalmem(), free: os.freemem(), api: process.memoryUsage().rss },
      disk: { total: disk.blocks * disk.bsize, free: disk.bavail * disk.bsize },
      database: (
        await query(
          'SELECT pg_database_size(current_database()) size,(SELECT count(*) FROM stories) stories',
        )
      ).rows[0],
      collector: (await query('SELECT * FROM collector_state')).rows,
      errors: (
        await query(
          'SELECT name,error,last_check FROM sources WHERE error IS NOT NULL ORDER BY last_check DESC LIMIT 20',
        )
      ).rows,
      audit: (await query('SELECT action,details,created_at FROM audit ORDER BY id DESC LIMIT 30'))
        .rows,
    };
  });
  app.put('/api/admin/translation', { preHandler: admin }, async (req) => {
    const b = z.object({ enabled: z.boolean() }).parse(req.body);
    await query(
      `INSERT INTO settings(key,value) VALUES('translation',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [JSON.stringify({ ...b, target: 'pt-PT', local_only: true })],
    );
    await audit(req, 'translation.update', b);
    return { ok: true };
  });
  app.post('/api/admin/translation/retry', { preHandler: admin }, async (req) => {
    const r = await query(
      "UPDATE story_translations SET status='pending',attempts=0,retry_at=now(),lease_token=NULL,lease_until=NULL WHERE status='failed'",
    );
    await audit(req, 'translation.retry', { count: r.rowCount });
    return { ok: true, count: r.rowCount };
  });
  app.get('/api/admin/settings', { preHandler: admin }, async () =>
    Object.fromEntries((await query('SELECT * FROM settings')).rows.map((r) => [r.key, r.value])),
  );
  app.put('/api/admin/settings', { preHandler: admin }, async (req) => {
    const b = z
      .object({
        quiet_start: num.min(0).max(23),
        quiet_end: num.min(0).max(23),
        retention_days: num.min(1).max(30),
      })
      .parse(req.body);
    await query(
      "INSERT INTO settings(key,value) VALUES('alerts',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [JSON.stringify(b)],
    );
    await audit(req, 'settings.update', b);
    return { ok: true };
  });
  app.patch('/api/admin/stories/:id', { preHandler: admin }, async (req) => {
    const id = checkedId((req.params as any).id),
      b = z
        .object({
          status: z.enum(['official', 'confirmed', 'unconfirmed', 'rumor', 'corrected']),
          priority,
        })
        .parse(req.body);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('UPDATE stories SET status=$2,priority=$3 WHERE id=$1', [
        id,
        b.status,
        b.priority,
      ]);
      if (b.priority === 'info') await c.query('DELETE FROM alerts WHERE story_id=$1', [id]);
      else
        await c.query(
          'INSERT INTO alerts(story_id,level) SELECT id,priority FROM stories WHERE id=$1 ON CONFLICT(story_id) DO UPDATE SET level=excluded.level',
          [id],
        );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
    await audit(req, 'story.review', { id, ...b });
    return { ok: true };
  });
  for (const table of ['sources', 'categories', 'rules', 'accounts'] as const) {
    app.get(
      `/api/admin/${table}`,
      { preHandler: admin },
      async () =>
        (
          await query(
            `SELECT * FROM ${table} ORDER BY ${table === 'categories' ? 'position' : 'id'}`,
          )
        ).rows,
    );
    app.post(`/api/admin/${table}`, { preHandler: admin }, async (req, reply) => {
      if (table === 'categories')
        return reply.code(400).send({ error: 'Editar as oito categorias existentes' });
      const b = schemas[table].parse(req.body) as any;
      if (
        table === 'sources' &&
        b.kind === 'bluesky' &&
        (await query("SELECT 1 FROM sources WHERE kind='bluesky'")).rowCount
      )
        throw Object.assign(
          Error('Existe uma única fonte Jetstream; gerir as contas nessa fonte.'),
          { statusCode: 400 },
        );
      if (table === 'sources' && b.enabled && ['reddit', 'facebook', 'x'].includes(b.kind))
        throw Object.assign(Error('Conector indisponível sem autorização gratuita configurada'), {
          statusCode: 400,
        });
      if (table === 'sources' && b.url)
        await validateTarget(b.url).catch((e) => {
          throw Object.assign(e, { statusCode: 400 });
        });
      if (table === 'accounts') {
        const src = (await query("SELECT id FROM sources WHERE kind='bluesky' LIMIT 1")).rows[0];
        b.source_id = src.id;
      }
      const keys = Object.keys(b);
      const r = await query(
        `INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
        Object.values(b),
      );
      await audit(req, table + '.create', { id: r.rows[0].id });
      return r.rows[0];
    });
    app.patch(`/api/admin/${table}/:id`, { preHandler: admin }, async (req) => {
      const id =
        table === 'categories'
          ? category.parse((req.params as any).id)
          : checkedId((req.params as any).id);
      const b = schemas[table].partial().parse(req.body) as any;
      if (table === 'sources') {
        const current = (await query('SELECT * FROM sources WHERE id=$1', [id])).rows[0];
        if (!current) throw Object.assign(Error('Fonte não encontrada'), { statusCode: 404 });
        const effective = { ...current, ...b };
        if (effective.enabled && ['reddit', 'facebook', 'x'].includes(effective.kind))
          throw Object.assign(Error('Conector indisponível sem autorização gratuita configurada'), {
            statusCode: 400,
          });
        if (
          effective.kind === 'bluesky' &&
          (await query("SELECT 1 FROM sources WHERE kind='bluesky' AND id!=$1", [id])).rowCount
        )
          throw Object.assign(Error('Apenas uma fonte Jetstream; gerir múltiplas contas'), {
            statusCode: 400,
          });
        if (effective.enabled && !effective.url)
          throw Object.assign(Error('A fonte ativa exige URL público'), { statusCode: 400 });
      }
      if (!Object.keys(b).length) throw Object.assign(Error('Sem alterações'), { statusCode: 400 });
      if (table === 'sources' && b.url)
        await validateTarget(b.url).catch((e) => {
          throw Object.assign(e, { statusCode: 400 });
        });
      if (table === 'accounts' && b.handle) {
        b.did = null;
        b.resolution_failures = 0;
        b.resolve_after = new Date().toISOString();
        b.error = null;
      }
      const keys = Object.keys(b);
      const r = await query(
        `UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')}${table === 'sources' ? ',next_poll=now()' : ''} WHERE id=$1 RETURNING *`,
        [id, ...Object.values(b)],
      );
      await audit(req, table + '.update', { id });
      return r.rows[0];
    });
    app.delete(`/api/admin/${table}/:id`, { preHandler: admin }, async (req, reply) => {
      if (table === 'categories' || table === 'sources')
        return reply.code(400).send({ error: 'Desativar preserva o histórico' });
      const id = checkedId((req.params as any).id);
      await query(`DELETE FROM ${table} WHERE id=$1`, [id]);
      await audit(req, table + '.delete', { id });
      return { ok: true };
    });
  }
  app.post(
    '/api/admin/sources/:id/test',
    { preHandler: admin, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req) => {
      const id = checkedId((req.params as any).id);
      const source = (await query('SELECT * FROM sources WHERE id=$1', [id])).rows[0];
      if (!source) return { ok: false, message: 'Fonte não encontrada' };
      if (
        ['reddit', 'facebook', 'x'].includes(source.kind) ||
        !source.url ||
        (source.kind === 'bluesky' && !source.enabled)
      )
        throw Object.assign(Error(source.error || 'Ativar a fonte antes de testar'), {
          statusCode: 400,
        });
      await query(
        "UPDATE sources SET next_poll=now(),status='pending',config=config||'{\"test_requested\":true}'::jsonb WHERE id=$1",
        [id],
      );
      await audit(req, 'source.test', { id });
      return { ok: true, message: 'Teste agendado no collector' };
    },
  );
  app.get('/api/admin/alerts', { preHandler: admin }, async () =>
    (
      await query(
        `SELECT a.*,s.title,s.summary,${translationColumns},s.status,s.url,src.name source_name FROM alerts a JOIN stories s ON s.id=a.story_id JOIN sources src ON src.id=s.source_id LEFT JOIN story_translations tr ON tr.story_id=s.id ORDER BY a.id DESC LIMIT 200`,
      )
    ).rows.map(presentStory),
  );
  app.addHook('onClose', async () => {
    clearTimeout(listenerTimer);
    for (const c of clients) c.end();
    if (listener) {
      await listener.query('UNLISTEN *');
      listener.release();
    }
  });
  return app;
}
