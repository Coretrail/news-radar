import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../server/config.js';

test('configuration supports an independent deployment without private defaults', () => {
  const c = loadConfig({
    APP_URL: 'https://radar.example.org',
    PORT: '4100',
    HOST: '0.0.0.0',
    APP_TIMEZONE: 'America/New_York',
    LOCAL_REGION_NAME: 'My region',
    LOCAL_REGION_KEYWORDS: 'Town A,Town B',
    PGHOST: 'postgres',
    PGDATABASE: 'independent',
    PGUSER: 'owner',
    PGPORT: '5433',
    TRUST_PROXY: '10.42.0.0/24,127.0.0.1',
  });
  assert.equal(c.appUrl, 'https://radar.example.org');
  assert.equal(c.port, 4100);
  assert.equal(c.timeZone, 'America/New_York');
  assert.deepEqual(c.localRegionKeywords, ['Town A', 'Town B']);
  assert.equal(c.database.database, 'independent');
  assert.equal(c.database.port, 5433);
  assert.deepEqual(c.trustProxy, ['10.42.0.0/24', '127.0.0.1']);
  assert.equal(loadConfig({}).trustProxy, false);
  assert.equal(loadConfig({}).translationEnabled, false);
});
test('invalid ports, timezones, public URLs and trust-all proxy are refused', () => {
  for (const env of [
    { PORT: 'abc' },
    { PORT: '0' },
    { APP_TIMEZONE: 'Not/AZone' },
    { APP_URL: 'https://user:secret@example.org' },
    { APP_URL: 'https://example.org/subpath' },
    { TRUST_PROXY: 'true' },
    { TRUST_PROXY: '0.0.0.0/0' },
    { LOCAL_CATEGORY_ID: 'tecnologia' },
  ]) {
    assert.throws(() => loadConfig(env));
  }
});
test('passwords and connection strings are never interpolated into configuration errors', () => {
  assert.throws(
    () => loadConfig({ PGPORT: 'secret-value' }),
    (error: Error) => !error.message.includes('secret-value'),
  );
});
