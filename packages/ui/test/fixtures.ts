import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {type Browser, type BrowserContext, type Disposable, expect, type Locator, type Page, test as base} from '@playwright/test';
import {NumberField} from '@openisd/design/fields';
import {CHROME_OUTAGE_POLICY, CHROME_STABLE_MS, type OutageClock, waitOutOutage} from './fixtures/chromeOutage.js';
import {fillAndBlur} from './fixtures/numField.js';
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject, SAMPLE_PROJECT_OWPR} from './fixtures/sampleProject.js';
export {COMPLETE_DRIVER_PROJECT_OWPR, SAMPLE_PROJECT_OWPR};

const TELEMETRY_COLLECTOR_ORIGIN = 'https://openisd-stats.john-lonergan-0e9.workers.dev';

/**
 * Shared Playwright fixtures for all UI/browser tests.
 *
 * `browserLog` is an AUTO fixture — it runs for every test that imports `test`
 * from here, even if the test never references it. It:
 *   1. Establishes a clean baseline at test start (fresh per-test page, empty log).
 *   2. Captures the browser Console, uncaught page errors, and same-origin Network
 *      failures for the whole test.
 *   3. At teardown asserts NO NEW issues appeared (only if the test body passed).
 *
 * This makes the CLAUDE.md rule ("UI tests MUST assert zero console/network
 * issues") impossible to forget — a green DOM assertion alone once hid a Vue
 * "Duplicate keys found" warning that was corrupting list rendering.
 *
 * Baseline control: a test may call `browserLog.reset()` after its initial
 * navigation/setup to re-baseline, so only issues from its own interactions are
 * asserted. Add `browserLog` to the test args to use it.
 *
 * Asserted for EVERY test (no opt-out): no console `error`s, no "Duplicate keys"
 * class of Vue warning, no uncaught page errors, no 4xx/5xx/failed localhost
 * requests. Benign general warnings (e.g. "Autofocus processing was blocked")
 * are NOT failed. On any failure the full console + network capture is attached
 * to the report and printed for diagnosis.
 */
export interface BrowserLog {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  networkErrors: string[];
  reset: () => void;
  _attach?: (page: Page) => () => void;
}

/**
 * Written by the first worker whose launch wait ran out; the other workers of the same run (children
 * of the same runner process) then fail fast instead of each waiting out the full time again, which
 * for a Chrome that is really broken would take hours across 180 failing tests.
 */
const GAVE_UP_STAMP = join(tmpdir(), `openisd-chrome-gave-up-${process.ppid}`);
const GAVE_UP_STAMP_MAX_AGE_MS = 30 * 60 * 1000;

function someWorkerGaveUp(): boolean {
  return existsSync(GAVE_UP_STAMP) && Date.now() - statSync(GAVE_UP_STAMP).mtimeMs < GAVE_UP_STAMP_MAX_AGE_MS;
}

