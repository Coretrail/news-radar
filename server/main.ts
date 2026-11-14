import { buildApp } from './app.js';
import { pool } from './db.js';
import { config } from './config.js';
const app = await buildApp();
await app.listen({ host: config.host, port: config.port });
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
