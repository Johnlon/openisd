// A previously installed catch-all service worker must let the recovery URL escape its cached shell.
// The page clears only this origin's app caches, preserves browser project data, then opens the build.
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const {chromium} = createRequire(path.join(root, 'package.json'))('playwright');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-refresh-e2e-'));
const site = path.join(scratch, 'site');
execFileSync('node_modules/.bin/vite', ['build', '--outDir', site, '--emptyOutDir'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: {...process.env, OPENISD_RELATIVE_BASE: '1', OPENISD_BUILD_VERSION: 'v-e2e-refresh'},
});

const legacyHtml = '<!doctype html><title>Old OpenISD</title><h1 id="old-app">Old OpenISD</h1>';
let latest = false;
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!latest && url.pathname === '/sw.js') {
    const cache = 'legacy-shell-' + server.address().port + '/';
    const worker = 'const CACHE = ' + JSON.stringify(cache) + ';\n'
      + 'const PAGE = ' + JSON.stringify(legacyHtml) + ';\n'
      + 'self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(c => c.put(new Request(self.location.origin + "/"), new Response(PAGE, {headers:{"Content-Type":"text/html"}})))));\n'
      + 'self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));\n'
      + 'self.addEventListener("fetch", event => { const u = new URL(event.request.url); const bypass = ["/about/", "/install/", "/v/", "/snap/"].some(prefix => u.pathname.startsWith(prefix)); if (event.request.mode === "navigate" && !bypass) event.respondWith(caches.match(new Request(self.location.origin + "/")).then(r => r || fetch(event.request))); });';
    res.writeHead(200, {'content-type': 'text/javascript', 'cache-control': 'max-age=600'});
    res.end(worker);
    return;
  }
  if (!latest && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = legacyHtml + '<script>navigator.serviceWorker.register("/sw.js")</script>';
    res.writeHead(200, {'content-type': 'text/html', 'cache-control': 'max-age=600'});
    res.end(html);
    return;
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1) + (url.pathname.endsWith('/') ? 'index.html' : '');
  const file = path.join(site, rel);
  if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, {'content-type': mime[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'max-age=600'});
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const mainBundle = fs.readFileSync(path.join(site, 'index.html'), 'utf8').match(/assets\/(main-[^"']+\.js)/)?.[1];
if (!mainBundle) throw new Error('The latest build main bundle was not found in index.html');

const browser = await chromium.launch({headless: true});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(origin, {waitUntil: 'load'});
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({waitUntil: 'load'});
  if (!await page.locator('#old-app').isVisible()) throw new Error('Legacy service worker did not serve its cached app shell');

  await page.evaluate(async () => {
    localStorage.setItem('openisd_project_marker', 'kept');
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('openisd-refresh-preservation', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('marker');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction('marker', 'readwrite');
        tx.objectStore('marker').put('kept', 'project');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      };
    });
  });

  latest = true;
  await page.goto(origin + '/about/refresh/', {waitUntil: 'load'});
  await page.waitForURL(url => url.pathname === '/' && url.searchParams.has('_openisd_refresh'), {timeout: 20000});
  await page.waitForSelector('#app', {timeout: 20000});
  await page.waitForFunction(bundle => [...document.scripts].some(script => script.src.endsWith(bundle)), mainBundle, {timeout: 20000});

  const preserved = await page.evaluate(async () => {
    const request = indexedDB.open('openisd-refresh-preservation', 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('marker', 'readonly');
    const value = await new Promise((resolve, reject) => {
      const get = tx.objectStore('marker').get('project');
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    const cachesLeft = await caches.keys();
    return {local: localStorage.getItem('openisd_project_marker'), indexedDb: value, cachesLeft};
  });
  if (preserved.local !== 'kept' || preserved.indexedDb !== 'kept') throw new Error('Project data was not preserved: ' + JSON.stringify(preserved));
  if (preserved.cachesLeft.some(name => name.startsWith('legacy-shell-'))) throw new Error('Legacy app cache remains: ' + preserved.cachesLeft.join(', '));
  if (pageErrors.length > 0) throw new Error('Page errors: ' + pageErrors.join('; '));

  console.log('ok legacy recovery URL reaches the latest build, clears the old app cache, and preserves browser project storage');
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(scratch, {recursive: true, force: true});
}
