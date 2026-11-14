import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { substitute, allowRules } from '../scripts/render-config.mjs';

// Exercise the real Nginx ACL and error redirect without changing production.
const temporary = await mkdtemp(path.join(tmpdir(), 'newsradar-403-'));
const socket = net.createServer();
socket.listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = (socket.address() as net.AddressInfo).port;
await new Promise<void>((resolve) => socket.close(() => resolve()));
const base = `http://127.0.0.1:${port}`;
const common = substitute(await readFile('deploy/nginx/default.conf.template', 'utf8'), {
  NGINX_LISTEN: `127.0.0.1:${port}`,
  NGINX_SERVER_NAME: 'localhost',
  STATIC_ROOT: path.resolve('dist'),
  API_UPSTREAM: '127.0.0.1:1',
  ALLOW_RULES: allowRules('127.0.0.2/32 10.23.0.0/24 10.24.0.0/24'),
});
await writeFile(
  path.join(temporary, 'nginx.conf'),
  `pid ${temporary}/nginx.pid;
error_log stderr crit;
events {}
http {
  access_log off;
  include /etc/nginx/mime.types;
  # Test-only source injection; production template never trusts these headers.
  set_real_ip_from 127.0.0.1;
  real_ip_header X-Test-Client-IP;
  ${common}
}
`,
);
const nginx = spawn('/usr/sbin/nginx', ['-p', temporary, '-c', 'nginx.conf', '-g', 'daemon off;']);
let diagnostic = '';
nginx.stderr.on('data', (chunk) => (diagnostic += chunk));
const request = (
  url: string,
  localAddress = '127.0.0.1',
  method = 'GET',
  headers: Record<string, string> = {},
) =>
  new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>(
    (resolve, reject) => {
      const req = http.request(base + url, { localAddress, method, headers }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(5000, () => req.destroy(new Error('Request timed out')));
      req.end();
    },
  );
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try {
      await request('/');
      break;
    } catch (error) {
      if (attempt >= 49 || nginx.exitCode !== null) throw new Error(diagnostic, { cause: error });
      await delay(100);
    }
  }
  for (const address of ['10.23.0.1', '10.23.0.218', '10.23.0.254', '10.24.0.1', '10.24.0.254']) {
    assert.equal(
      (await request('/', '127.0.0.1', 'GET', { 'X-Test-Client-IP': address })).status,
      200,
      `${address}: both authorized /24 networks can access the Radar`,
    );
  }
  for (const address of ['10.22.0.1', '10.22.0.254', '10.25.0.1', '10.0.0.1']) {
    assert.equal(
      (await request('/', '127.0.0.1', 'GET', { 'X-Test-Client-IP': address })).status,
      403,
      `${address}: other networks remain blocked`,
    );
  }
  for (const url of ['/', '/admin', '/api/health', '/assets/private.js', '/errors/other.css']) {
    const response = await request(url);
    assert.equal(response.status, 403, url);
    assert.match(response.body, /Esta ligação não tem acesso ao Radar/);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(String(response.headers['content-security-policy']), /style-src 'self'/);
  }
  assert.equal(
    (await request('/', '127.0.0.3', 'GET', { 'X-Forwarded-For': '10.24.0.10' })).status,
    403,
  );
  const head = await request('/', '127.0.0.1', 'HEAD');
  assert.equal(head.status, 403);
  assert.equal(head.body, '');
  assert.equal((await request('/errors/403.html')).status, 404, 'error document is internal');
  const css = await request('/errors/403.css');
  assert.equal(css.status, 200);
  assert.match(String(css.headers['content-type']), /text\/css/);
  assert.equal((await request('/', '127.0.0.2')).status, 200, 'authorized network retains access');

  browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(base + '/admin?from=403');
  assert.equal(response?.status(), 403);
  await page.getByRole('heading', { name: 'Esta ligação não tem acesso ao Radar.' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'pt-PT');
  assert.equal(
    await page.locator('body').evaluate((element) => getComputedStyle(element).color),
    'rgb(248, 250, 252)',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page
      .getByRole('link', { name: 'Tentar novamente' })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  const reload = page.waitForNavigation();
  await page.keyboard.press('Enter');
  assert.equal((await reload)?.status(), 403);
  assert.equal(page.url(), base + '/admin?from=403', 'retry preserves original destination');
  await mkdir('artifacts', { recursive: true });
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
    ['small', 320, 740],
  ] as const) {
    await page.setViewportSize({ width, height });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${name}: no overflow`,
    );
    await page.screenshot({ path: `artifacts/403-${name}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(
    '403: real ACL, spoof protection, protected routes, CSS/CSP, keyboard, retry and responsive layout passed',
  );
} finally {
  await browser?.close();
  if (nginx.exitCode === null) {
    const stopped = once(nginx, 'exit');
    nginx.kill('SIGQUIT');
    await stopped;
  }
  await rm(temporary, { recursive: true, force: true });
}
