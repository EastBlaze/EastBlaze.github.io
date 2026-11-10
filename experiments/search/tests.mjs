import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, realpath, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { baseline } from './baseline.mjs';
import { expandCases, documentText, normalize, rankVectors, runBenchmark, METHODS } from './core.mjs';
import { staticWeights } from './encoders.mjs';
import { INPUT_FILES, verifiedReader, sha256 } from './evidence.mjs';
import { readBody, resolvePublicPath, requestHandler } from './server.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const source = read('../../index.js');
const projects = JSON.parse(read('../../projects.json')).projects;
const query = baseline(source);
const cases = JSON.parse(read('./cases.json'));
const resultsText = read('./results-node.json');
const results = JSON.parse(resultsText);
const parity = JSON.parse(read('./tokenizer-parity.json'));

test('production source and corpus match recorded provenance', () => {
  const provenance = JSON.parse(read('./provenance.json'));
  for (const [path, digest] of Object.entries(provenance.sourceSha256)) assert.equal(hash(read('../../' + path)), digest);
});
test('baseline adapter rejects changed wrapper or extraction boundary', () => {
  assert.throws(() => baseline(source.replace('  function element(', '  function changed(')), /layout/);
  assert.throws(() => baseline('/* changed wrapper */' + source), /layout/);
});
test('Google Cloud explicit technology does not turn AWS into a match', () => {
  const r = query('GCP', projects).ranking;
  assert.equal(r[0].id, 'social-app');
  assert.deepEqual(r[0].matchedTechnologyKeys, ['gcp']);
  assert.deepEqual(r.find(x => x.id === 'pig-management').matchedTechnologyKeys, []);
});
test('unknown technology is never an explicit verified match', () => {
  assert.deepEqual(query('React Rust Kubernetes', projects).needs, []);
});
test('baseline negation limitation is recorded, not silently changed', () => {
  const r = query('Vue.js나 D3.js 경험은 필요 없습니다. Python 이미지 인식 서버 경험을 찾습니다.', projects);
  assert.equal(r.ranking[0].id, 'solar-dashboard');
  assert.ok(r.needs.includes('vue'));
});
test('diagnostic cases have unique IDs and valid public project labels', () => {
  assert.equal(cases.length, 30);
  assert.equal(new Set(cases.map(c => c.id)).size, 30);
  for (const c of cases) for (const id of c.relevant) assert.ok(projects.some(p => p.id === id));
});
test('fixtures expand once and reject malformed repetition counts', () => {
  assert.equal(expandCases([{ query: 'head', repeat: 'X', repetitions: 2, suffix: 'tail' }])[0].query, 'headXXtail');
  for (const repetitions of [-1, 1.5, 1001]) assert.throws(() => expandCases([{ query: '', repetitions }]), /fixture/);
});
test('documents contain only public text, not relevance labels or synthetic metadata', () => {
  const p = { ...projects[0], relevant: ['LEAK'], query: 'LEAK', expected: 'LEAK' };
  assert.equal(documentText(p), documentText(projects[0]));
  assert.ok(!documentText(p).includes('LEAK'));
});
test('normalization and ranking reject invalid vectors and keep deterministic ties', () => {
  assert.deepEqual(normalize([3, 4]), [0.6, 0.8]);
  assert.deepEqual(normalize([0, 0]), [0, 0]);
  assert.throws(() => normalize([NaN]), /Non-finite/);
  assert.throws(() => rankVectors([1], [[1, 2]], [{ id: 'a' }]), /embedding/);
  assert.throws(() => rankVectors([NaN], [[1]], [{ id: 'a' }]), /embedding/);
  assert.deepEqual(rankVectors([0], [[1], [1]], [{ id: 'b' }, { id: 'a' }]).map(r => r.id), ['b', 'a']);
});
test('static parser rejects truncated data and invalid offsets', () => {
  assert.throws(() => staticWeights(new ArrayBuffer(7)), /Truncated/);
  const bytes = new ArrayBuffer(9);
  new DataView(bytes).setBigUint64(0, 100n, true);
  assert.throws(() => staticWeights(bytes), /header/);
  const header = JSON.stringify({ 'embedding.weight': { dtype: 'F32', shape: [32000, 64], data_offsets: [0, 8192000] } });
  const bad = new ArrayBuffer(8 + header.length);
  new DataView(bad).setBigUint64(0, BigInt(header.length), true);
  new Uint8Array(bad, 8).set(new TextEncoder().encode(header));
  assert.throws(() => staticWeights(bad), /offsets/);
});
test('model integrity checks bytes before inference', async () => {
  const bytes = new TextEncoder().encode('{}').buffer;
  const entry = { local_path: 'x', bytes: 2, sha256: await sha256(bytes) };
  const valid = verifiedReader(async () => bytes, { files: [entry] });
  assert.deepEqual(await valid.readJson('/models/x'), {});
  assert.equal(valid.verifiedModelSha256['/models/x'], entry.sha256);
  await assert.rejects(verifiedReader(async () => new ArrayBuffer(3), { files: [entry] }).readBytes('/models/x'), /integrity/);
  await assert.rejects(valid.readBytes('/models/unlisted'), /integrity/);
});

