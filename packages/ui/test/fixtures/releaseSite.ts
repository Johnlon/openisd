/** The address a person's browser shows for the release build. The visual baselines are taken on it, so the "Projects saved in
 *  this browser at <address>" line reads as it does for a user, never as the test server's own `http://localhost:<port>/`
 *  (bugs/BUG_20261118_visual-baselines-show-the-test-servers-address.md). */
import type {Page} from '@playwright/test';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {announcementEndpointsForHostname} from '../../src/logic/announcementCenter.js';
import {buildCatalogueBundle} from '../../../../scripts/catalogueBundle.mjs';

export const RELEASE_SITE = 'https://openisd.app/';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** Where a request under RELEASE_SITE is answered from: the test build on disk, and the small catalogue the suite runs on
 *  (what the test server's `serve-catalogue` answers `/catalogue.json` with). */
export function releaseSiteFile(port: string, requestPath: string): {kind: 'file', path: string} | {kind: 'catalogue'} | {kind: 'missing'} {
  const dist = join(ROOT, 'build', `test-dist-${port}`);
  if (requestPath === 'catalogue.json') return {kind: 'catalogue'};
  const path = normalize(join(dist, requestPath === '' ? 'index.html' : requestPath));
  if (!path.startsWith(dist) || !existsSync(path) || !statSync(path).isFile()) return {kind: 'missing'};
  return {kind: 'file', path};
}

/** Makes `https://openisd.app/...` answer from the test build on disk, and `page.goto` of a path open it there, so every page a screen opens is at the release address. A browser
 *  spec never fetches through the test runner (architecture/browser-specs-never-fetch-through-runner.test.ts): it
 *  fulfils from files. Nothing in the app is changed or told. */
export async function standInForReleaseSite(page: Page): Promise<void> {
  const port = process.env.OPENISD_TEST_PORT;
  if (!port) throw new Error('OPENISD_TEST_PORT is not set: the test build the release address stands in for is unknown');
  const dist = join(ROOT, 'build', `test-dist-${port}`);
  const bundleDir = join(ROOT, 'build', `test-bundle-${port}`);
  // At the release address the app asks the production announcements service, not the test one the fixtures stub: it answers
  // with the same empty list, so no announcement covers the screen and the suite never reaches the live service.
  await page.route(announcementEndpointsForHostname(new URL(RELEASE_SITE).hostname).feedUrl, route => route.fulfill({
    status: 200, contentType: 'application/json', headers: {'Cache-Control': 'no-store'},
    body: JSON.stringify({version: 1, announcements: []}),
  }));
  // A path a screen opens (`page.goto('/')`, which Playwright resolves against the test server) is opened at the release address
  // instead: the page a user opens is at the site's address, never at the server the suite happens to run it on.
  const rawGoto = page.goto.bind(page);
  page.goto = async (url: string, options?: Parameters<Page['goto']>[1]) => rawGoto(new URL(url, RELEASE_SITE).href, options);
  await page.context().route(url => url.origin === new URL(RELEASE_SITE).origin, async route => {
    const requestPath = new URL(route.request().url()).pathname.slice(1);
    const found = releaseSiteFile(port, requestPath);
    if (found.kind === 'file') return route.fulfill({path: found.path});
    if (found.kind === 'catalogue') {
      const info: unknown = JSON.parse(readFileSync(join(dist, 'build-info.json'), 'utf8'));
      const version = typeof info === 'object' && info !== null && 'version' in info && typeof info.version === 'string' ? info.version : '';
      return route.fulfill({json: buildCatalogueBundle(bundleDir, version || 'dev').bundle});
    }
    return route.fulfill({status: 404, body: `no ${requestPath} in the test build`});
  });
}
