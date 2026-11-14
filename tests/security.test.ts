import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, validateTarget } from '../server/safe-fetch.js';
import { hashPassword, verifyPassword } from '../server/auth.js';
test('bloqueia redes internas, metadata e IPv4 mapeado em IPv6', () => {
  for (const address of [
    '127.0.0.1',
    '10.20.30.40',
    '10.0.0.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fe80::1',
    'fc00::1',
    '0.0.0.0',
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('1.1.1.1'), true);
});
test('não aceita credenciais, protocolo inseguro ou portas arbitrárias', async () => {
  for (const url of [
    'file:///etc/passwd',
    'http://example.org',
    'https://a:b@example.org/',
    'https://example.org:3000/',
  ])
    await assert.rejects(() => validateTarget(url));
});
test('passwords usam salt distinto e comparação segura', async () => {
  const a = await hashPassword('A-strong-local-test-password');
  const b = await hashPassword('A-strong-local-test-password');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('A-strong-local-test-password', a), true);
  assert.equal(await verifyPassword('wrong', a), false);
});