const REAL_CLOCK: OutageClock = {
  now: () => Date.now(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
};

/**
 * What a test adds to the shared worker page itself and Playwright keeps until told otherwise: init
 * scripts, event listeners (dialog handlers included), cookies, extra headers and media emulation.
 * `removeAll` undoes them. App state is not here: a value the app carries from one test to the next
 * is an app bug, not something to reset.
 */
/** The page events a test can attach a handler to (Playwright's own plumbing does not use them). */
const PAGE_EVENTS = [
  'close', 'console', 'crash', 'dialog', 'domcontentloaded', 'download', 'filechooser', 'frameattached',
  'framedetached', 'framenavigated', 'load', 'pageerror', 'popup', 'request', 'requestfailed',
  'requestfinished', 'response', 'websocket', 'worker',
] as const;

export class TestAdditions {
  readonly #page: Page;
  readonly #scripts: Disposable[] = [];

  constructor(page: Page) {
    this.#page = page;
    const addPageScript = page.addInitScript.bind(page);
    page.addInitScript = async (...args: Parameters<Page['addInitScript']>) => {
      const added = await addPageScript(...args);
      this.#scripts.push(added);
      return added;
    };
    const context = page.context();
    const addContextScript = context.addInitScript.bind(context);
    context.addInitScript = async (...args: Parameters<BrowserContext['addInitScript']>) => {
      const added = await addContextScript(...args);
      this.#scripts.push(added);
      return added;
    };
  }

  async removeAll(): Promise<void> {
    for (const script of this.#scripts.splice(0)) await script.dispose().catch(() => {});
    for (const event of PAGE_EVENTS) this.#page.removeAllListeners(event);
    await this.#page.context().clearCookies();
    await this.#page.setExtraHTTPHeaders({});
    await this.#page.emulateMedia({colorScheme: null, media: null, reducedMotion: null, forcedColors: null});
  }
}

/**
 * Resets the open worker app back to a clean initial state:
 * - clears route stubs (page.unrouteAll)
 * - resets viewport to default desktop (1280x720)
 * - clears active element focus
 * - clears storage back to splashSeen / persist_warning_dismissed baseline
 * - closes all open projects and resets focused project to null
 * - resets application settings (difference cues, vented limits, env defaults)
 * - closes all dialogs / modals and clears presentation state (unit tokens, skin override, zoom)
 */
export async function resetApp(page: Page, additions: TestAdditions): Promise<void> {
  await additions.removeAll();
  await page.context().unrouteAll({ behavior: 'ignoreErrors' });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.setViewportSize({ width: 1280, height: 720 });

  await dismissOverlays(page);
  await closeAllProjects(page);
  await restoreOptions(page);
  await clearHash(page);
}

const OVERLAY_SELECTOR = '.overlay.on, .overlay.open, .wd-overlay, .confirm-overlay, .opt-overlay, .mob-align-overlay, .mob-action-sheet-overlay, .mob-menu-overlay, .mob-np-overlay, dialog[open]';

/** Closes whatever a test left open the way a user would: the dialog's own close controls, then Escape. */
async function dismissOverlays(page: Page): Promise<void> {
  let lastClickError = '';
  for (let i = 0; i < 4; i++) {
    if (await page.locator(OVERLAY_SELECTOR).count() === 0) return;
    // The non-modal Equation Inspector card floats over the dialogs; the user closes it first.
    const card = page.locator('.eq-x').filter({ visible: true }).first();
    if (await card.count() > 0) { await card.click({ timeout: 2000 }).catch((e: unknown) => { lastClickError = String(e).slice(0, 600); }); continue; }
    // An open drop-down is closed by clicking outside it, as a user does.
    const scrim = page.locator('.fmt-scrim').filter({ visible: true }).first();
    if (await scrim.count() > 0) { await scrim.click({ position: { x: 1, y: 1 }, timeout: 2000 }).catch((e: unknown) => { lastClickError = String(e).slice(0, 600); }); continue; }
    const close = page.locator('.overlay.on .x, .overlay.open .x, .overlay.on .close-btn, .overlay.open .close-btn, .opt-x, .wd-x, .confirm-dialog-cancel, .confirm-dialog-dismiss, .mob-sheet-close, .mob-menu-close').filter({ visible: true }).first();
    if (await close.count() > 0) await close.click({ timeout: 2000 }).catch((e: unknown) => { lastClickError = String(e).slice(0, 1800); });
    else await page.keyboard.press('Escape');
  }
  const left = await page.locator(OVERLAY_SELECTOR).evaluateAll(els => els.map(el => `${el.className}: ${(el.textContent ?? '').replace(/\s+/g, ' ').slice(0, 120)}`));
  if (left.length > 0) throw new Error(`resetApp: overlays still open: ${left.join(' | ')} (last close click: ${lastClickError})`);
}

/** Clears the project list through each row's own menu (Close for an open project, unsaved changes
 *  discarded; Move to Bin for a saved one), then deletes what is in the Bin forever. */
async function closeAllProjects(page: Page): Promise<void> {
  const rows = page.locator('.original-root .project-row');
  for (let guard = 0; guard < 80; guard++) {
    const count = await rows.count();
    let acted = false;
    for (let i = 0; i < count && !acted; i++) {
      await rows.nth(i).locator('.row-menu-btn').click();
      const close = page.locator('.row-menu-item.menu-action-close');
      const remove = page.locator('.row-menu-item.menu-action-delete');
      if (await close.count() > 0) {
        await close.first().click();
        const discard = page.locator('.close-actions button', { hasText: 'Close without saving' });
        if (await discard.isVisible()) await discard.click();
      } else if (await remove.count() > 0) {
        await remove.first().click();
        await page.locator('.confirm-dialog-confirm').click();
      } else { await page.keyboard.press('Escape'); continue; }
      acted = true;
    }
    if (!acted) break;
  }
  await emptyBin(page);
}

async function emptyBin(page: Page): Promise<void> {
  const toggle = page.locator('.projects-panel-footer .bin-toggle');
  if (await toggle.count() === 0 || /Bin \(0\)/.test(await toggle.innerText())) return;
  const back = page.getByRole('button', { name: 'Back to projects' });
  if (!await back.isVisible()) await toggle.click();
  const binRows = page.locator('.bin-row');
  for (let guard = 0; guard < 80 && await binRows.count() > 0; guard++) {
    await page.locator('.bin-delete-forever').first().click();
    await page.locator('.confirm-dialog-confirm').click();
  }
  await page.getByRole('button', { name: 'Back to projects' }).click();
}

/** Puts Options back to the app's defaults through the Options dialog's own controls. */
async function restoreOptions(page: Page): Promise<void> {
  await page.locator('.tb-btn[title^="Options"]').click();
  const modal = page.locator('.options-modal, .opt-modal');
  await modal.waitFor({ state: 'visible' });
  for (const id of ['env-reset', 'settings-reset']) {
    const reset = modal.getByTestId(id);
    if (await reset.isEnabled()) await reset.click();
  }
  await modal.getByTestId('difference-cues').getByRole('checkbox').check();
  await modal.getByRole('button', { name: /Reset to Metric/ }).click();
  await modal.getByTestId('settings-apply').click();
  await modal.waitFor({ state: 'hidden' });
}

async function clearHash(page: Page): Promise<void> {
  if (!page.url().includes('#') && !page.url().includes('?')) return;
  await page.evaluate(() => {
    globalThis.location.hash = '';
    globalThis.history.replaceState(null, '', '/');
  });
}

export const test = base.extend<
  { browserLog: BrowserLog; page: Page; appPage: Page },
  { browser: Browser; workerAppPage: Page; testAdditions: TestAdditions }
>({
  // Replaces Playwright's own `browser` so a Chrome launch outage is waited out here instead of
  // failing tests in milliseconds (bugs/BUG_20261007_browser-processes-die-mid-suite.md). A launch
  // counts only once Chrome has stayed up for a few seconds and loaded two throwaway pages: a burst
  // flips between launched and dead every 1-3 s.
  // After a failed test Playwright starts a new worker, which waits here too, so a burst fails at
  // most the tests already running in it. Test bodies are never retried.
  browser: [async ({ playwright, browserName, headless, channel, launchOptions }, use) => {
    const launchAndProbe = async (): Promise<Browser> => {
      const launched = await playwright[browserName].launch({ ...launchOptions, headless, channel, handleSIGINT: false });
      const loadBlankPage = async (): Promise<void> => {
        const context = await launched.newContext();
        await (await context.newPage()).goto('about:blank');
        await context.close();
      };
      try {
        await loadBlankPage();
        await REAL_CLOCK.sleep(CHROME_STABLE_MS);
        if (!launched.isConnected()) throw new Error(`Chrome died within ${CHROME_STABLE_MS / 1000} s of launch`);
        await loadBlankPage();
      } catch (error) {
        await launched.close().catch(() => { /* already dead: the original error is the one to report */ });
        throw error;
      }
      return launched;
    };
    const policy = someWorkerGaveUp() ? { ...CHROME_OUTAGE_POLICY, timeoutMs: 0 } : CHROME_OUTAGE_POLICY;
    const browser = await waitOutOutage(launchAndProbe, policy, REAL_CLOCK, line => console.error(line)).catch((error: unknown) => {
      writeFileSync(GAVE_UP_STAMP, String(Date.now()));
      throw error;
    });
    await use(browser);
    await browser.close();
  }, { scope: 'worker', timeout: CHROME_OUTAGE_POLICY.timeoutMs + 30_000 }],

  workerAppPage: [async ({ browser }, use) => {
    const port = process.env.OPENISD_TEST_PORT;
    const baseURL = port ? `http://localhost:${port}` : 'http://localhost:4100';
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try { if (!localStorage.getItem('openisd_view')) localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true } })); }
      catch { /* storage disabled */ }
      try { if (localStorage.getItem('openisd_persist_warning_dismissed') === null) localStorage.setItem('openisd_persist_warning_dismissed', '1'); }
      catch { /* storage disabled */ }
    });
    await page.goto('/');
    await page.locator('.original-root, .mobile-root').first().waitFor({ state: 'visible' });

    // Avoid full page reloads when tests call page.goto('/') on the already-loaded worker app page.
    const rawGoto = page.goto.bind(page);
    page.goto = async (url: string, options?: Parameters<Page['goto']>[1]) => {
      if (url === '/' || url === '' || url === baseURL || url === `${baseURL}/`) {
        return null;
      }
      return rawGoto(url, options);
    };

    await use(page);
    await context.close().catch(() => {});
  }, { scope: 'worker' }],

  page: async ({ page, browserLog }, use) => {
    await page.addInitScript(() => {
      try { if (!localStorage.getItem('openisd_view')) localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true } })); }
      catch { /* storage disabled */ }
      try { if (localStorage.getItem('openisd_persist_warning_dismissed') === null) localStorage.setItem('openisd_persist_warning_dismissed', '1'); }
      catch { /* storage disabled */ }
    });
    const detach = browserLog._attach?.(page);
    try {
      await use(page);
    } finally {
      // Straight after the test body, while the page is still open (F41): a route handler still inside
      // route.fetch() when the page closes throws "Test ended" into the result.
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      detach?.();
    }
  },

  testAdditions: [async ({ workerAppPage }, use) => {
    await use(new TestAdditions(workerAppPage));
  }, { scope: 'worker' }],

  appPage: async ({ workerAppPage, testAdditions, browserLog }, use) => {
    await resetApp(workerAppPage, testAdditions);
    const detach = browserLog._attach?.(workerAppPage);
    try {
      await use(workerAppPage);
    } finally {
      detach?.();
      await resetApp(workerAppPage, testAdditions);
    }
  },

  browserLog: [async ({}, use, testInfo) => {
    const log: BrowserLog = {
      consoleErrors: [], consoleWarnings: [], pageErrors: [], networkErrors: [],
      reset: () => {
        for (const k of ['consoleErrors', 'consoleWarnings', 'pageErrors', 'networkErrors'] as const) log[k].length = 0;
      },
    };

    const pageRef: { page: Page | null; detach: (() => void) | null } = { page: null, detach: null };

    log._attach = (p: Page) => {
      pageRef.page = p;
      const onConsole = (m: import('@playwright/test').ConsoleMessage) => {
        if (m.location().url.startsWith(TELEMETRY_COLLECTOR_ORIGIN)) return;
        if (m.type() === 'error') log.consoleErrors.push(m.text());
        else if (m.type() === 'warning') log.consoleWarnings.push(m.text());
      };
      const onPageError = (e: Error) => log.pageErrors.push(e.message);
      const onRequestFailed = (r: import('@playwright/test').Request) => {
        if (r.url().includes('localhost')) {
          const err = r.failure()?.errorText;
          if (err !== 'net::ERR_ABORTED') {
            log.networkErrors.push(`FAILED ${r.url()} — ${err}`);
          }
        }
      };
      const onResponse = (r: import('@playwright/test').Response) => {
        if (r.url().includes('localhost') && r.status() >= 400) log.networkErrors.push(`${r.status()} ${r.url()}`);
      };

      p.on('console', onConsole);
      p.on('pageerror', onPageError);
      p.on('requestfailed', onRequestFailed);
      p.on('response', onResponse);

      pageRef.detach = () => {
        p.off('console', onConsole);
        p.off('pageerror', onPageError);
        p.off('requestfailed', onRequestFailed);
        p.off('response', onResponse);
      };
      return pageRef.detach;
    };

    await use(log);
    pageRef.detach?.();

    const dump = {
      consoleErrors: log.consoleErrors,
      consoleWarnings: log.consoleWarnings,
      pageErrors: log.pageErrors,
      networkErrors: log.networkErrors,
    };
    const failed = testInfo.status !== testInfo.expectedStatus;
    const hasIssues = Object.values(dump).some(a => a.length > 0);

    // Always collect the evidence: whenever a test failed (any reason) OR the
    // browser logged anything, attach the captured console + network to the report
    // and print it — like an error trace, for diagnosis.
    if (failed || hasIssues) {
      await testInfo.attach('browser-console-and-network', {
        body: JSON.stringify(dump, null, 2),
        contentType: 'application/json',
      });
      console.error(`\n[browser diagnostics — "${testInfo.title}"${failed ? ' (test FAILED)' : ''}]\n${JSON.stringify(dump, null, 2)}\n`);
    }

    // THE DEV SERVER IS GONE — not a test failure, and never to be counted as one.
    // `playwright.config.js` sets `reuseExistingServer: true`, so if vite on 4100 dies
    // mid-run nothing restarts it and every remaining test fails identically on
    // ERR_CONNECTION_REFUSED. That once turned one infrastructure death into "210 failed",
    // a number that measured how far the run got rather than anything about the code.
    // bugs/archive/BUG_20260909_the_playwright_vite_server_dies_mid_run_and_fakes_hundreds_of_failures.md
    //
    // Raised FIRST and on its own, so the message says what actually happened rather than
    // burying it among the diagnostics categories below.
    const serverDown = log.networkErrors.filter(e => /ERR_CONNECTION_REFUSED/.test(e));
    if (serverDown.length) {
      throw new Error(
        'DEV SERVER UNREACHABLE — this is NOT a test failure.\n' +
        `The base URL refused the connection (${serverDown.length} request(s)):\n    ` +
        serverDown.join('\n    ') + '\n' +
        'The vite server on 4100 has died, so every test after this point fails the same way ' +
        'regardless of the code. TREAT THIS RUN AS VOID and restart the suite — do not read ' +
        'its pass/fail totals as a result.',
      );
    }

    // NO opt-out, NO skip-on-failure. EVERY check runs every time — each is wrapped
    // in try/catch so an early failure never prevents the later checks from running.
    // Their failures are aggregated into ONE error listing every category, so a
    // single test run reports the complete picture rather than the first problem only.
    const checks: Array<[string, string[]]> = [
      ['Vue "Duplicate keys found" warnings', log.consoleWarnings.filter(w => /duplicate key/i.test(w))],
      ['console errors', log.consoleErrors],
      ['uncaught page errors', log.pageErrors],
      ['same-origin network failures', log.networkErrors],
    ];
    const failures: string[] = [];
    for (const [label, entries] of checks) {
      try {
        expect(entries, label).toEqual([]);
      } catch {
        failures.push(`✗ ${label} (${entries.length}):\n    ${entries.join('\n    ')}`);
      }
    }
    if (failures.length) {
      throw new Error(`Browser diagnostics not clean — ${failures.length} categor${failures.length === 1 ? 'y' : 'ies'} with issues:\n${failures.join('\n')}`);
    }
  }, { auto: true }],
});

