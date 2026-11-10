import { baseline } from './baseline.mjs';

export const METHODS = ['static64', 'e5tiny'];
export const POSITIVE_GROUPS = ['explicit', 'paraphrase', 'job-like', 'long'];

export function expandCases(cases) {
  return cases.map(c => {
    if (typeof c.query !== 'string' || !Number.isInteger(c.repetitions ?? 0) ||
        (c.repetitions ?? 0) < 0 || (c.repetitions ?? 0) > 1000) {
      throw new Error(`Invalid query fixture: ${c.id}`);
    }
    return { ...c, query: c.query + (c.repeat || '').repeat(c.repetitions || 0) + (c.suffix || '') };
  });
}

// Retrieval documents contain public content only, never judgments or query fixtures.
export function documentText(p) {
  return [p.title, p.subtitle, ...p.tags, ...p.evidence.map(e => e.text), ...p.technologies].join('\n');
}

export function normalize(vector) {
  if (!Array.from(vector).every(Number.isFinite)) throw new Error('Non-finite embedding');
  const length = Math.hypot(...vector);
  return Array.from(vector, x => length ? x / length : 0);
}

export function rankVectors(query, docs, projects) {
  if (docs.length !== projects.length || !query.length || !query.every(Number.isFinite)) {
    throw new Error('Invalid embedding dimensions or values');
  }
  return projects.map((p, i) => {
    if (docs[i].length !== query.length || !docs[i].every(Number.isFinite)) {
      throw new Error('Invalid embedding dimensions or values');
    }
    return { id: p.id, score: query.reduce((sum, x, j) => sum + x * docs[i][j], 0) };
  }).sort((a, b) => b.score - a.score); // Stable ties retain corpus order.
}

function tokenRecord(value) {
  return { tokens: value.tokens, usedTokens: value.usedTokens, truncated: value.truncated, ids: value.ids };
}

export async function runBenchmark({ projects, cases, source, encoders, environment,
  status = () => {}, now = () => performance.now() }) {
  const lexical = baseline(source);
  const results = {
    schemaVersion: 2,
    complete: true,
    methodology: {
      corpus: 'Five public resume projects; not the full resume or an independent retrieval corpus',
      queries: 'Source-derived synthetic diagnostics; development set, not a held-out benchmark',
      labelsUsedByRankers: false,
      requirementsOnly: 'Oracle probe using fixture suffix; excluded from primary retrieval metrics',
      abstentionImplemented: false,
      latency: 'Three sequential trials per case; discard first; one process/session, not independent samples',
    },
    environment, projects: projects.map(p => p.id),
    documents: projects.map(p => ({ id: p.id, text: documentText(p) })),
    cases: expandCases(cases).map(c => ({ ...c, lexical: lexical(c.query, projects) })), models: {},
  };
  for (const name of METHODS) {
    let encoder;
    try {
      status(`Loading ${name}`);
      encoder = await encoders[name]();
      const start = now();
      const documents = [];
      for (const p of results.documents) documents.push(await encoder.encode(p.text, 'passage'));
      const vectors = documents.map(d => d.vector);
      results.models[name] = {
        loadMs: encoder.loadMs, documentEncodeMs: now() - start,
        inputs: encoder.inputs, outputs: encoder.outputs, dimensions: vectors[0].length,
        documents: documents.map((d, i) => ({ id: projects[i].id, ...tokenRecord(d) })),
      };
      for (const c of results.cases) {
        status(`${name}: ${c.id}`);
        const times = [];
        let value;
        for (let trial = 0; trial < 3; trial++) {
          const start = now();
          value = await encoder.encode(c.query);
          times.push(now() - start);
        }
        c[name] = {
          ranking: rankVectors(value.vector, vectors, projects), timesMs: times,
          ...tokenRecord(value), zeroVector: value.vector.every(x => x === 0),
        };
        if (c.group === 'long') {
          // This oracle input is deliberately separate from the full-query ranking.
          const start = now();
          const tail = await encoder.encode(c.suffix.trim());
          c[name].requirementsOnly = {
            oracle: true, ranking: rankVectors(tail.vector, vectors, projects),
            timeMs: now() - start, ...tokenRecord(tail),
          };
        }
      }
    } catch (error) {
      results.complete = false;
      results.models[name] = { ...results.models[name], error: String(error) };
    } finally {
      try { await encoder?.dispose?.(); }
      catch (error) {
        results.complete = false;
        results.models[name] = { ...results.models[name], error: `Session disposal failed: ${error}` };
      }
    }
  }
  status(results.complete ? 'Complete' : 'Failed: one or more models did not complete');
  return results;
}
