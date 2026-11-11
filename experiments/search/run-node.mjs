// Same injected encoder/core as the browser; no DOM stubs or source rewriting.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PreTrainedTokenizer, env } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web/wasm';
import { createEncoders } from './encoders.mjs';
import { runBenchmark } from './core.mjs';
import { fingerprint, verifiedReader } from './evidence.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const roots = { models: resolve(process.env.MODELS_DIR || resolve(root, 'models')),
  repo: resolve(root, '../..'), harness: root };
const readBytes = async url => {
  const [, key, ...parts] = url.split('/');
  if (!roots[key]) throw new Error(`Unknown local route: ${url}`);
  const path = resolve(roots[key], ...parts);
  if (!path.startsWith(roots[key] + sep)) throw new Error('Path traversal');
  const bytes = await readFile(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};
env.allowRemoteModels = false;
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = pathToFileURL(resolve(root, 'node_modules/onnxruntime-web/dist')).href + '/';
const manifest = JSON.parse(await readFile(resolve(root, 'model-manifest.json'), 'utf8'));
const reader = verifiedReader(readBytes, manifest);
const inputSha256 = await fingerprint(readBytes);
const results = await runBenchmark({
  projects: (await reader.readJson('/repo/projects.json')).projects,
  cases: await reader.readJson('/harness/cases.json'),
  source: new TextDecoder().decode(await readBytes('/repo/index.js')),
  encoders: createEncoders({ PreTrainedTokenizer, ort, ...reader }), status: console.log,
  environment: { execution: 'Node.js WASM fallback, NOT browser', node: process.version,
    platform: process.platform, arch: process.arch, userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency, wasmThreads: 1, webgpu: false },
});
results.inputSha256 = inputSha256;
results.verifiedModelSha256 = reader.verifiedModelSha256;
results.recordedAt = new Date().toISOString();
const destination = resolve(root, process.env.RESULTS_FILE || 'results-node.json');
await writeFile(destination, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(results.models).map(([name, { documents, ...model }]) => [name, model])), null, 2));
if (!results.complete) process.exitCode = 1;
