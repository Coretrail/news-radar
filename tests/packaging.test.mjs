import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { allowRules, nativeValues, substitute } from '../scripts/render-config.mjs';
test('native configuration renders independent paths, service user and network ACL', async () => {
  const values = nativeValues({
    NATIVE_INSTALL_DIR: '/srv/custom-radar',
    NODE_BINARY: '/usr/local/bin/node',
    NATIVE_USER: 'radar',
    NATIVE_LISTEN: '127.0.0.1:9080',
    NATIVE_SERVER_NAME: 'radar.example.org',
    PORT: '4100',
    ALLOWED_NETWORKS: '10.23.0.0/24 10.24.0.0/24',
  });
  const config = substitute(await readFile('deploy/nginx/default.conf.template', 'utf8'), values);
  assert.match(config, /root \/srv\/custom-radar\/dist;/);
  assert.match(config, /allow 10\.23\.0\.0\/24;/);
  assert.match(config, /proxy_pass http:\/\/127\.0\.0\.1:4100;/);
  assert.doesNotMatch(config, /\$\{[A-Z_]+\}/);
});
test('configuration cannot inject Nginx or systemd directives', () => {
  assert.throws(() => allowRules('all; return 200;'));
  assert.throws(() => nativeValues({ NATIVE_USER: 'root\nExecStart=/bin/sh' }));
  assert.throws(() => nativeValues({ NATIVE_INSTALL_DIR: '/tmp/x;evil' }));
});
test('environment initialization creates a private unique password and refuses overwrite', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'radar-env-'));
  try {
    const script = path.resolve('scripts/init-env.mjs');
    assert.equal(spawnSync(process.execPath, [script], { cwd: directory }).status, 0);
    const content = await readFile(path.join(directory, '.env'), 'utf8');
    assert.match(content, /^PGPASSWORD=[a-f0-9]{64}$/m);
    assert.match(content, /^PGADMIN_PASSWORD=[a-f0-9]{64}$/m);
    assert.notEqual(
      content.match(/^PGPASSWORD=(.+)$/m)[1],
      content.match(/^PGADMIN_PASSWORD=(.+)$/m)[1],
    );
    assert.equal((await stat(path.join(directory, '.env'))).mode & 0o777, 0o600);
    assert.equal(spawnSync(process.execPath, [script], { cwd: directory }).status, 1);
    assert.equal(await readFile(path.join(directory, '.env'), 'utf8'), content);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('mutating test guard rejects an inherited DATABASE_URL even with a test database name', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--eval', "import('./tests/safety.ts')"],
    {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PGDATABASE: 'isolated_test',
        DATABASE_URL: 'postgresql://localhost/operator_database',
      },
      encoding: 'utf8',
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unset DATABASE_URL/);
});
