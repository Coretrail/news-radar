// Deliberately sequential: a new installation needs migrations before configuration.
await import('./migrate.js');
// migrate closes its pool, so seed runs in a separate process.
const { spawnSync } = await import('node:child_process');
const { fileURLToPath } = await import('node:url');
const result = spawnSync(process.execPath, [fileURLToPath(new URL('./seed.js', import.meta.url))], {
  stdio: 'inherit',
  env: process.env,
});
process.exitCode = result.status ?? 1;
