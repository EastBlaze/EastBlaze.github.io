"""Pure metric tests; no model downloads, inference, or browser needed."""
import copy
import hashlib
import json
from pathlib import Path
import unittest

from summarize import summarize

ROOT = Path(__file__).resolve().parent
HISTORICAL = ROOT / 'historical/pr8/experiments/search'
RESULTS = json.loads((HISTORICAL / 'results-node.json').read_text())


class SummaryTests(unittest.TestCase):
    def test_historical_summary_matches_archived_measurements(self):
        saved = json.loads((HISTORICAL / 'summary.json').read_text())
        expected = summarize(RESULTS)
        for key, value in expected.items():
            self.assertEqual(saved[key], value)
        self.assertEqual(saved['resultSha256'], hashlib.sha256((HISTORICAL / 'results-node.json').read_bytes()).hexdigest())
        self.assertEqual(saved['summarizerSha256'], hashlib.sha256((HISTORICAL / 'summarize.py').read_bytes()).hexdigest())

    def test_partial_runs_are_rejected(self):
        result = copy.deepcopy(RESULTS)
        result['complete'] = False
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            summarize(result)
        result['complete'] = True
        result['models']['e5tiny']['error'] = 'failed'
        with self.assertRaisesRegex(ValueError, 'failed'):
            summarize(result)

    def test_zero_score_lexical_default_order_is_not_a_hit(self):
        result = copy.deepcopy(RESULTS)
        case = result['cases'][0]
        case['relevant'] = [case['lexical']['ranking'][0]['id']]
        for item in case['lexical']['ranking']:
            item['score'] = 0
        result['cases'] = [case]
        group = summarize(result)['groups']['lexical']['explicit']
        self.assertEqual(group, {'n': 1, 'hitAt1': 0, 'hitAt3': 0, 'mrr': 0})

    def test_oracle_and_guardrail_rankings_cannot_raise_primary_metrics(self):
        result = copy.deepcopy(RESULTS)
        original = summarize(result)
        for case in result['cases']:
            for method in ['static64', 'e5tiny']:
                if 'requirementsOnly' in case[method]:
                    case[method]['requirementsOnly']['ranking'] = []
                if case['group'] == 'guardrail':
                    case[method]['ranking'][0]['id'] = 'deliberately-not-a-project'
        changed = summarize(result)
        self.assertEqual(original['groups'], changed['groups'])
        self.assertEqual(original['latency'], changed['latency'])
        self.assertEqual(len(changed['guardrails']), 6)

    def test_latency_discards_only_first_trial_and_excludes_long_guardrails(self):
        result = copy.deepcopy(RESULTS)
        for case in result['cases']:
            for method in ['static64', 'e5tiny']:
                case[method]['timesMs'] = [99999, 1, 2] if case['group'] in ['explicit', 'paraphrase', 'job-like'] else [99999] * 3
        for latency in summarize(result)['latency'].values():
            self.assertEqual(latency['sampleCount'], 44)
            self.assertEqual(latency['medianMs'], 1.5)
            self.assertEqual(latency['p95Ms'], 2)

    def test_empty_groups_have_no_fabricated_accuracy(self):
        result = copy.deepcopy(RESULTS)
        result['cases'] = [c for c in result['cases'] if c['group'] != 'long']
        for method in summarize(result)['groups'].values():
            self.assertEqual(method['long']['n'], 0)
            self.assertIsNone(method['long']['mrr'])


if __name__ == '__main__':
    unittest.main()
