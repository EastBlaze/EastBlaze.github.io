#!/usr/bin/env python3
"""Publish content-addressed static assets without deleting previous releases."""
import argparse
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ('project-view.js', 'index.js', 'index.css', 'ui-controls.js')


def asset_name(name, content):
    path = Path(name)
    digest = hashlib.sha256(content).hexdigest()[:16]
    return f'{path.stem}.{digest}{path.suffix}'


def build(root=ROOT, check=False):
    html_path = root / 'index.html'
    original = html_path.read_text()
    html = original
    expected = {}
    for name in SOURCES:
        content = (root / name).read_bytes()
        versioned = asset_name(name, content)
        expected[versioned] = content
        path = Path(name)
        attribute = 'href' if path.suffix == '.css' else 'src'
        pattern = rf'{attribute}="\./{re.escape(path.stem)}(?:\.[a-f0-9]{{16}})?{re.escape(path.suffix)}"'
        html, count = re.subn(pattern, f'{attribute}="./{versioned}"', html)
        if count != 1:
            raise ValueError(f'Expected exactly one {name} reference, found {count}')
    if check:
        errors = []
        if html != original:
            errors.append('index.html references do not match the current source hashes')
        for name, content in expected.items():
            target = root / name
            if not target.exists() or target.read_bytes() != content:
                errors.append(f'{name} is missing or differs from its source')
        if errors:
            raise ValueError('; '.join(errors) + '. Run python3 scripts/build_assets.py')
    else:
        for name, content in expected.items():
            (root / name).write_bytes(content)
        html_path.write_text(html)
    return tuple(expected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        names = build(check=args.check)
    except ValueError as error:
        parser.exit(1, f'{error}\n')
    print(('Verified' if args.check else 'Generated') + ': ' + ', '.join(names))


if __name__ == '__main__':
    main()
