#!/usr/bin/env python3
"""Download pinned public model data. Never execute remote model code."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent


def verify(path, item):
    return (path.is_file() and path.stat().st_size == item['bytes']
            and hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true', help='Check local files without network access')
    args = parser.parse_args()
    models = Path(os.environ.get('MODELS_DIR', ROOT / 'models')).resolve()
    manifest = json.loads((ROOT / 'model-manifest.json').read_text())
    for item in manifest['files']:
        path = (models / item['local_path']).resolve()
        if not path.is_relative_to(models):
            raise ValueError('Manifest path escapes model directory')
        if not verify(path, item):
            if args.verify_only:
                raise ValueError('Model missing or corrupt: ' + item['local_path'])
            path.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(item['url'], timeout=120) as response:
                data = response.read(item['bytes'] + 1)
            if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
                raise ValueError('Model data hash mismatch: ' + item['local_path'])
            temporary = path.with_suffix(path.suffix + '.tmp')
            temporary.write_bytes(data)
            temporary.replace(path)
        print(item['local_path'], path.stat().st_size)


if __name__ == '__main__':
    main()
