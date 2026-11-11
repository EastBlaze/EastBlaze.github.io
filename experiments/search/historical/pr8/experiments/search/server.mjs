import { readFile, writeFile, realpath, rename } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };
const failure = (status, message) => Object.assign(new Error(message), { status });

export async function readBody(req, limit = 3_000_000) {
  const parts = [];
  let size = 0;
  for await (const part of req) {
    const chunk = Buffer.from(part);
    size += chunk.length;
    if (size > limit) throw failure(413, 'Result too large');
    parts.push(chunk);
  }
  return Buffer.concat(parts).toString('utf8');
}

export async function resolvePublicPath(roots, pathname) {
  const [, key, ...parts] = pathname.split('/');
  if (!roots[key]) throw failure(404, 'Unknown route');
  let decoded;
  try { decoded = parts.map(decodeURIComponent); }
  catch { throw failure(400, 'Invalid URL encoding'); }
  const base = await realpath(roots[key]);
  const path = resolve(base, ...decoded);
  if (!path.startsWith(base + sep)) throw failure(403, 'Path traversal');
  const actual = await realpath(path);
  if (!actual.startsWith(base + sep)) throw failure(403, 'Symlink escapes route');
  return actual;
}

export function requestHandler({ roots, resultsFile }) {
  return async (req, res) => {
    try {
      // Binding to loopback is not enough: reject DNS rebinding and cross-site writes.
      const host = req.headers.host;
      if (!/^127\.0\.0\.1:\d+$/.test(host || '')) throw failure(403, 'Unexpected host');
      const origin = `http://${host}`;
      const pathname = new URL(req.url, origin).pathname;
      if (req.method === 'POST' && pathname === '/results') {
        if (req.headers.origin !== origin) throw failure(403, 'Same-origin request required');
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw failure(415, 'JSON required');
        const body = await readBody(req);
        let data;
        try { data = JSON.parse(body); } catch { throw failure(400, 'Invalid JSON'); }
        if (data?.schemaVersion !== 2 || typeof data.complete !== 'boolean' || !Array.isArray(data.cases)) {
          throw failure(400, 'Invalid result format');
        }
        const temporary = resultsFile + '.' + randomUUID() + '.tmp';
        await writeFile(temporary, body + '\n');
        await rename(temporary, resultsFile);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('saved');
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw failure(405, 'Method not allowed');
      if (pathname === '/') {
        res.writeHead(302, { Location: '/harness/index.html' }); res.end(); return;
      }
      const path = await resolvePublicPath(roots, pathname);
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500);
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(status === 500 ? 'Internal server error' : error.message);
    }
  };
}
