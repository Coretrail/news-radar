#!/usr/bin/env python3
"""Download pinned model DATA after license acceptance; never execute repository code."""
import argparse
import hashlib
import json
import pathlib
import shutil
import tarfile
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILES = {'model.bin', 'source.spm', 'target.spm', 'config.json', 'shared_vocabulary.json'}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--models-dir', default='models')
parser.add_argument('--accept-licenses', action='store_true', help='Accept CC-BY-4.0 and Apache-2.0 model licenses and attribution obligations')
args = parser.parse_args()
if not args.accept_licenses:
    parser.error('Read THIRD_PARTY_NOTICES.md and ops/translation-models.json, then pass --accept-licenses')
manifest = json.loads((ROOT / 'ops/translation-models.json').read_text())
models = pathlib.Path(args.models_dir).resolve()
models.mkdir(parents=True, exist_ok=True)

def metadata(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)

def download(url, destination, expected=None, maximum=600_000_000):
    digest = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(url, timeout=60) as response, open(destination, 'wb') as output:
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > maximum:
                raise RuntimeError('Download exceeds size limit')
            digest.update(chunk)
            output.write(chunk)
    if expected and digest.hexdigest() != expected:
        destination.unlink(missing_ok=True)
        raise RuntimeError('Checksum mismatch: ' + destination.name)

with tempfile.TemporaryDirectory(prefix='news-radar-models-') as temporary:
    temporary = pathlib.Path(temporary)
    for key, folder in [('english_portuguese', 'opus-mt-tc-big-en-pt-ct2'), ('multilingual_english', 'opus-mt-mul-en')]:
        spec = manifest[key]
        repository, revision = spec['repository'], spec['revision']
        tree = metadata(f'https://huggingface.co/api/models/{repository}/tree/{revision}')
        staging = temporary / ('staging-' + folder)
        staging.mkdir()
        if key == 'english_portuguese':
            archive_name = 'opus-mt-tc-big-en-pt-ct2.tar.gz'
            entry = next(item for item in tree if item['path'] == archive_name)
            packed = temporary / archive_name
            download(f'https://huggingface.co/{repository}/resolve/{revision}/{archive_name}', packed, entry['lfs']['oid'])
            with tarfile.open(packed) as archive:
                members = archive.getmembers()
                if sum(member.size for member in members) > 600_000_000 or any(not (member.isfile() or member.isdir()) for member in members):
                    raise RuntimeError('Unsafe model archive')
                for name in FILES:
                    member = archive.getmember(f'{folder}/{name}')
                    if not member.isfile():
                        raise RuntimeError('Unsafe model member')
                    with archive.extractfile(member) as source, open(staging / name, 'wb') as output:
                        shutil.copyfileobj(source, output)

        else:
            for entry in tree:
                if entry['path'] not in FILES:
                    continue
                name = entry['path']
                download(f'https://huggingface.co/{repository}/resolve/{revision}/{name}', staging / name, entry.get('lfs', {}).get('oid'))
        if any(not (staging / name).is_file() for name in FILES):
            raise RuntimeError('Incomplete model: ' + folder)
        # Preserve origin, pinned revision, model card and actual license beside model files.
        download(f'https://huggingface.co/{repository}/resolve/{revision}/README.md', staging / 'MODEL_CARD.md', maximum=2_000_000)
        license_name = 'CC-BY-4.0.txt' if spec['license'] == 'CC-BY-4.0' else 'Apache-2.0.txt'
        shutil.copy2(ROOT / 'third-party' / 'licenses' / 'common' / license_name, staging / 'LICENSE.txt')
        (staging / 'ATTRIBUTION.json').write_text(json.dumps({**spec, 'conversion': repository, 'notice': 'Models are not covered by the NEWS RADAR MIT license. CTranslate2 conversion by the named repository; European Portuguese adaptation is performed separately by NEWS RADAR.'}, indent=2) + '\n')
        destination = models / folder
        if destination.exists():
            raise RuntimeError(f'{folder} already exists; use a new directory or remove it deliberately before reprovisioning')
        shutil.copytree(staging, destination)
print('Pinned model data and license notices downloaded. No services were modified.')
