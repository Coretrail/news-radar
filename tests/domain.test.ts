import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, classify, isQuiet, plainText, fingerprint } from '../server/domain.js';
test('remove tracking preservando parâmetros de identidade', () =>
  assert.equal(
    normalizeUrl('https://example.org/story?id=2&utm_source=x#top'),
    'https://example.org/story?id=2',
  ));
test('recusa URLs executáveis', () => assert.throws(() => normalizeUrl('javascript:alert(1)')));
test('regional classification uses administrator rules without a hardcoded location', () => {
  assert.equal(
    classify('Local event in Demo Town', 'mundo', [
      { term: 'Demo Town', category: 'local', priority: 'priority' },
    ]).category,
    'local',
  );
  assert.equal(classify('Uma notícia qualquer', 'mundo', []).category, 'mundo');
});
test('rumores não são automaticamente confirmados', () =>
  assert.equal(classify('Rumor: alegado ataque', 'tecnologia', []).status, 'rumor'));
test('regras de urgência aplicam-se a fontes não oficiais', () =>
  assert.equal(
    classify('Alerta vermelho de tempestade', 'portugal', [
      { term: 'alerta vermelho', priority: 'urgent', enabled: true, exclude: false },
    ]).priority,
    'urgent',
  ));
test('quiet hours Lisbon handles summer timezone', () => {
  assert.equal(isQuiet(new Date('2026-07-01T21:30:00Z'), 22, 8, 'Europe/Lisbon'), true);
  assert.equal(isQuiet(new Date('2026-07-01T07:30:00Z'), 22, 8, 'Europe/Lisbon'), false);
});
test('remove marcação e limita excertos', () =>
  assert.equal(plainText('<p>Olá &amp; mundo</p><script>alert(1)</script>'), 'Olá & mundo'));
test('fingerprint junta diferenças de maiúsculas e pontuação', () =>
  assert.equal(fingerprint('Notícia, em Portugal!'), fingerprint('notícia em portugal')));
