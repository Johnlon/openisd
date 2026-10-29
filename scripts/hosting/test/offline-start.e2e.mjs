// End-to-end proof that an installed build starts with no network from any of its own addresses,
// whatever the query (BUG_20261029_app-fails-to-start-offline), while a hosted copy under the root
// worker's scope (test/) is never answered with the root build's page
// (BUG_20261018_test-build-hangs-on-loading-screen). One real production build, served at / and at
// /test/; a real service worker; real Chromium, taken offline with context.setOffline.
// Usage: node scripts/hosting/test/offline-start.e2e.mjs   (about a minute, most of it the build)
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const {chromium} = createRequire(path.join(root, 'package.json'))('playwright');
const started = Date.now();
const seconds = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-start-e2e-'));
const site = path.join(scratch, 'site');

console.log(`[${seconds()}] building`);
execFileSync('node_modules/.bin/vite', ['build', '--outDir', site, '--emptyOutDir'], {
  cwd: root, stdio: ['ignore', 'ignore', 'inherit'],
  env: {...process.env, OPENISD_RELATIVE_BASE: '1', OPENISD_BUILD_VERSION: 'v-e2e-offline'},
});

const types = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
// The same build at / and at /test/, as the site hosts its test copy under the root.
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let rel = p.startsWith('/test/') ? p.slice('/test/'.length) : p.slice(1);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const f = path.join(site, rel);
  if (!f.startsWith(site + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'content-type': types[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'max-age=600'});
  res.end(fs.readFileSync(f));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (ok, what) => { console.log(`[${seconds()}] ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };
// Started: the app has drawn and the loading screen is gone.
const isStarted = page => page.evaluate(() => {
  const overlay = document.getElementById('loading-overlay');
  const covering = overlay !== null && getComputedStyle(overlay).display !== 'none' && overlay.isConnected;
  return (document.getElementById('app')?.children.length ?? 0) > 0 && !covering;
});
async function untilStarted(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await isStarted(page)) return true; } catch { /* mid-navigation */ }
    await page.waitForTimeout(250);
  }
  return false;
}
// Opens an address offline in a fresh tab, so one address's error page cannot affect the next.
// The browser's own offline page is a failed navigation.
let context;
let page;
async function openOffline(address) {
  await page?.close();
  page = await context.newPage();
  try {
    await page.goto(`${origin}${address}`);
    return true;
  } catch (e) {
    console.log(`[${seconds()}] info ${address}: ${String(e.message).split('\n')[0]}`);
    return false;
  }
}
const titleOf = rel => fs.readFileSync(path.join(site, rel), 'utf8').match(/<title>([^<]*)<\/title>/)?.[1];

const browser = await chromium.launch();
try {
  context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  page = await context.newPage();
  await page.goto(`${origin}/`);
  check(await untilStarted(page, 20000), 'the build starts online at /');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await untilStarted(page, 20000);
  const controller = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? 'none');
  check(controller === `${origin}/sw.js`, `the root worker controls the page (${controller})`);

  await context.setOffline(true);
  for (const address of ['/', '/?x=1', '/?pwa=1', '/index.html?x=1']) {
    const opened = await openOffline(address);
    check(opened && await untilStarted(page, 20000), `offline, ${address} starts the app`);
  }
  for (const [address, file] of [['/about/', 'about/index.html'], ['/about/?y=2', 'about/index.html'], ['/install/?z=3', 'install/index.html']]) {
    const opened = await openOffline(address);
    const title = opened ? await page.title() : undefined;
    check(opened && title === titleOf(file), `offline, ${address} shows its own page (${title})`);
  }
  // The hosted copy is not the root build: offline, the root worker must not answer it.
  for (const address of ['/test/', '/test/?x=1']) {
    check(!await openOffline(address), `offline, ${address} is not answered with the root build's page`);
  }
  await context.close();
} finally {
  await browser.close();
  server.close();
  fs.rmSync(scratch, {recursive: true, force: true});
}
console.log(`[${seconds()}] ${failures.length === 0 ? 'all passed' : `${failures.length} failed`}`);
process.exit(failures.length === 0 ? 0 : 1);
