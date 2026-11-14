// Local release guard: no file content or potential secret is printed.
// Run a dedicated secret scanner as well; this is not a proof of absence.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const findings = [];
for (const file of files) {
  if (
    /(^|\/)(?:node_modules|models|\.venv[^/]*|backups|artifacts|native-generated)\//.test(file) ||
    /\.(?:key|pem|p12|pfx|dump|log)$/.test(file) ||
    (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example')
  )
    findings.push([file, 'private/generated file must not be tracked']);
  if (/\.(?:png|woff2?|ico)$/.test(file)) continue;
  const content = await readFile(file, 'utf8');
  const patterns = [
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['credential URL', /https?:\/\/[^\s/@]+:[^\s/@]+@[^\s/'"<>]+/],
    ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
    ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/],
  ];
  for (const [name, pattern] of patterns) {
    const match = content.match(pattern);
    // Reserved example domains in explicit validation fixtures are not live credentials.
    if (
      match &&
      !(
        name === 'credential URL' &&
        /@(?:example\.(?:org|com|net)|localhost)(?:[:/]|$)/.test(match[0])
      )
    )
      findings.push([file, name]);
  }
}
if (findings.length) {
  for (const [file, kind] of findings) console.error(`${file}: ${kind}`);
  process.exitCode = 1;
} else
  console.log(
    `Public file guard passed for ${files.length} tracked files. Run a history-aware secret scanner before publication.`,
  );
