import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nativeValues, substitute } from './render-config.mjs';
if (existsSync('.env')) process.loadEnvFile('.env');
const outputArg = process.argv.indexOf('--output');
const output = path.resolve(outputArg >= 0 ? process.argv[outputArg + 1] : 'native-generated');
const values = nativeValues();
await mkdir(output, { recursive: true });
for (const component of ['api', 'collector', 'translation']) {
  const template = await readFile(
    new URL('../deploy/native/service.template', import.meta.url),
    'utf8',
  );
  const rendered = substitute(template, {
    ...values,
    COMPONENT: component,
    ENTRYPOINT:
      component === 'api'
        ? 'main'
        : component === 'translation'
          ? 'translation-worker'
          : 'collector',
    MEMORY_LIMIT: component === 'translation' ? '1G' : '384M',
  });
  await writeFile(path.join(output, `news-radar-${component}.service`), rendered, { mode: 0o644 });
}
const nginx = await readFile(
  new URL('../deploy/nginx/default.conf.template', import.meta.url),
  'utf8',
);
await writeFile(path.join(output, 'news-radar.conf'), substitute(nginx, values), { mode: 0o644 });
console.log(
  `Rendered templates in ${output}. Review before installation; no services were changed.`,
);
