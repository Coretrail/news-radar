import pg from 'pg';
import { config } from './config.js';
export const pool = new pg.Pool({
  ...config.database,
  max: 8,
  statement_timeout: 10000,
  idleTimeoutMillis: 30000,
});
pool.on('error', (e) => console.error('postgres', e.message));
export const query = (text: string, values: any[] = []) => pool.query(text, values);