function fakeEncoders({ fail = false, calls = [], disposed = [] } = {}) {
  return Object.fromEntries(METHODS.map(name => [name, async () => ({
    loadMs: 0,
    encode: async (text, kind = 'query') => {
      calls.push({ name, text, kind });
      if (fail && name === 'static64' && kind === 'query') throw new Error('Deliberate test failure');
      return { vector: [1, 0], tokens: 1, usedTokens: 1, truncated: false, ids: [1] };
    },
    dispose: () => disposed.push(name),
  })]));
}
const runFake = (fixtures, encoders) => runBenchmark({ projects, cases: fixtures, source, encoders, environment: {}, now: () => 0 });
test('changing relevance labels cannot alter encoder inputs or rankings', async () => {
  const left = [], right = [];
  const fixture = cases.slice(0, 2);
  const a = await runFake(fixture, fakeEncoders({ calls: left }));
  const b = await runFake(fixture.map(c => ({ ...c, relevant: ['other-label'] })), fakeEncoders({ calls: right }));
  assert.deepEqual(left, right);
  for (const method of ['lexical', ...METHODS]) assert.deepEqual(a.cases.map(c => c[method].ranking), b.cases.map(c => c[method].ranking));
});
test('oracle suffix probe stays separate from full-query measurements', async () => {
  const calls = [];
  const result = await runFake(cases.filter(c => c.group === 'long').slice(0, 1), fakeEncoders({ calls }));
  for (const method of METHODS) {
    assert.equal(result.cases[0][method].requirementsOnly.oracle, true);
    const queries = calls.filter(c => c.name === method && c.kind === 'query');
    assert.equal(queries.length, 4);
    assert.ok(queries.slice(0, 3).every(c => c.text === result.cases[0].query));
    assert.equal(queries[3].text, result.cases[0].suffix.trim());
  }
});
test('model failures mark result incomplete, still run other model, and release both sessions', async () => {
  const disposed = [];
  const result = await runFake(cases.slice(0, 1), fakeEncoders({ fail: true, disposed }));
  assert.equal(result.complete, false);
  assert.match(result.models.static64.error, /Deliberate/);
  assert.ok(result.cases[0].e5tiny);
  assert.deepEqual(disposed, METHODS);
});
test('recorded results are tied to every current experiment input', () => {
  assert.equal(results.schemaVersion, 2);
  assert.equal(results.complete, true);
  assert.deepEqual(Object.keys(results.inputSha256).sort(), [...INPUT_FILES].sort());
  for (const file of INPUT_FILES) {
    const relative = file.replace('/repo/', '../../').replace('/harness/', './');
    assert.equal(results.inputSha256[file], hash(read(relative)), `Stale result: ${file}`);
  }
});
test('recorded corpus, case content, labels and lexical rankings match current inputs', () => {
  assert.deepEqual(results.projects, projects.map(p => p.id));
  assert.deepEqual(results.documents, projects.map(p => ({ id: p.id, text: documentText(p) })));
  assert.equal(results.cases.length, cases.length);
  for (const [i, fixture] of expandCases(cases).entries()) {
    for (const [key, value] of Object.entries(fixture)) assert.deepEqual(results.cases[i][key], value, `${fixture.id}.${key}`);
    assert.deepEqual(results.cases[i].lexical, query(fixture.query, projects));
  }
});
test('recorded model files match pinned manifest and include every inference input', () => {
  const manifest = JSON.parse(read('./model-manifest.json'));
  assert.equal(Object.keys(results.verifiedModelSha256).length, 5);
  for (const [file, digest] of Object.entries(results.verifiedModelSha256)) {
    assert.equal(digest, manifest.files.find(f => '/models/' + f.local_path === file)?.sha256);
  }
});
test('recorded WASM runs cover all cases with complete, finite, sorted rankings', () => {
  assert.equal(results.environment.execution, 'Node.js WASM fallback, NOT browser');
  for (const method of METHODS) {
    assert.ok(!results.models[method].error);
    for (const c of results.cases) {
      const run = c[method];
      assert.deepEqual(run.ranking.map(x => x.id).sort(), projects.map(p => p.id).sort());
      assert.ok(run.ranking.every(x => Number.isFinite(x.score) && Math.abs(x.score) <= 1.000001));
      assert.ok(run.ranking.every((x, i) => i === 0 || run.ranking[i - 1].score >= x.score));
      assert.equal(run.timesMs.length, 3);
      assert.ok(run.timesMs.every(x => Number.isFinite(x) && x >= 0));
      assert.equal(run.ids.length, run.usedTokens);
    }
  }
});
test('parity is tied to current results and reference script, not an unrelated success JSON', () => {
  assert.equal(parity.resultSha256, hash(resultsText));
  assert.equal(parity.verifierSha256, hash(read('./verify-tokenizers.py')));
  assert.equal(parity.boundaryToolSha256, hash(read('./tokenizer-boundaries.mjs')));
  for (const method of METHODS) {
    assert.equal(parity[method].exactIdMatches, 30);
    assert.equal(parity[method].passages.exactIdMatches, 5);
    assert.equal(parity[method].oracleProbes.exactIdMatches, 2);
    assert.equal(parity[method].boundaries.exactIdMatches, parity[method].boundaries.cases);
    assert.ok(parity[method].boundaries.cases >= 4);
    assert.deepEqual(parity[method].mismatches, []);
  }
  assert.equal(parity.staticScores.comparisons, 150);
  assert.ok(parity.staticScores.maximumAbsoluteError < 1e-10);
});
test('long-query truncation remains explicit and oracle is excluded from primary result', () => {
  for (const c of results.cases.filter(c => c.group === 'long')) {
    assert.equal(c.e5tiny.truncated, true);
    assert.equal(c.e5tiny.usedTokens, 512);
    assert.equal(c.e5tiny.ids.at(-1), 2);
    assert.equal(c.e5tiny.requirementsOnly.oracle, true);
  }
});
test('body limit is enforced incrementally in bytes, including UTF-8', async () => {
  assert.equal(await readBody(Readable.from(['가']), 3), '가');
  await assert.rejects(readBody(Readable.from(['가', 'x']), 3), { status: 413 });
});
test('HTTP route rejects encoded traversal and symlink escapes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'resume-path-test-'));
  try {
    const base = join(dir, 'public');
    await mkdir(base);
    await writeFile(join(base, 'good.txt'), 'ok');
    await writeFile(join(dir, 'outside.txt'), 'private');
    await symlink(join(dir, 'outside.txt'), join(base, 'link.txt'));
    // macOS /var and /tmp aliases resolve under /private; compare canonical paths.
    assert.equal(await resolvePublicPath({ harness: base }, '/harness/good.txt'), await realpath(join(base, 'good.txt')));
    await assert.rejects(resolvePublicPath({ harness: base }, '/harness/%2e%2e%2foutside.txt'), { status: 403 });
    await assert.rejects(resolvePublicPath({ harness: base }, '/harness/link.txt'), { status: 403 });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('result save rejects foreign origins, bad JSON, and untrusted hosts; valid save succeeds', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'resume-server-test-'));
  const destination = join(dir, 'results.json');
  const handler = requestHandler({ roots: { harness: dir }, resultsFile: destination });
  async function request(headers = {}, body = JSON.stringify({ schemaVersion: 2, complete: true, cases: [] })) {
    const req = Object.assign(Readable.from([body]), { method: 'POST', url: '/results',
      headers: { host: '127.0.0.1:1234', origin: 'http://127.0.0.1:1234', 'content-type': 'application/json', ...headers } });
    const response = { writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
    await handler(req, response);
    return response;
  }
  try {
    assert.equal((await request({ origin: 'https://example.com' })).status, 403);
    assert.equal((await request({ host: 'evil.example:1234' })).status, 403);
    assert.equal((await request({ 'content-type': 'text/plain' })).status, 415);
    assert.equal((await request({}, '{')).status, 400);
    assert.equal((await request({}, '{}')).status, 400);
    assert.equal((await request()).status, 200);
    assert.equal(JSON.parse(await readFile(destination, 'utf8')).complete, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
