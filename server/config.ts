import { existsSync } from 'node:fs';
import path from 'node:path';
import ipaddr from 'ipaddr.js';

if (process.env.NODE_ENV !== 'test' && existsSync('.env')) process.loadEnvFile('.env');
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const integer = (name: string, fallback: number) => {
    const value = Number(env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw Error(`Invalid ${name}`);
    return value;
  };
  const url = new URL(env.APP_URL || 'http://localhost:8080');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw Error('APP_URL must be an HTTP(S) origin without credentials or a path');
  const timeZone = env.APP_TIMEZONE || 'Europe/Lisbon';
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format();
  } catch {
    throw Error('Invalid APP_TIMEZONE');
  }
  const trust = env.TRUST_PROXY?.trim();
  let trustProxy: false | string[] = false;
  if (trust && trust !== 'false') {
    trustProxy = trust.split(/[\s,]+/).filter(Boolean);
    for (const address of trustProxy) {
      try {
        if (address.includes('/')) {
          const [, bits] = ipaddr.parseCIDR(address);
          if (!bits) throw Error('all');
        } else {
          ipaddr.parse(address);
        }
      } catch {
        throw Error(
          'TRUST_PROXY must contain explicit IP addresses or CIDRs; trust-all is not supported',
        );
      }
    }
  }
  const localCategoryId = env.LOCAL_CATEGORY_ID || 'local';
  if (
    !/^[a-z][a-z0-9-]{0,63}$/.test(localCategoryId) ||
    ['portugal', 'mundo', 'tecnologia', 'ia', 'ciberseguranca', 'ciencia', 'economia'].includes(
      localCategoryId,
    )
  )
    throw Error('Invalid LOCAL_CATEGORY_ID');
  const seedSources = env.SEED_SOURCES || 'minimal';
  if (!['minimal', 'all', 'none'].includes(seedSources)) throw Error('Invalid SEED_SOURCES');
  if (env.TRANSLATION_ENABLED && !['true', 'false'].includes(env.TRANSLATION_ENABLED))
    throw Error('Invalid TRANSLATION_ENABLED');
  return {
    appUrl: url.origin,
    host: env.HOST || '127.0.0.1',
    port: integer('PORT', 3001),
    timeZone,
    trustProxy,
    localCategoryId,
    localRegionName: env.LOCAL_REGION_NAME || 'Notícias locais',
    localRegionKeywords: (env.LOCAL_REGION_KEYWORDS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    database: {
      connectionString: env.DATABASE_URL || undefined,
      host: env.PGHOST || '/var/run/postgresql',
      port: integer('PGPORT', 5432),
      database: env.PGDATABASE || 'newsradar',
      user: env.PGUSER || env.USER || 'newsradar',
      password: env.PGPASSWORD || undefined,
    },
    translationEnabled: env.TRANSLATION_ENABLED === 'true',
    translationPython: env.TRANSLATION_PYTHON || path.resolve('.venv-translation/bin/python'),
    translationModels: env.TRANSLATION_MODELS || path.resolve('models'),
    diskPath: env.DISK_PATH || process.cwd(),
    seedSources,
  };
}
export const config = loadConfig();