export async function openAProject(page: Page, owprPath: string = SAMPLE_PROJECT_OWPR, name: string = basename(owprPath)): Promise<void> {
  ensureSampleProject();
  await page.locator('.original-root input[type=file]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: readFileSync(owprPath),
  });
  await page.locator('.original-root').waitFor({ state: 'visible' });
  // The window keeps the tab the last project was left on; a user starts a project on the Box tab.
  await page.locator('.project-nav li', { hasText: /^Box$/ }).click();
}

/**
 * `openAProject`'s mobile-shell twin — never reuse `openAProject` for a mobile spec: it
 * hardcodes `.original-root input[type=file]`, which is not present when the mobile shell is
 * showing. Waits for `.mob-tabbar` specifically (not just `.mobile-root`, which is also the
 * empty-state root) — that's the readiness signal a project has actually loaded.
 */
export async function openAMobileProject(page: Page, owprPath: string = SAMPLE_PROJECT_OWPR, name: string = basename(owprPath)): Promise<void> {
  ensureSampleProject();
  await page.locator('.mobile-root input[type=file]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: readFileSync(owprPath),
  });
  await page.locator('.mob-tabbar').waitFor({ state: 'visible' });
}

/**
 * The driver editor's tab, ENSURED rather than assumed.
 *
 * The editor opens on Parameters by design, and each pane is behind `v-if="tab === ..."`, so a
 * General-tab cell (`.de-fld` — Brand, Model, comment) NEVER MOUNTS until something switches
 * tabs. A test that waits on one without switching does not fail, it hangs for the full 60 s
 * timeout: ~36 of the 100 failures in the 2026-09-16 sequential run were this one mistake.
 *
 * Hence the creed (human's rule, ui-bugfix.md): only the test that wants to know the default tab
 * may assert it; every other test switches to the tab it intends, whatever tab is showing.
 *
 * Scoped to `.de-modal` and matched by exact accessible name, because "Parameters" is a prefix
 * of "Advanced". Already-active is left alone: clicking a tab that is already on is
 * a no-op the modal does not need, and it can be intercepted when the picker sits behind.
 */
