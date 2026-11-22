// End-to-end proof that the hosted copies start in a browser that already runs another copy (T396).
// One real production build of this tree (new) and the live root build of https://openisd.app/ (prev,
// fetched file for file as it asks for them) are served from one local address. Real service workers,
// real Chromium.
//   1. prev at /prev/ holds this browser's data; new at /new/ starts and the data is still there;
//   2. new at / with its worker in control; new at /test/ starts (the root worker must not answer
//      /test/ with the root build's page: BUG_20261018_test-build-hangs-on-loading-screen);
//   3. for information only: prev at / in control, new at /test/. Builds released before the fix
//      answer /test/ with their own page, so this hangs until a fixed build is the root release.
//   4. prev at / in control, then / swapped to new (a release): every open starts, and a tab opened
//      again runs new (T397).
// Usage: node scripts/hosting/test/hosted-copies.e2e.mjs   (about 2 minutes, most of it the build)
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hosted-copies-e2e-'));
const PROD = 'https://openisd.app/';

console.log(`[${seconds()}] building new`);
const newDir = path.join(scratch, 'new');
execFileSync('node_modules/.bin/vite', ['build', '--outDir', newDir, '--emptyOutDir'], {
  cwd: root, stdio: ['ignore', 'ignore', 'inherit'],
  env: {...process.env, OPENISD_RELATIVE_BASE: '1', OPENISD_BUILD_VERSION: 'v-e2e-new'},
});
// prev: the live root build. A file is fetched from the site the first time it is asked for, then kept.
const prevDir = path.join(scratch, 'prev');
fs.mkdirSync(prevDir);

const types = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
async function fileOf(dir, rel) {
  const f = path.join(dir, rel);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  if (dir !== prevDir) return undefined;
  const res = await fetch(new URL(rel, PROD));
  if (!res.ok) return undefined;
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  return f;
}
// mounts: address prefix -> build folder, longest prefix first. Set per case.
let mounts = [];
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const mount = mounts.find(([prefix]) => p.startsWith(prefix));
  let rel = mount === undefined ? undefined : p.slice(mount[0].length);
  if (rel !== undefined && (rel === '' || rel.endsWith('/'))) rel += 'index.html';
  const f = rel === undefined ? undefined : await fileOf(mount[1], rel);
  if (f === undefined) { res.writeHead(404); res.end(); return; }
  // The hosting's own caching: ten minutes, as GitHub Pages.
  res.writeHead(200, {'content-type': types[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'max-age=600'});
  res.end(fs.readFileSync(f));
}).listen(0);
const origin = `http://localhost:${server.address().port}`;

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
// Opens address twice, so the copy's worker installs and then controls the page.
async function openControlled(context, address) {
  const page = await context.newPage();
  await page.goto(`${origin}${address}`);
  await untilStarted(page, 20000);
  await page.waitForTimeout(3000);
  await page.reload();
  const ok = await untilStarted(page, 20000);
  const controlled = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? 'none');
  return {page, ok, controlled};
}
const storedKeys = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('openisd_')).sort());

const browser = await chromium.launch();

// 1. Data stored by the live build is there for the new one.
{
  mounts = [['/prev/', prevDir], ['/new/', newDir]];
  const context = await browser.newContext();
  const prev = await openControlled(context, '/prev/');
  check(prev.ok, `the live build starts at /prev/ (worker ${prev.controlled})`);
  const keys = await storedKeys(prev.page);
  check(keys.length > 0, `the live build stored its data (${keys.length} keys)`);
  const page = await context.newPage();
  await page.goto(`${origin}/new/`);
  check(await untilStarted(page, 20000), 'the new build starts at /new/ in the same browser');
  const after = await storedKeys(page);
  check(keys.every(k => after.includes(k)), 'every key the live build stored is still there');
  await context.close();
}

// 2. A copy under the root build's scope starts.
{
  mounts = [['/test/', newDir], ['/', newDir]];
  const context = await browser.newContext();
  const rootCopy = await openControlled(context, '/');
  check(rootCopy.ok && rootCopy.controlled === `${origin}/sw.js`, `the new build starts at / under its own worker (${rootCopy.controlled})`);
  const page = await context.newPage();
  await page.goto(`${origin}/test/`);
  check(await untilStarted(page, 20000), 'the new build at /test/ starts while the root worker is in control');
  await context.close();
}

// 3. Information only: the live root build in control, the new build at /test/.
{
  mounts = [['/test/', newDir], ['/', prevDir]];
  const context = await browser.newContext();
  const rootCopy = await openControlled(context, '/');
  const page = await context.newPage();
  await page.goto(`${origin}/test/`);
  const ok = await untilStarted(page, 20000);
  console.log(`[${seconds()}] info the live root build (${rootCopy.controlled}) in control: /test/ ${ok ? 'starts' : 'stays on the loading screen; fixed once a build with T396 is the root release'}`);
  await context.close();
}

// 4. Upgrade: the live root build's worker in control at /, then the site swaps / to the new build, as a
// release does. Every open starts the app; once the tab is closed and opened again it runs the new build.
// Reloads may keep the old build while the new worker waits: builds before T243 do not take over an open
// tab (info only; app-update.e2e.mjs covers the takeover for builds since).
{
  mounts = [['/', prevDir]];
  const context = await browser.newContext();
  const rootCopy = await openControlled(context, '/');
  check(rootCopy.ok && rootCopy.controlled === `${origin}/sw.js`, `the live build starts at / under its own worker (${rootCopy.controlled})`);
  mounts = [['/', newDir]];
  const newBundle = fs.readFileSync(path.join(newDir, 'index.html'), 'utf8').match(/\/(main-[^"/]+\.js)/)?.[1];
  const bundleOf = page => page.evaluate(() => [...document.scripts].map(s => s.src).find(s => s.includes('/main-'))?.split('/').pop()).catch(() => undefined);
  const page = rootCopy.page;
  let allStarted = true;
  for (let open = 1; open <= 2; open += 1) {
    await page.reload();
    const started = await untilStarted(page, 20000);
    allStarted &&= started;
    await page.waitForTimeout(3000);
    console.log(`[${seconds()}] info reload ${open}: ${started ? 'started' : 'stuck on the loading screen'}, ${await bundleOf(page) === newBundle ? 'new build' : 'old build'}`);
  }
  check(allStarted, 'every reload after the swap starts the app');
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(`${origin}/`);
  check(await untilStarted(reopened, 20000), 'the tab closed and opened again starts the app');
  check(await bundleOf(reopened) === newBundle, `the tab opened again runs the new build (${newBundle})`);
  await context.close();
}

await browser.close();
server.close();
fs.rmSync(scratch, {recursive: true, force: true});
console.log(`[${seconds()}] ${failures.length === 0 ? 'all passed' : `${failures.length} failed`}`);
process.exit(failures.length === 0 ? 0 : 1);
