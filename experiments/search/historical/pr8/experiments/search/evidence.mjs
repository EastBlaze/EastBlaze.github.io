// Bind measurements to the exact implementation, fixtures, corpus, and dependency lock.
export const INPUT_FILES = [
  '/repo/index.js', '/repo/projects.json', '/harness/cases.json', '/harness/baseline.mjs',
  '/harness/core.mjs', '/harness/encoders.mjs', '/harness/evidence.mjs',
  '/harness/benchmark.js', '/harness/run-node.mjs', '/harness/run.mjs', '/harness/server.mjs',
  '/harness/model-manifest.json', '/harness/package-lock.json',
];

export async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
}

export async function fingerprint(readBytes) {
  const hashes = {};
  for (const file of INPUT_FILES) hashes[file] = await sha256(await readBytes(file));
  return hashes;
}

export function verifiedReader(read, manifest) {
  const verifiedModelSha256 = {};
  const files = new Map(manifest.files.map(f => ['/models/' + f.local_path, f]));
  const readBytes = async path => {
    const bytes = await read(path);
    if (path.startsWith('/models/')) {
      const entry = files.get(path);
      const hash = await sha256(bytes);
      if (!entry || entry.bytes !== bytes.byteLength || entry.sha256 !== hash) throw new Error(`Model integrity mismatch: ${path}`);
      verifiedModelSha256[path] = hash;
    }
    return bytes;
  };
  return { readBytes, readJson: async path => JSON.parse(new TextDecoder().decode(await readBytes(path))), verifiedModelSha256 };
}