export async function editorTab(page: Page, tab: EditorTab): Promise<void> {
  const button = page.locator('.de-modal').getByRole('button', { name: tab, exact: true });
  await button.waitFor({ state: 'visible' });
  if (!(await button.evaluate(el => el.classList.contains('on')))) await button.click();
  await expect(button).toHaveClass(/\bon\b/);
}

export type EditorTab = 'General' | 'Parameters' | 'Advanced' | 'Dimensions';

/** The focused project's main (box) volume, read through the app's own state module, which the
 *  dev server serves — the app ships no debug handle for this. */
export async function focusedBoxVolume(page: Page): Promise<number> {
  return page.evaluate(async (path) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const box = m.requireFocusedProject().box;
    const v = box.volumeOf(box.boxType.value).value;
    if (v === null) throw new Error('the focused project\'s box volume is blank');
    return v;
  }, 'appState');
}

/** Write the focused project's main (box) volume, so its design differs from its saved one. */
export async function setFocusedBoxVolume(page: Page, volume_m3: number): Promise<void> {
  await page.evaluate(async ({path, v}) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const box = m.requireFocusedProject().box;
    box.volumeOf(box.boxType.value).set(v);
  }, {path: 'appState', v: volume_m3});
}

/** The drive group's committed state (power, voltage, driver Re, series Rs), read live from the
 *  focused project's domain object. */
