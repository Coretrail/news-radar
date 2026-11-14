import { readdir, readFile } from 'node:fs/promises';
import { pool } from './db.js';
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(78283642)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT now())',
  );
  const directory = new URL('./migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter((f) => f.endsWith('.sql')).sort()) {
    if ((await client.query('SELECT 1 FROM migrations WHERE version=$1', [file])).rowCount)
      continue;
    try {
      await client.query('BEGIN');
      await client.query(await readFile(new URL(file, directory), 'utf8'));
      await client.query('INSERT INTO migrations(version) VALUES($1)', [file]);
      await client.query('COMMIT');
      console.log('Applied', file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(78283642)');
  client.release();
  await pool.end();
}
