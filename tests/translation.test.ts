import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLanguage,
  splitText,
  adaptEuropeanPortuguese,
  translationKey,
  presentStory,
} from '../server/translation/domain.js';
test('texto português não é retraduzido e indícios da fonte ajudam títulos curtos', () => {
  assert.equal(detectLanguage('Incêndio em Castelo Branco mobiliza os bombeiros.', 'pt'), 'pt');
  assert.equal(
    detectLanguage('Researchers discover a new planet outside the solar system.', 'en'),
    'en',
  );
  assert.equal(detectLanguage('New GPU from AMD', 'en'), 'en');
  assert.equal(
    detectLanguage('Le gouvernement annonce de nouvelles mesures de sécurité.', 'auto'),
    'fr',
  );
});
test('segmentação preserva todo o texto e evita truncar resumos longos', () => {
  const text =
    'The government announced new measures. ' +
    'Scientists are studying these results carefully. '.repeat(20);
  const chunks = splitText(text, 240);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 240));
  assert.equal(chunks.join(' '), text.trim());
});
test('adapta termos e construções para Portugal sem confundir biologia ou resgate', () => {
  assert.equal(
    adaptEuropeanPortuguese(
      'O usuário salvou o arquivo em seu telefone celular.',
      'The user saved the file on their mobile phone.',
    ),
    'O utilizador guardou o ficheiro no seu telemóvel.',
  );
  assert.equal(
    adaptEuropeanPortuguese(
      'O trem está transportando a equipe.',
      'The train is carrying the team.',
    ),
    'O comboio está a transportar a equipa.',
  );
  assert.equal(
    adaptEuropeanPortuguese('A biologia celular salvou vidas.', 'Cell biology saved lives.'),
    'A biologia celular salvou vidas.',
  );
  assert.equal(
    adaptEuropeanPortuguese(
      'O investimento de 2 bilhões de euros.',
      'The investment of 2 billion euros.',
    ),
    'O investimento de 2 mil milhões de euros.',
  );
});
test('cache distingue texto, idioma e versão', () => {
  assert.notEqual(translationKey('A', 'en', 'v1'), translationKey('A', 'fr', 'v1'));
  assert.notEqual(translationKey('A', 'en', 'v1'), translationKey('A', 'en', 'v2'));
  assert.equal(translationKey('A', 'en', 'v1'), translationKey('A', 'en', 'v1'));
});
test('projeção usa tradução pronta preservando originais e proveniência', () => {
  const raw = {
    id: '1',
    title: 'New measures',
    summary: 'Original summary',
    url: 'https://example.org/',
    status: 'unconfirmed',
    translation_status: 'translated',
    title_pt: 'Novas medidas',
    summary_pt: 'Resumo traduzido',
  };
  const s = presentStory(raw);
  assert.equal(s.title, 'Novas medidas');
  assert.equal(s.summary, 'Resumo traduzido');
  assert.equal(s.original_title, 'New measures');
  assert.equal(s.original_summary, 'Original summary');
  assert.equal(s.url, raw.url);
  assert.equal(s.status, 'unconfirmed');
  assert.equal(raw.title, 'New measures');
});
test('tradução pendente ou falhada nunca oculta a notícia nem exibe tradução parcial', () => {
  for (const status of ['pending', 'processing', 'failed']) {
    const s = presentStory({
      title: 'Real original',
      summary: 'Real summary',
      translation_status: status,
      title_pt: 'Partial',
      summary_pt: null,
    });
    assert.equal(s.title, 'Real original');
    assert.equal(s.summary, 'Real summary');
    assert.equal(s.translation_status, status);
  }
});

test('adapta expressões jornalísticas frequentes para português europeu', () => {
  assert.equal(
    adaptEuropeanPortuguese(
      'O presidente se reunirá com os líderes em um encontro nesta semana.',
      'The president will meet the leaders at a meeting this week.',
    ),
    'O presidente irá reunir-se com os líderes num encontro esta semana.',
  );
  assert.equal(
    adaptEuropeanPortuguese(
      'O avião pousou e o piloto precisava pousar sua aeronave.',
      'The plane landed and the pilot needed to land the aircraft.',
    ),
    'O avião aterrou e o piloto precisava de aterrar sua aeronave.',
  );
});

test('preserva português em campos curtos e usa contexto da notícia para textos ambíguos', async () => {
  const { storyLanguages } = await import('../server/translation/domain.js');
  assert.equal(detectLanguage('Incêndio em Lisboa', 'auto'), 'pt');
  assert.equal(detectLanguage('Incêndio em Lisboa', 'en'), 'pt');
  assert.deepEqual(
    storyLanguages(
      'Última hora',
      'Os bombeiros combateram as chamas e confirmaram que não há pessoas feridas.',
      'auto',
    ),
    { title: 'pt', summary: 'pt' },
  );
});
