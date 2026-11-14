import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
try {
  await writeFile(
    '.env',
    example.replace(
      /^(PGPASSWORD|PGADMIN_PASSWORD)=$/gm,
      (_, name) => `${name}=${randomBytes(32).toString('hex')}`,
    ),
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    'Created .env with a random database password. Review configuration before starting.',
  );
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('.env already exists; refusing to overwrite it.');
    process.exitCode = 1;
  } else throw error;
}
