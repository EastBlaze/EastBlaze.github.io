#!/usr/bin/env python3
"""Independently verify query, passage, oracle, and truncation-boundary token IDs."""
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess

import numpy as np
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parent
models = Path(os.environ.get('MODELS_DIR', ROOT / 'models')).resolve()
result_file = Path(os.environ.get('RESULTS_FILE', ROOT / 'results-node.json'))
result_bytes = result_file.read_bytes()
r = json.loads(result_bytes)
if r.get('complete') is not True:
    raise ValueError('Cannot verify an incomplete run')
for route, expected in r['inputSha256'].items():
    base, relative = route.lstrip('/').split('/', 1)
    path = (ROOT / '../..' / relative) if base == 'repo' else ROOT / relative
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError('Stale benchmark input: ' + route)
boundaries = json.loads(subprocess.check_output(['node', str(ROOT / 'tokenizer-boundaries.mjs')], env={**os.environ, 'MODELS_DIR': str(models)}, text=True))
report = {'resultSha256': hashlib.sha256(result_bytes).hexdigest(),
          'verifierSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'boundaryToolSha256': hashlib.sha256((ROOT / 'tokenizer-boundaries.mjs').read_bytes()).hexdigest()}
for name, directory, special in [('static64', 'static', False), ('e5tiny', 'e5', True)]:
    tokenizer = Tokenizer.from_file(str(models / directory / 'tokenizer.json'))
    tokenizer.no_padding()
    if special:
        tokenizer.enable_truncation(max_length=512)
    else:
        tokenizer.no_truncation()

    def compare(items):
        mismatches = []
        for ident, text, kind, expected in items:
            prompt = f'{kind}: {text}' if special else text
            if tokenizer.encode(prompt, add_special_tokens=special).ids != expected:
                mismatches.append(ident)
        return {'cases': len(items), 'exactIdMatches': len(items) - len(mismatches), 'mismatches': mismatches}

    report[name] = compare([(c['id'], c['query'], 'query', c[name]['ids']) for c in r['cases']])
    docs = {d['id']: d for d in r['models'][name]['documents']}
    report[name]['passages'] = compare([(d['id'], d['text'], 'passage', docs[d['id']]['ids']) for d in r['documents']])
    report[name]['oracleProbes'] = compare([(c['id'], c['suffix'].strip(), 'query', c[name]['requirementsOnly']['ids']) for c in r['cases'] if c['group'] == 'long'])
    report[name]['boundaries'] = compare([(str(i), b['text'], 'query', b['ids']) for i, b in enumerate(boundaries) if b['method'] == name])
    for group in [report[name], report[name]['passages'], report[name]['oracleProbes'], report[name]['boundaries']]:
        if group['mismatches']:
            raise AssertionError(f'{name} tokenizer mismatch: {group}')

# Independent NumPy static pooling scores, using the same public corpus text.
raw = (models / 'static' / 'model.safetensors').read_bytes()
length = struct.unpack('<Q', raw[:8])[0]
entry = json.loads(raw[8:8 + length])['embedding.weight']
weights = np.frombuffer(raw, dtype='<f4', offset=8 + length + entry['data_offsets'][0]).reshape(entry['shape'])
tokenizer = Tokenizer.from_file(str(models / 'static' / 'tokenizer.json'))
tokenizer.no_padding()
tokenizer.no_truncation()


def embed(text):
    ids = tokenizer.encode(text, add_special_tokens=False).ids
    vector = weights[ids].astype(np.float64).sum(axis=0) if ids else np.zeros(64)
    length = np.linalg.norm(vector)
    return vector / length if length else vector


docs = {d['id']: embed(d['text']) for d in r['documents']}
errors = []
for case in r['cases']:
    vector = embed(case['query'])
    for item in case['static64']['ranking']:
        errors.append(abs(float(vector @ docs[item['id']]) - item['score']))
report['staticScores'] = {'comparisons': len(errors), 'maximumAbsoluteError': max(errors)}
assert max(errors) < 1e-10
(ROOT / 'tokenizer-parity.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
