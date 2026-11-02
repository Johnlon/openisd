// End-to-end proof (QO380, "my app must work offline") that an installed worker holds the whole
// bundled catalogue: online once, then offline, reload, New project > passive radiator > pick
// E150HE-PR fills every box. Second scenario, release critical: a persistent profile with the
// PREVIOUS build's worker (the config before the catalogue precache) is upgraded to this build; the page stays
// usable while the new worker installs and the catalogue precache completes. Prints install time
// and bytes on the wire (gzipped, as the host serves them).
// Usage: node scripts/hosting/test/offline-catalogue.e2e.mjs        (~1 min, most of it two builds)
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const {chromium} = createRequire(path.join(root, 'package.json'))('playwright');
const started = Date.now();
const seconds = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-catalogue-e2e-'));

function build(outName, configArg, version) {
  const out = path.join(scratch, outName);
  execFileSync('node_modules/.bin/vite', ['build', ...configArg, '--mode', 'production', '--outDir', out, '--emptyOutDir'], {
    cwd: root, stdio: ['ignore', 'ignore', 'inherit'],
    env: {...process.env, OPENISD_RELATIVE_BASE: '1', OPENISD_BUILD_VERSION: version},
  });
  return out;
}
console.log(`[${seconds()}] building this build`);
const newSite = build('new', [], 'v-e2e-new');
// The previous build: the config of the last commit before the catalogue was precached (T646's
// parent), so the upgrade under test is "no catalogue precache" to "whole catalogue precached";
// origin/main's config precaches too, and its entry count equals this build's, so the wait for the
// new precache would end at once. Run from a scratch copy beside the real one so its
// relative paths resolve; removed straight after.
console.log(`[${seconds()}] building the previous build (config before the catalogue precache)`);
const prevConfig = path.join(root, 'vite.config.prev-e2e.js');
fs.writeFileSync(prevConfig, execFileSync('git', ['show', '361916d1c^:vite.config.js'], {cwd: root, encoding: 'utf8'}));
let oldSite;
try { oldSite = build('old', ['--config', prevConfig], 'v-e2e-old'); } finally { fs.rmSync(prevConfig, {force: true}); }