export interface DriveGroupState {
  P: number | null;
  V: number | null;
  Re: number | null;
  Rs: number | null;
}

export async function focusedDriveGroup(page: Page): Promise<DriveGroupState> {
  return page.evaluate(async (path): Promise<DriveGroupState> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const p = m.requireFocusedProject();
    return { P: p.powerDrive_W.value, V: p.driveVoltage_V.value, Re: p.driver.specs.Re_ohm.value, Rs: p.Rs_ohm.value };
  }, 'appState');
}

/** Number of points in the latest computed SPL curve (0 until the first sweep lands). */
export async function curvesSplLength(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'curvesData' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.curvesData.value?.spl?.length ?? 0;
  }, 'appState');
}

/** The focused project's box type, as the domain holds it. */
export async function focusedBoxType(page: Page): Promise<string> {
  return page.evaluate(async (path): Promise<string> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().box.boxType.value;
  }, 'appState');
}

/** Switch the focused project's box type through the domain, as a file load would. */
export type BoxTypeName = 'sealed' | 'vented' | 'bandpass4' | 'bandpass6' | 'abc' | 'box-passive-radiator';

export async function setFocusedBoxType(page: Page, boxType: BoxTypeName): Promise<void> {
  await page.evaluate(async ({path, value}) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().box.boxType.set(value);
  }, {path: 'appState', value: boxType});
}

