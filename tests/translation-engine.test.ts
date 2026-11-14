import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalTranslationEngine } from '../server/translation/engine.js';
if (!process.env.TRANSLATION_MODELS || !process.env.TRANSLATION_PYTHON)
  throw Error('Configure TRANSLATION_MODELS and TRANSLATION_PYTHON for this optional model test');
test('motor local reinicia sem uma saída antiga cancelar pedidos novos', async () => {
  const engine = new LocalTranslationEngine();
  try {
    const old = engine.translate(['The user saved the file.'], 'en').then(
      () => true,
      () => false,
    );
    engine.close();
    const next = await engine.translate(['Hello, world.'], 'en');
    assert.equal(await old, false);
    assert.equal(next.length, 1);
    assert.match(next[0], /olá/i);
  } finally {
    engine.close();
  }
});
