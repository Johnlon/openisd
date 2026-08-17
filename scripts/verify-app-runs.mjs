/**
 * Deploy check: does the deployed app actually RUN?
 *
 * `verify-preview.sh` compares the served bundle's filename against the newest built one. That
 * proves the bytes are CURRENT; it cannot prove they are CORRECT. HTTP 200 is the server
 * answering, not the app working. Both passed while every reactive computation in the driver
 * panel was throwing — see
 * `bugs/BUG_20260817_deploy_verifies_asset_freshness_but_never_that_the_app_runs.md`.
 *
 * So this loads the page in a real browser and fails on anything a user would see as broken:
 * an uncaught exception, a console error, a failed request for the app's own assets, or an
 * empty root element.
 *
 * READ-ONLY on port 4000. It never kills or restarts the human's server (AGENTS.md "Port
 * assignments" — 4000 is theirs), it only visits it.
 *
 *   node scripts/verify-app-runs.mjs [url]
 */
import { chromium } from 'playwright';

/** Node's global URL constructor, aliased because `URL` here is the page under test. */
const URL_CTOR = globalThis.URL;

const URL = process.argv[2] ?? 'http://localhost:4000/';
const LOAD_TIMEOUT_MS = 30_000;
/** Time after load for deferred work — stores rehydrating, watchers, the first sweep — to
 *  throw. The reported fault fired during that settling, not during parse. */
const SETTLE_MS = 3_000;

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

const browser = await chromium.launch();
// A FRESH context every run: no service worker, no localStorage, no IndexedDB. That is the
// first-visit path, which is the one a deploy must not break — and it keeps the check from
// passing only because this machine happens to hold state that papers over the fault.
const context = await browser.newContext();
const page = await context.newPage();

page.on('pageerror', e => pageErrors.push(e.stack || String(e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('requestfailed', r => {
  // Ignore anything not served by this origin — a deploy is not broken by someone else's CDN.
  if (r.url().startsWith(new URL_CTOR(URL).origin)) {
    failedRequests.push(`${r.url()} — ${r.failure()?.errorText ?? 'failed'}`);
  }
});

let rootChildren = 0;
let loadError = null;
try {
  const response = await page.goto(URL, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS });
  if (!response || !response.ok()) {
    loadError = `GET ${URL} returned ${response ? response.status() : 'no response'}`;
  }
  await page.waitForTimeout(SETTLE_MS);
  rootChildren = await page.evaluate(() => document.querySelector('#app')?.childElementCount ?? -1);
} catch (e) {
  loadError = e.message;
}

await browser.close();

const problems = [];
if (loadError) problems.push(`the page did not load: ${loadError}`);
if (rootChildren === -1) problems.push('#app is missing from the DOM');
else if (rootChildren === 0) problems.push('#app rendered NOTHING — the app mounted empty');
if (pageErrors.length) problems.push(`${pageErrors.length} uncaught exception(s):\n  ${pageErrors.join('\n  ')}`);
if (consoleErrors.length) problems.push(`${consoleErrors.length} console error(s):\n  ${consoleErrors.join('\n  ')}`);
if (failedRequests.length) problems.push(`${failedRequests.length} failed request(s):\n  ${failedRequests.join('\n  ')}`);

if (problems.length) {
  console.error(`FAIL: ${URL} serves a build that does not run.\n`);
  for (const p of problems) console.error(`  • ${p}\n`);
  console.error('A deploy is not "verified" because the filenames match — the app has to work.');
  process.exit(1);
}

console.log(`SUCCESS: ${URL} loads clean — no uncaught exceptions, no console errors, ` +
  `#app rendered ${rootChildren} child element(s).`);