/** Drop the focused project's own temperature, humidity and pressure, as a freshly built project
 *  has none, so the Advanced tab falls back to the Options environment. */
export async function clearFocusedEnvironment(page: Page): Promise<void> {
  await page.evaluate(async (path) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const p = m.requireFocusedProject();
    p.envTempK.clear();
    p.envHumidityPct.clear();
    p.envPressurePa.clear();
  }, 'appState');
}

/** Driver parameters a test may set on the focused project's driver; `null` clears the entry so
 *  it is re-derived. SI units (Vas in m³, not litres). */
export type DriverSpecEntries = Partial<Record<'Fs_hz' | 'Qes' | 'Qms' | 'Qts' | 'Vas_m3' | 'Re_ohm', number | null>>;

/** Set (or clear) driver parameters on the focused project through the domain, as typing them in
 *  the What-if? panel would. */
export async function setFocusedDriverSpecs(page: Page, entries: DriverSpecEntries): Promise<void> {
  await page.evaluate(async ({path, values}) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const specs = m.requireFocusedProject().driver.specs;
    for (const key of ['Fs_hz', 'Qes', 'Qms', 'Qts', 'Vas_m3', 'Re_ohm'] as const) {
      const v = values[key];
      if (v === undefined) continue;
      if (v === null) specs[key].clear(); else specs[key].set(v);
    }
  }, {path: 'appState', values: entries});
}

/** Set the focused project's series source resistance Rs (ohm), as the Signal tab does. */
export async function setFocusedSeriesResistance(page: Page, ohm: number): Promise<void> {
  await page.evaluate(async ({path, v}) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().Rs_ohm.set(v);
  }, {path: 'appState', v: ohm});
}

/** Set the leakage Ql and absorption Qa losses of the focused project's `sealed` box, as the Box
 *  losses popup does. */
export async function setFocusedSealedLosses(page: Page, losses: {Ql: number; Qa: number}): Promise<void> {
  await page.evaluate(async ({path, values}) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const [sealed] = m.requireFocusedProject().box.lossGroupsOf('sealed');
    if (!sealed) throw new Error('a sealed box has losses');
    sealed.Ql.set(values.Ql);
    sealed.Qa.set(values.Qa);
  }, {path: 'appState', values: losses});
}

/** The focused sealed box's resonance Fsc and Qtc as the domain holds them. */
export async function focusedSealedReadouts(page: Page): Promise<{fsc: number | null; qtc: number | null}> {
  return page.evaluate(async (path) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const sealed = m.requireFocusedProject().box.sealed;
    return {fsc: sealed.resonance_hz.value, qtc: sealed.q_tc.value};
  }, 'appState');
}

/** The focused vented box's vent length target-unreachable flag and DQ issue count. */
export async function focusedVentLengthDq(page: Page): Promise<{unreachable: boolean; dqCount: number}> {
  return page.evaluate(async (path) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const dq = m.requireFocusedProject().box.vented.vent.length_m.dq;
    return {unreachable: dq.some(issue => issue.kind === 'target-unreachable'), dqCount: dq.length};
  }, 'appState');
}

/** Give the focused vented box a real vent (volume, tuning goal, port diameter) through the same
 *  domain seam the typing drives, so the solver produces a vent length. */
export async function setFocusedVentedDesign(page: Page, design: {volume_m3: number; tuning_hz: number; diameter_m: number}): Promise<void> {
  await page.evaluate(async ({path, d}) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const p = m.requireFocusedProject();
    p.box.vented.volume_m3.set(d.volume_m3);
    p.box.vented.tuning_goal_hz.set(d.tuning_hz);
    p.box.vented.vent.diameter_m.set(d.diameter_m);
  }, {path: 'appState', d: design});
}

/** The focused bandpass6 rear chamber's tuning goal (Hz). */
export async function focusedBandpass6RearTuning(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const value = m.requireFocusedProject().box.bandpass6.chambers.rear.tuning_goal_hz.value;
    if (value === null) throw new Error('tuning_goal_hz has no value');
    return value;
  }, 'appState');
}

/** The focused bandpass6 front chamber's tuning goal (Hz) and the vented box's tuning goal (Hz, null when blank). */
export async function focusedBandpass6Tunings(page: Page): Promise<{front: number | null; vented: number | null}> {
  return page.evaluate(async (path): Promise<{front: number | null; vented: number | null}> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const box = m.requireFocusedProject().box;
    return {front: box.bandpass6.chambers.front.tuning_goal_hz.value, vented: box.vented.tuning_goal_hz.value};
  }, 'appState');
}

