import { PreTrainedTokenizer, env } from '/deps/@huggingface/transformers/dist/transformers.web.js';
import * as ort from '/deps/onnxruntime-web/dist/ort.wasm.min.mjs';
import { runBenchmark } from './core.mjs';
import { createEncoders } from './encoders.mjs';
import { fingerprint, verifiedReader } from './evidence.mjs';

env.allowRemoteModels = false;
ort.env.wasm.wasmPaths = '/deps/onnxruntime-web/dist/';
ort.env.wasm.numThreads = 1;
const status = text => { document.querySelector('#status').textContent = text; console.log(text); };
const fetchBytes = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.arrayBuffer();
};
let running = false;
window.runBenchmark = async () => {
  if (running) throw new Error('Benchmark already running');
  running = true;
  try {
    performance.clearResourceTimings();
    const manifest = JSON.parse(new TextDecoder().decode(await fetchBytes('/harness/model-manifest.json')));
    const reader = verifiedReader(fetchBytes, manifest);
    const inputSha256 = await fingerprint(fetchBytes);
    const results = await runBenchmark({
      projects: (await reader.readJson('/repo/projects.json')).projects,
      cases: await reader.readJson('/harness/cases.json'),
      source: new TextDecoder().decode(await fetchBytes('/repo/index.js')),
      encoders: createEncoders({ PreTrainedTokenizer, ort, ...reader }), status,
      environment: { execution: 'Browser WASM', userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency, wasmThreads: 1, webgpu: !!navigator.gpu },
    });
    results.inputSha256 = inputSha256;
    results.verifiedModelSha256 = reader.verifiedModelSha256;
    results.recordedAt = new Date().toISOString();
    // Module loads precede this window. These entries are not total startup transfer.
    results.resourceScope = 'During benchmark only; excludes initial JS imports; no-store server';
    results.resources = performance.getEntriesByType('resource').map(r => ({
      name: new URL(r.name).pathname, transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize, durationMs: r.duration,
    }));
    window.benchmarkResults = results;
    return results;
  } finally { running = false; }
};
window.harnessReady = true;
document.querySelector('#run').addEventListener('click', async () => {
  const button = document.querySelector('#run');
  button.disabled = true;
  try {
    const result = await window.runBenchmark();
    const saved = await fetch('/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result, null, 2) });
    if (!saved.ok) throw new Error(`Results were not saved: HTTP ${saved.status}`);
    status(result.complete ? 'Complete. Results saved.' : 'Failed. Partial results saved for diagnosis.');
  } catch (error) { status(String(error)); }
  finally { button.disabled = false; }
});
