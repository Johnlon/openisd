// End-to-end proof that a new build reaches an open app (T243). Two real production builds, A then B
// (B differs only by OPENISD_BUILD_VERSION), are served from one address by swapping which build /test/
// points at, as the real site swaps its /test/ copy. Real service worker, real Chromium.
//   1. an open app on A moves to B when it comes back into view (nothing unsaved);
//   2. Force refresh from About lands on B in one press, and the stored projects stay.
// Usage: node scripts/hosting/test/app-update.e2e.mjs   (about 2 minutes, most of it the two builds)
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'app-update-e2e-'));
const site = path.join(scratch, 'site');
fs.mkdirSync(site);

function build(name) {
  const out = path.join(scratch, name);
  console.log(`[${seconds()}] building ${name}`);
  execFileSync('node_modules/.bin/vite', ['build', '--outDir', out, '--emptyOutDir'], {
    cwd: root, stdio: ['ignore', 'ignore', 'inherit'],
    env: {...process.env, OPENISD_RELATIVE_BASE: '1', OPENISD_BUILD_VERSION: `v-e2e-${name}`},
  });
  return out;
}
const dirs = {A: build('A'), B: build('B')};
const serve = which => { fs.rmSync(path.join(site, 'test'), {force: true}); fs.symlinkSync(dirs[which], path.join(site, 'test')); };

const types = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(site, p);
  if (p.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    // The hosting's own caching: ten minutes, as GitHub Pages.
    res.writeHead(200, {'content-type': types[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'max-age=600'});
    res.end(d);
  });
}).listen(0);
const url = `http://localhost:${server.address().port}/test/`;

const failures = [];
const check = (ok, what) => { console.log(`[${seconds()}] ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };
const mainOf = page => page.evaluate(() => [...document.scripts].map(s => s.src).find(s => s.includes('/main-'))?.split('/').pop());
async function untilBundle(page, expected, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await mainOf(page) === expected) return true; } catch { /* mid-navigation */ }
    await page.waitForTimeout(250);
  }
  return false;
}
async function bundleOf(which) {
  const html = fs.readFileSync(path.join(dirs[which], 'index.html'), 'utf8');
  return html.match(/\/(main-[^"/]+\.js)/)?.[1];
}
const bundleA = await bundleOf('A');
const bundleB = await bundleOf('B');
check(bundleA !== undefined && bundleB !== undefined && bundleA !== bundleB, `the two builds have different bundles (${bundleA} / ${bundleB})`);

const browser = await chromium.launch();
async function onA(context) {
  serve('A');
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForTimeout(4000);
  await page.reload();
  await page.waitForTimeout(2000);
  check(await mainOf(page) === bundleA, 'the app runs build A, controlled by its worker');
  return page;
}

// 1. A clean open app moves to B when it comes back into view.
{
  const context = await browser.newContext();
  const page = await onA(context);
  serve('B');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  check(await untilBundle(page, bundleB, 20000), 'back in view: the open app reaches build B by itself');
  await context.close();
}

// 2. Force refresh from About lands on B in one press, and the projects stay.
{
  const context = await browser.newContext();
  const page = await onA(context);
  await page.evaluate(() => localStorage.setItem('e2e-marker', 'kept'));
  serve('B');
  const button = page.getByTestId('force-refresh');
  // The splash (About) opens by itself on a first visit.
  await button.waitFor({state: 'visible', timeout: 10000}).catch(() => undefined);
  check(await button.isVisible(), 'About shows Force refresh');
  check((await page.locator('.sp-refresh-note').innerText()) === 'Loads the newest version. Your projects stay.', 'About shows the note');
  await button.click();
  check(await untilBundle(page, bundleB, 20000), 'one press of Force refresh lands on build B');
  check(await page.evaluate(() => localStorage.getItem('e2e-marker')) === 'kept', 'local storage is untouched');
  await context.close();
}

await browser.close();
server.close();
fs.rmSync(scratch, {recursive: true, force: true});
console.log(`[${seconds()}] ${failures.length === 0 ? 'all passed' : `${failures.length} failed`}`);
process.exit(failures.length === 0 ? 0 : 1);