/** The focused bandpass6 or ABC project's vent diameters and lengths (SI, null when blank), by port. */
export interface FocusedPortVents {
  rear: {diameter: number | null; length: number | null};
  front: {diameter: number | null; length: number | null};
  intra: {diameter: number | null; length: number | null} | null;
}

export async function focusedPortVents(page: Page): Promise<FocusedPortVents> {
  return page.evaluate(async (path): Promise<FocusedPortVents> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const box = m.requireFocusedProject().box;
    const abc = box.boxType.value === 'abc';
    const vents = abc ? box.abc.vents : box.bandpass6.vents;
    const read = (v: typeof vents.rear) => ({diameter: v.diameter_m.value, length: v.length_m.value});
    return {rear: read(vents.rear), front: read(vents.front), intra: abc ? read(box.abc.vents.intra) : null};
  }, 'appState');
}

/** The focused project's passive radiator: its name, count and spec cells (SI units). */
export interface FocusedPassiveRadiatorSpec {
  name: string;
  count: number;
  vas_m3: number | null;
  qms: number | null;
  fs_hz: number | null;
  sd_m2: number | null;
  xmax_m: number | null;
}

export async function focusedPassiveRadiatorSpec(page: Page): Promise<FocusedPassiveRadiatorSpec> {
  return page.evaluate(async (path) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const pr = m.requireFocusedProject().box.passiveRadiator;
    const spec = pr.radiator.spec;
    return {
      name: pr.radiator.model.value, count: pr.count.value,
      vas_m3: spec.Vas_m3.value, qms: spec.Qms.value, fs_hz: spec.Fs_hz.value,
      sd_m2: spec.Sd_m2.value, xmax_m: spec.Xmax_m.value,
    };
  }, 'appState');
}

/** The focused project's port air-velocity limit (m/s). */
export async function focusedPortVelocityLimit(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().portVelocityLimit_m_per_s.value;
  }, 'appState');
}

/** One driver spec value of the focused project's driver (SI units); fails when it has no value. */
export async function focusedDriverSpec(page: Page, field: 'Fs_hz' | 'Mms_kg'): Promise<number> {
  return page.evaluate(async ({path, f}): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const value = m.requireFocusedProject().driver.specs[f].value;
    if (value === null) throw new Error(`driver.specs.${f} has no value`);
    return value;
  }, {path: 'appState', f: field});
}

/** Open a second, independent project as a copy of the focused one, and focus it — the domain
 *  call behind the project list's "＋ Copy". */
export async function duplicateFocusedProject(page: Page, newName: string): Promise<void> {
  await page.evaluate(async ({path, name}) => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'duplicateFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.duplicateFocusedProject(name);
  }, {path: 'appState', name: newName});
}

/** The Options environment temperature (K) as the application settings hold it. */
export async function appEnvDefaultsTempK(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'envDefaults' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.envDefaults().tempK;
  }, 'appState');
}

/** The user name saved by the Options dialog. */
export async function savedUsername(page: Page): Promise<string | undefined> {
  return page.evaluate(async (path): Promise<string | undefined> => {
    type PresentationState = import('../src/logic/presentationState.js').PresentationState;
    function isPresentationState(m: unknown): m is PresentationState {
      return typeof m === 'object' && m !== null && 'narrowViewport' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isPresentationState(m)) throw new Error('presentationState module shape mismatch');
    return m.ui.username;
  }, 'presentationState');
}

/** The persisted display-unit token for the box volume field (`NumberField.BOX_VB_L`). */
export async function boxVolumeUnitToken(page: Page): Promise<string | undefined> {
  const rotation = await page.evaluate(async (path): Promise<Record<string, string>> => {
    type PresentationState = import('../src/logic/presentationState.js').PresentationState;
    function isPresentationState(m: unknown): m is PresentationState {
      return typeof m === 'object' && m !== null && 'narrowViewport' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isPresentationState(m)) throw new Error('presentationState module shape mismatch');
    return {...m.ui.unitTokens};
  }, 'presentationState');
  return NumberField.BOX_VB_L.unitTokenFor(rotation);
}

/** Set the app-wide chart frequency sweep range, as a drag-zoom does. */
export async function setSweepRange(page: Page, range: {min: number; max: number}): Promise<void> {
  await page.evaluate(async ({path, r}) => {
    type PresentationState = import('../src/logic/presentationState.js').PresentationState;
    function isPresentationState(m: unknown): m is PresentationState {
      return typeof m === 'object' && m !== null && 'narrowViewport' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isPresentationState(m)) throw new Error('presentationState module shape mismatch');
    m.sweepRange = r;
  }, {path: 'presentationState', r: range});
}

