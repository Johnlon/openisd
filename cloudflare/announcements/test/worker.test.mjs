import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import worker, {ANNOUNCEMENTS} from '../src/index.js';

const env = {ALLOWED_ORIGINS: 'https://openisd.app,https://test.openisd.app'};
const cacheHeaders = ['Cache-Control', 'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control'];

for (const path of ['/announcements', '/', '/refresh?site=test', '/missing']) {
  test(`${path} response is never cached`, async () => {
    const response = await worker.fetch(new Request(`https://example.workers.dev${path}`), env);
    for (const header of cacheHeaders) assert.equal(response.headers.get(header), header === 'Cache-Control' ? 'no-store, no-cache, max-age=0, must-revalidate' : 'no-store');
    assert.equal(response.headers.get('Pragma'), 'no-cache');
    assert.equal(response.headers.get('Expires'), '0');
  });
}

test('feed preserves versioned announcement records and allows only configured app origins', async () => {
  const request = new Request('https://example.workers.dev/announcements', {headers: {Origin: 'https://test.openisd.app'}});
  const response = await worker.fetch(request, env);
  const payload = await response.json();
  assert.equal(payload.version, 1);
  assert.deepEqual(payload.announcements, ANNOUNCEMENTS);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://test.openisd.app');
  const rejected = await worker.fetch(new Request(request.url, {headers: {Origin: 'https://attacker.example'}}), env);
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null);
});

test('production feed allows archived snapshots to fetch the announcement archive', async () => {
  const config = await readFile(new URL('../wrangler.production.toml', import.meta.url), 'utf8');
  const match = config.match(/^ALLOWED_ORIGINS\s*=\s*"([^"]*)"/m);
  assert.ok(match, 'production ALLOWED_ORIGINS must be configured');
  const origins = match[1].split(',').map(origin => origin.trim());
  assert.ok(origins.includes('https://openisd.app'));
  assert.ok(origins.includes('https://snapshots.openisd.app'));

  const productionEnv = {ALLOWED_ORIGINS: match[1]};
  const request = new Request('https://example.workers.dev/announcements', {
    headers: {Origin: 'https://snapshots.openisd.app'},
  });
  const response = await worker.fetch(request, productionEnv);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://snapshots.openisd.app');
});

test('refresh links point to the worker-bypassing about recovery path', async () => {
  const testResponse = await worker.fetch(new Request('https://example.workers.dev/refresh?site=test'), env);
  assert.equal(testResponse.status, 302);
  assert.equal(testResponse.headers.get('Location'), 'https://test.openisd.app/about/refresh/');
  const liveResponse = await worker.fetch(new Request('https://example.workers.dev/refresh'), env);
  assert.equal(liveResponse.headers.get('Location'), 'https://openisd.app/about/refresh/');
});

test('the review page exposes the short refresh link for its own app host', async () => {
  const testPage = await worker.fetch(new Request('https://test-worker.example/?site=test'), env);
  const testHtml = await testPage.text();
  assert.match(testHtml, /href="https:\/\/test-worker\.example\/refresh\?site=test">Update OpenISD on this device/);

  const productionPage = await worker.fetch(new Request('https://production-worker.example/'), env);
  const productionHtml = await productionPage.text();
  assert.match(productionHtml, /href="https:\/\/production-worker\.example\/refresh">Update OpenISD on this device/);
});
