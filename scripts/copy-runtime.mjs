import { cp } from 'node:fs/promises';
await cp('server/migrations', 'build/migrations', { recursive: true });
await cp('server/initial-sources.json', 'build/initial-sources.json');
await cp('server/translation/engine.py', 'build/translation/engine.py');
await cp('LICENSE', 'dist/legal/LICENSE');
await cp('THIRD_PARTY_NOTICES.md', 'dist/legal/THIRD_PARTY_NOTICES.md');
await cp('third-party', 'dist/legal/third-party', { recursive: true });