/** Sum of the latest computed SPL curve — changes whenever the swept response changes. */
export async function curvesSplSum(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'curvesData' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return (m.curvesData.value?.spl ?? []).reduce((a, b) => a + b, 0);
  }, 'appState');
}

/** Number of filters in the focused project's filter chain. */
export async function focusedFilterCount(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().filters.value.length;
  }, 'appState');
}

/** The focused project's drive power (W) — the one stored drive fact; voltage derives from it. */
export async function focusedPowerDrive_W(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const value = m.requireFocusedProject().powerDrive_W.value;
    if (value === null) throw new Error('powerDrive_W has no value');
    return value;
  }, 'appState');
}

/** Whether the focused project has unsaved changes — the flag behind every unsaved marker. */
export async function focusedIsModified(page: Page): Promise<boolean> {
  return page.evaluate(async (path): Promise<boolean> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().isModified();
  }, 'appState');
}

/** The focused project's name. */
export async function focusedProjectName(page: Page): Promise<string> {
  return page.evaluate(async (path): Promise<string> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().name.value;
  }, 'appState');
}

/** Dirty the focused design: add a highpass filter and move the drive power off its 1 W reference. */
export async function dirtyFocusedDesign(page: Page): Promise<void> {
  await page.evaluate(async (path): Promise<void> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const project = m.requireFocusedProject();
    project.filters.set([...project.filters.value, { type: 'highpass', family: 'sos', order: 2, enabled: true, fc: 30, Q: 0.7 }]);
    project.powerDrive_W.set(250);
  }, 'appState');
}

/** The focused project serialised as `.owpr` JSON, saved first so the saved layer holds the design. */
export async function focusedProjectOwpr(page: Page): Promise<unknown> {
  return page.evaluate(async (path): Promise<unknown> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const p = m.requireFocusedProject();
    // `saved` is the project baseline (empty) until the wizard's choices are committed.
    p.save();
    return JSON.parse(p.toOwprText());
  }, 'appState');
}

/** The focused project's driver added cone mass (kg). */
export async function focusedAddedMass_kg(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = import('../src/logic/appState.js').AppState;
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().driverAddedMass_kg.value;
  }, 'appState');
}

/** Open the Driver Editor the way a user does: Driver tab, Edit, wait for the body. */
export async function openDriverEditor(page: Page): Promise<void> {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await page.locator('.de-body').waitFor({ state: 'visible' });
}

/** A Driver Editor field box, found by its exact label text. */
export function driverEditorField(page: Page, label: string): Locator {
  return page.locator('.de-body .de-fld', { has: page.locator(`label:text-is("${label}")`) }).first();
}

/** Values the seeded driver enters, in the unit the field displays: one solvable driver, so the
 *  solver marks a realistic set of fields CALCULATED. */
const SEED_PARAMETERS: ReadonlyArray<readonly [string, string]> = [
  ['Fs', '35'], ['Qts', '0.38'], ['Qes', '0.42'], ['Re', '6.4'],
  ['Vas', '32'], ['Sd', '220'], ['Xmax', '6.5'], ['Pe', '150'],
  ['Hc', '18'], ['Hg', '8'],
];

/** Dimensions-tab geometry (mm). DVol is deliberately the ONE unseeded member of the
 *  DVol/Depth/MagDepth/Magnet lock, so the solver fills it and a CALCULATED geometry field exists. */
const SEED_DIMENSIONS: ReadonlyArray<readonly [string, string]> = [
  ['Driver Depth (Depth)', '55'], ['Magnet Depth', '20'],
  ['Magnet Diameter (Magnet)', '60'], ['Voice Coil Dia (Vcd)', '25'],
];

/** In the open Driver Editor, enter a solvable driver so the derived fields carry the CALCULATED mark. */
export async function seedDriverInEditor(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  for (const [label, value] of SEED_PARAMETERS) {
    await fillAndBlur(driverEditorField(page, label).locator('input').first(), value);
  }
  await page.getByRole('button', { name: 'Dimensions', exact: true }).click();
  for (const [label, value] of SEED_DIMENSIONS) {
    await fillAndBlur(driverEditorField(page, label).locator('input').first(), value);
  }
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
}

/** Walk every Driver Editor tab, handing the visitor that tab's own field labels WHILE it is on
 *  screen (collecting them up front would run every assertion against the last tab open). */
export async function forEachEditorTab(page: Page, visit: (tab: string, labels: string[]) => Promise<void>): Promise<void> {
  const tabs = (await page.locator('.de-tab').allInnerTexts()).map(s => s.trim());
  for (const tab of tabs) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const labels = (await page.locator('.de-body .de-fld label').allInnerTexts()).map(s => s.trim());
    await visit(tab, labels);
  }
}

export { expect };
export * from './fixtures/reference-drivers.js';
