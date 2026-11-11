import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { requestHandler } from './server.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const resultsFile = resolve(root, process.env.RESULTS_FILE || 'results-fresh.json');
const roots = { harness: root, repo: resolve(root, '../..'),
  models: resolve(process.env.MODELS_DIR || resolve(root, 'models')), deps: resolve(root, 'node_modules') };
const server = createServer(requestHandler({ roots, resultsFile }));
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const url = `http://127.0.0.1:${server.address().port}`;
if (process.argv.includes('--serve')) {
  console.log(url);
  await new Promise(resolve => {
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(resolve));
  });
} else {
  let browser;
  try {
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true });
    const page = await browser.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
    page.on('console', m => console.log('browser:', m.text()));
    page.on('pageerror', e => console.error('pageerror:', e));
    await page.goto(url);
    await page.waitForFunction(() => window.harnessReady, undefined, { timeout: 30000 });
    const results = await page.evaluate(() => window.runBenchmark());
    results.browserVersion = browser.version();
    await writeFile(resultsFile, JSON.stringify(results, null, 2) + '\n');
    if (!results.complete) throw new Error('Benchmark incomplete; partial results saved for diagnosis');
    console.log(`Complete. Results saved to ${resultsFile}`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