const types = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
let served = newSite;
let wireBytes = 0;
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let rel = p.slice(1);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const f = path.join(served, rel);
  if (!f.startsWith(served + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(f);
  const compress = ['.js', '.json', '.html', '.css', '.svg'].includes(ext);
  const body = compress ? zlib.gzipSync(fs.readFileSync(f)) : fs.readFileSync(f);
  wireBytes += body.length;
  res.writeHead(200, {'content-type': types[ext] ?? 'application/octet-stream', 'cache-control': 'no-cache', ...(compress ? {'content-encoding': 'gzip'} : {})});
  res.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (ok, what) => { console.log(`[${seconds()}] ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };
// Distinct entries: the manifest lists icon.svg twice, the cache holds it once.
const manifestCount = site => new Set([...fs.readFileSync(path.join(site, 'sw.js'), 'utf8').matchAll(/"?url"?:\s*"([^"]+)"/g)].map(m => m[1])).size;
const started_ = page => page.evaluate(() => {
  const overlay = document.getElementById('loading-overlay');
  const covering = overlay !== null && getComputedStyle(overlay).display !== 'none' && overlay.isConnected;
  return (document.getElementById('app')?.children.length ?? 0) > 0 && !covering;
});
async function untilStarted(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await started_(page)) return true; } catch { /* mid-navigation */ }
    await page.waitForTimeout(250);
  }
  return false;
}
// Entries in the worker's precache holding the catalogue index: the precache of this build is complete.
const catalogueCached = page => page.evaluate(async () => {
  for (const name of await caches.keys()) {
    if (!name.includes('precache')) continue;
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.some(r => r.url.includes('catalogue.json'))) return keys.length;
  }
  return 0;
});
async function untilPrecached(page, expected, ms) {
  const end = Date.now() + ms;
  let n = 0;
  while (Date.now() < end) {
    try { n = await catalogueCached(page); } catch { /* the app reloads onto the new worker */ }
    if (n >= expected) return n;
    await page.waitForTimeout(500);
  }
  return n;
}

// Offline, on the phone skin: New project > a bundled driver > passive radiator > pick E150HE-PR;
// every box fills.
async function pickRadiatorOffline(page, label) {
  await page.reload();
  check(await untilStarted(page, 30000), `${label}: offline reload starts the app`);
  // A first visit raises the splash: a user closes it with Start designing.
  const start = page.getByRole('button', {name: 'Start designing'});
  if (await start.isVisible()) await start.click();
  // The storage-permission notice (Chrome grants no persistent storage to a fresh profile): a user answers it.
  const confirm = page.locator('.confirm-overlay');
  if (await confirm.isVisible()) {
    const buttons = await confirm.locator('button').allInnerTexts();
    console.log(`[${seconds()}] info ${label}: dialog "${(await confirm.innerText()).slice(0, 80).replace(/\s+/g, ' ')}" buttons ${JSON.stringify(buttons)}`);
    await confirm.locator('button').first().click();
  }
  await page.getByText('New project').first().click();
  const body = page.locator('.mob-np-body');
  const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
  await body.getByText('Accuton AS168-9-470').first().click();
  await next.click();
  await next.click();
  await page.locator('#np-box-type').selectOption('box-passive-radiator');
  await next.click();
  const modal = page.locator('.mob-np-body');
  await modal.locator('#np-pr-select').click();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'E150HE-PR'}).first().click();
  const filled = [];
  for (const id of ['#np-pr-vas', '#np-pr-qms', '#np-pr-fs', '#np-pr-sd', '#np-pr-xmax']) {
    // The boxes fill a moment after the pick: wait for each, as a user would.
    let value = '';
    for (let i = 0; i < 20 && value === ''; i++) { value = await modal.locator(id).inputValue(); if (value === '') await page.waitForTimeout(250); }
    filled.push(`${id}=${value}`);
    check(value !== '' && Number.isFinite(parseFloat(value)), `${label}: offline pick fills ${id} (${value})`);
  }
}

const browser = await chromium.launch(); // only to share the executable path; each scenario has its own persistent profile
const exe = chromium.executablePath();
await browser.close();
const phone = {viewport: {width: 374, height: 705}, deviceScaleFactor: 2.566, isMobile: true, hasTouch: true, executablePath: exe};
const newCount = manifestCount(newSite);
const oldCount = manifestCount(oldSite);
console.log(`[${seconds()}] precache entries: previous build ${oldCount}, this build ${newCount}`);
check(fs.readFileSync(path.join(newSite, 'sw.js'), 'utf8').includes('catalogue.json') && !fs.readFileSync(path.join(oldSite, 'sw.js'), 'utf8').includes('catalogue.json'), 'this build precaches the catalogue file; the previous one did not');
console.log(`[${seconds()}] catalogue.json: ${fs.statSync(path.join(newSite, 'catalogue.json')).size} bytes raw, ${zlib.gzipSync(fs.readFileSync(path.join(newSite, 'catalogue.json'))).length} gzipped`);

// Scenario A: fresh install of this build, then offline.
{
  served = newSite;
  const ctx = await chromium.launchPersistentContext(path.join(scratch, 'profile-a'), phone);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  wireBytes = 0;
  const t0 = Date.now();
  await page.goto(`${origin}/`);
  check(await untilStarted(page, 60000), 'A: the app starts online');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const n = await untilPrecached(page, newCount, 300000);
  const installSeconds = (Date.now() - t0) / 1000;
  check(n >= newCount, `A: catalogue precache complete (${n}/${newCount} entries)`);
  console.log(`[${seconds()}] A: fresh install ${installSeconds.toFixed(1)}s, ${(wireBytes / 1048576).toFixed(2)} MiB on the wire`);
  await page.reload();
  await untilStarted(page, 30000);
  check((await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? 'none')) === `${origin}/sw.js`, 'A: the worker controls the page');
  await ctx.setOffline(true);
  await pickRadiatorOffline(page, 'A');
  await ctx.close();
}

// Scenario B: the previous build's worker is replaced by this build's, page usable meanwhile.
{
  served = oldSite;
  const ctx = await chromium.launchPersistentContext(path.join(scratch, 'profile-b'), phone);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto(`${origin}/`);
  check(await untilStarted(page, 60000), 'B: the previous build starts online');
  // The app may reload itself onto the new worker; wait until a worker controls a started page.
  for (let i = 0; i < 60; i++) {
    try { if (await started_(page) && await page.evaluate(() => navigator.serviceWorker.controller !== null)) break; } catch { /* mid-reload */ }
    await page.waitForTimeout(500);
  }
  check(await catalogueCached(page) === 0, 'B: the previous worker holds no catalogue precache');
  served = newSite;
  wireBytes = 0;
  const t0 = Date.now();
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
  // Meanwhile the page must stay usable: poll it until the new precache completes.
  let usableThroughout = true;
  let n = 0;
  const end = Date.now() + 300000;
  while (Date.now() < end && n < newCount) {
    try {
      if (!await started_(page)) usableThroughout = false;
      n = await catalogueCached(page);
    } catch { /* navigation to the new build's page: the app reloads when clean */ await page.waitForTimeout(500); }
    await page.waitForTimeout(500);
  }
  const upgradeSeconds = (Date.now() - t0) / 1000;
  check(usableThroughout, 'B: the app stayed usable while the new worker installed');
  check(n >= newCount, `B: new worker's catalogue precache complete (${n}/${newCount})`);
  console.log(`[${seconds()}] B: upgrade ${upgradeSeconds.toFixed(1)}s, ${(wireBytes / 1048576).toFixed(2)} MiB on the wire`);
  await ctx.setOffline(true);
  await pickRadiatorOffline(page, 'B');
  await ctx.close();
}

server.close();
fs.rmSync(scratch, {recursive: true, force: true});
console.log(`[${seconds()}] ${failures.length === 0 ? 'all passed' : `${failures.length} failed`}`);
process.exit(failures.length === 0 ? 0 : 1);
