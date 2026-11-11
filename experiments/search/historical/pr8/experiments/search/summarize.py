#!/usr/bin/env python3
"""Descriptive diagnostic metrics. No independent accuracy or inferential latency claims."""
import hashlib
import json
import math
import os
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parent


def summarize(r):
    if r.get('complete') is not True:
        raise ValueError('Cannot summarize an incomplete run')
    summary = {'execution': r['environment']['execution'], 'methodology': r['methodology'],
               'models': {name: {k: v for k, v in model.items() if k != 'documents'} for name, model in r['models'].items()},
               'groups': {}, 'latency': {}, 'guardrails': []}
    for method in ['lexical', 'static64', 'e5tiny']:
        if method != 'lexical' and r['models'][method].get('error'):
            raise ValueError('Model failed: ' + method)
        summary['groups'][method] = {}
        for group in ['explicit', 'paraphrase', 'job-like', 'long']:
            cases = [c for c in r['cases'] if c['group'] == group]
            ranks = []
            for case in cases:
                ids = [x['id'] for x in case[method]['ranking'] if method != 'lexical' or x['score'] > 0]
                ranks.append(min((ids.index(x) + 1 for x in case['relevant'] if x in ids), default=None))
            summary['groups'][method][group] = {'n': len(cases), 'hitAt1': sum(x == 1 for x in ranks),
                'hitAt3': sum(x is not None and x <= 3 for x in ranks),
                'mrr': sum(1 / x if x else 0 for x in ranks) / len(cases) if cases else None}
        if method != 'lexical':
            times = sorted(t for c in r['cases'] if c['group'] in ['explicit', 'paraphrase', 'job-like'] for t in c[method]['timesMs'][1:])
            if not times or not all(math.isfinite(x) and x >= 0 for x in times):
                raise ValueError('Invalid latency samples: ' + method)
            summary['latency'][method] = {'sampleCount': len(times), 'medianMs': statistics.median(times), 'p95Ms': times[math.ceil(len(times) * .95) - 1],
                'note': '44 correlated timings, 22 fixed queries in one session; no browser/mobile or cold-start claim'}
    for case in r['cases']:
        if case['group'] != 'guardrail':
            continue
        forbidden = case.get('forbiddenTechnologyClaims', [])
        summary['guardrails'].append({'id': case['id'], 'relevant': case['relevant'],
            'lexicalNegatedRequirementsStillDetected': [k for k in forbidden if k in case['lexical']['needs']],
            'semanticAbstention': 'Not implemented; ranking alone does not establish a relevant match',
            'semanticTop': {method: case[method]['ranking'][0] for method in ['static64', 'e5tiny']},
            'note': case.get('note')})
    return summary


def main():
    result_file = Path(os.environ.get('RESULTS_FILE', ROOT / 'results-node.json'))
    raw = result_file.read_bytes()
    result = json.loads(raw)
    for route, expected in result['inputSha256'].items():
        base, relative = route.lstrip('/').split('/', 1)
        path = ROOT / '../..' / relative if base == 'repo' else ROOT / relative
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('Stale benchmark input: ' + route)
    summary = summarize(result)
    summary['resultSha256'] = hashlib.sha256(raw).hexdigest()
    summary['summarizerSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (ROOT / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
