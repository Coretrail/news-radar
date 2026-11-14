import { existsSync } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
if (existsSync('.env')) process.loadEnvFile('.env');
const databaseEnvironment = { ...process.env };
if (process.env.DATABASE_URL) {
  // Parse with the same driver as the app; never pass a secret URL in argv.
  const { default: pg } = await import('pg');
  const parameters = new pg.Client({ connectionString: process.env.DATABASE_URL })
    .connectionParameters;
  Object.assign(databaseEnvironment, {
    PGHOST: parameters.host,
    PGPORT: String(parameters.port),
    PGDATABASE: parameters.database,
    PGUSER: parameters.user,
    PGPASSWORD: parameters.password || '',
  });
  const options = new URLSearchParams(process.env.DATABASE_URL.split('?')[1] || '');
  for (const name of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
    if (options.has(name)) databaseEnvironment[`PG${name.toUpperCase()}`] = options.get(name);
  }
  delete databaseEnvironment.DATABASE_URL;
}
const directory = path.resolve(process.env.BACKUP_DIR || 'backups');
await mkdir(directory, { recursive: true, mode: 0o700 });
const destination = path.join(
  directory,
  `news-radar-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`,
);
const temporary = destination + '.tmp';
const file = await open(temporary, 'wx', 0o600);
try {
  const child = spawn('pg_dump', ['--format=custom'], {
    env: databaseEnvironment,
    stdio: ['ignore', file.fd, 'inherit'],
  });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw Error('pg_dump failed; incomplete backup removed');
  await file.close();
  await rename(temporary, destination);
  console.log(`Backup saved: ${destination}. Store and test restoration securely.`);
} catch (error) {
  await file.close();
  await rm(temporary, { force: true });
  throw error;
}
