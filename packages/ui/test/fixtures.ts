import {readFileSync} from 'node:fs';
import {expect, type Locator, type Page, test as base} from '@playwright/test';
import {NumberField} from '@openisd/design/fields';
import {fillAndBlur} from './fixtures/numField.js';
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject, SAMPLE_PROJECT_OWPR} from './fixtures/sampleProject.js';
export {COMPLETE_DRIVER_PROJECT_OWPR, SAMPLE_PROJECT_OWPR};

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
}

export const test = base.extend<{ browserLog: BrowserLog }>({
  browserLog: [async ({ page }, use, testInfo) => {
    // Every browser test arrives with empty storage, which is exactly what makes the splash
    // raise itself — an overlay across the whole app before any test's first click. Seed the
    // view-state key so the suite starts past it. The splash's OWN spec
    // (`splash.browser.spec.ts`) uses Playwright's base `test`, so it still sees the real
    // first-visit behaviour.
    await page.addInitScript(() => {
      // Only when nothing is stored yet: a test that has already saved view state (unit
      // tokens, chart colours) reloads with that state, and overwriting it here would
      // silently undo what the test set up.
      try { if (!localStorage.getItem('openisd_view')) localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true } })); }
      catch { /* storage disabled — the splash then shows, and that test will say so */ }
    });

    const log: BrowserLog = {
      consoleErrors: [], consoleWarnings: [], pageErrors: [], networkErrors: [],
      reset: () => {
        for (const k of ['consoleErrors', 'consoleWarnings', 'pageErrors', 'networkErrors'] as const) log[k].length = 0;
      },
    };

    page.on('console', m => {
      if (m.type() === 'error') log.consoleErrors.push(m.text());
      else if (m.type() === 'warning') log.consoleWarnings.push(m.text());
    });
    page.on('pageerror', e => log.pageErrors.push(e.message));
    page.on('requestfailed', r => {
      // external federated sources (github.com) may be unreachable in CI — not our bug
      if (r.url().includes('localhost')) {
        const err = r.failure()?.errorText;
        if (err !== 'net::ERR_ABORTED') {
          log.networkErrors.push(`FAILED ${r.url()} — ${err}`);
        }
      }
    });
    page.on('response', r => {
      if (r.url().includes('localhost') && r.status() >= 400) log.networkErrors.push(`${r.status()} ${r.url()}`);
    });

    await use(log);

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

export async function openAProject(page: Page, owprPath: string = SAMPLE_PROJECT_OWPR): Promise<void> {
  ensureSampleProject();
  await page.locator('.original-root input[type=file]').setInputFiles({
    name: 'sample-project.owpr',
    mimeType: 'application/json',
    buffer: readFileSync(owprPath),
  });
  await page.locator('.original-root').waitFor({ state: 'visible' });
}

/**
 * `openAProject`'s mobile-shell twin — never reuse `openAProject` for a mobile spec: it
 * hardcodes `.original-root input[type=file]`, which is not present when the mobile shell is
 * showing. Waits for `.mob-tabbar` specifically (not just `.mobile-root`, which is also the
 * empty-state root) — that's the readiness signal a project has actually loaded.
 */
export async function openAMobileProject(page: Page, owprPath: string = SAMPLE_PROJECT_OWPR): Promise<void> {
  ensureSampleProject();
  await page.locator('.mobile-root input[type=file]').setInputFiles({
    name: 'sample-project.owpr',
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
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const box = m.requireFocusedProject().box;
    return box.volumeOf(box.boxType.value).value;
  }, '/src/logic/appState.ts');
}

/** Write the focused project's main (box) volume, so its design differs from its saved one. */
export async function setFocusedBoxVolume(page: Page, volume_m3: number): Promise<void> {
  await page.evaluate(async ({path, v}) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const box = m.requireFocusedProject().box;
    box.volumeOf(box.boxType.value).set(v);
  }, {path: '/src/logic/appState.ts', v: volume_m3});
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
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const p = m.requireFocusedProject();
    return { P: p.powerDrive_W.value, V: p.driveVoltage_V.value, Re: p.driver.specs.Re_ohm.value, Rs: p.Rs_ohm.value };
  }, '/src/logic/appState.ts');
}

/** Number of points in the latest computed SPL curve (0 until the first sweep lands). */
export async function curvesSplLength(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'curvesData' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.curvesData.value?.spl?.length ?? 0;
  }, '/src/logic/appState.ts');
}

/** The focused project's box type, as the domain holds it. */
export async function focusedBoxType(page: Page): Promise<string> {
  return page.evaluate(async (path): Promise<string> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().box.boxType.value;
  }, '/src/logic/appState.ts');
}

/** Switch the focused project's box type through the domain, as a file load would. */
export type BoxTypeName = 'sealed' | 'vented' | 'bandpass4' | 'bandpass6' | 'abc' | 'box-passive-radiator';

export async function setFocusedBoxType(page: Page, boxType: BoxTypeName): Promise<void> {
  await page.evaluate(async ({path, value}) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().box.boxType.set(value);
  }, {path: '/src/logic/appState.ts', value: boxType});
}

/** Drop the focused project's own temperature, humidity and pressure, as a freshly built project
 *  has none, so the Advanced tab falls back to the Options environment. */
export async function clearFocusedEnvironment(page: Page): Promise<void> {
  await page.evaluate(async (path) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const p = m.requireFocusedProject();
    p.envTempK.clear();
    p.envHumidityPct.clear();
    p.envPressurePa.clear();
  }, '/src/logic/appState.ts');
}

/** Driver parameters a test may set on the focused project's driver; `null` clears the entry so
 *  it is re-derived. SI units (Vas in m³, not litres). */
export type DriverSpecEntries = Partial<Record<'Fs_hz' | 'Qes' | 'Qms' | 'Qts' | 'Vas_m3' | 'Re_ohm', number | null>>;

/** Set (or clear) driver parameters on the focused project through the domain, as typing them in
 *  the Tune panel would. */
export async function setFocusedDriverSpecs(page: Page, entries: DriverSpecEntries): Promise<void> {
  await page.evaluate(async ({path, values}) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const specs = m.requireFocusedProject().driver.specs;
    for (const key of ['Fs_hz', 'Qes', 'Qms', 'Qts', 'Vas_m3', 'Re_ohm'] as const) {
      const v = values[key];
      if (v === undefined) continue;
      if (v === null) specs[key].clear(); else specs[key].set(v);
    }
  }, {path: '/src/logic/appState.ts', values: entries});
}

/** Set the focused project's series source resistance Rs (ohm), as the Signal tab does. */
export async function setFocusedSeriesResistance(page: Page, ohm: number): Promise<void> {
  await page.evaluate(async ({path, v}) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().Rs_ohm.set(v);
  }, {path: '/src/logic/appState.ts', v: ohm});
}

/** Set the leakage Ql and absorption Qa losses of the focused project's `sealed` box, as the Box
 *  losses popup does. */
export async function setFocusedSealedLosses(page: Page, losses: {Ql: number; Qa: number}): Promise<void> {
  await page.evaluate(async ({path, values}) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const sealed = m.requireFocusedProject().box.lossesOf('sealed');
    if (!sealed) throw new Error('a sealed box has losses');
    sealed.Ql.set(values.Ql);
    sealed.Qa.set(values.Qa);
  }, {path: '/src/logic/appState.ts', values: losses});
}

/** The focused sealed box's resonance Fsc and Qtc as the domain holds them. */
export async function focusedSealedReadouts(page: Page): Promise<{fsc: number | null; qtc: number | null}> {
  return page.evaluate(async (path) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const sealed = m.requireFocusedProject().box.sealed;
    return {fsc: sealed.resonance_hz.value, qtc: sealed.q_tc.value};
  }, '/src/logic/appState.ts');
}

/** The focused vented box's vent length target-unreachable flag and DQ issue count. */
export async function focusedVentLengthDq(page: Page): Promise<{unreachable: boolean; dqCount: number}> {
  return page.evaluate(async (path) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const dq = m.requireFocusedProject().box.vented.vent.length_m.dq;
    return {unreachable: dq.some(issue => issue.kind === 'target-unreachable'), dqCount: dq.length};
  }, '/src/logic/appState.ts');
}

/** Give the focused vented box a real vent (volume, tuning goal, port diameter) through the same
 *  domain seam the typing drives, so the solver produces a vent length. */
export async function setFocusedVentedDesign(page: Page, design: {volume_m3: number; tuning_hz: number; diameter_m: number}): Promise<void> {
  await page.evaluate(async ({path, d}) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const p = m.requireFocusedProject();
    p.box.vented.volume_m3.set(d.volume_m3);
    p.box.vented.tuning_goal_hz.set(d.tuning_hz);
    p.box.vented.vent.diameter_m.set(d.diameter_m);
  }, {path: '/src/logic/appState.ts', d: design});
}

/** The focused bandpass6 rear chamber's tuning goal (Hz). */
export async function focusedBandpass6RearTuning(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const value = m.requireFocusedProject().box.bandpass6.chambers.rear.tuning_goal_hz.value;
    if (value === null) throw new Error('tuning_goal_hz has no value');
    return value;
  }, '/src/logic/appState.ts');
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
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const pr = m.requireFocusedProject().box.passiveRadiator;
    const spec = pr.radiator.spec;
    return {
      name: pr.radiator.model.value, count: pr.count.value,
      vas_m3: spec.Vas_m3.value, qms: spec.Qms.value, fs_hz: spec.Fs_hz.value,
      sd_m2: spec.Sd_m2.value, xmax_m: spec.Xmax_m.value,
    };
  }, '/src/logic/appState.ts');
}

/** The focused project's port air-velocity limit (m/s). */
export async function focusedPortVelocityLimit(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().portVelocityLimit_m_per_s.value;
  }, '/src/logic/appState.ts');
}

/** One driver spec value of the focused project's driver (SI units); fails when it has no value. */
export async function focusedDriverSpec(page: Page, field: 'Fs_hz' | 'Mms_kg'): Promise<number> {
  return page.evaluate(async ({path, f}): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const value = m.requireFocusedProject().driver.specs[f].value;
    if (value === null) throw new Error(`driver.specs.${f} has no value`);
    return value;
  }, {path: '/src/logic/appState.ts', f: field});
}

/** Open a second, independent project as a copy of the focused one, and focus it — the domain
 *  call behind the project list's "＋ Copy". */
export async function duplicateFocusedProject(page: Page, newName: string): Promise<void> {
  await page.evaluate(async ({path, name}) => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'duplicateFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.duplicateFocusedProject(name);
  }, {path: '/src/logic/appState.ts', name: newName});
}

/** The Options environment temperature (K) as the application settings hold it. */
export async function appEnvDefaultsTempK(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'envDefaults' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.envDefaults().tempK;
  }, '/src/logic/appState.ts');
}

/** The user name saved by the Options dialog. */
export async function savedUsername(page: Page): Promise<string | undefined> {
  return page.evaluate(async (path): Promise<string | undefined> => {
    type PresentationState = typeof import('../src/logic/presentationState.js');
    function isPresentationState(m: unknown): m is PresentationState {
      return typeof m === 'object' && m !== null && 'presentationState' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isPresentationState(m)) throw new Error('presentationState module shape mismatch');
    return m.presentationState.ui.username;
  }, '/src/logic/presentationState.ts');
}

/** The persisted display-unit token for the box volume field (`NumberField.BOX_VB_L`). */
export async function boxVolumeUnitToken(page: Page): Promise<string | undefined> {
  const rotation = await page.evaluate(async (path): Promise<Record<string, string>> => {
    type PresentationState = typeof import('../src/logic/presentationState.js');
    function isPresentationState(m: unknown): m is PresentationState {
      return typeof m === 'object' && m !== null && 'presentationState' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isPresentationState(m)) throw new Error('presentationState module shape mismatch');
    return {...m.presentationState.ui.unitTokens};
  }, '/src/logic/presentationState.ts');
  return NumberField.BOX_VB_L.unitTokenFor(rotation);
}

/** Set the app-wide chart frequency sweep range, as a drag-zoom does. */
export async function setSweepRange(page: Page, range: {min: number; max: number}): Promise<void> {
  await page.evaluate(async ({path, r}) => {
    type PresentationState = typeof import('../src/logic/presentationState.js');
    function isPresentationState(m: unknown): m is PresentationState {
      return typeof m === 'object' && m !== null && 'presentationState' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isPresentationState(m)) throw new Error('presentationState module shape mismatch');
    m.presentationState.sweepRange = r;
  }, {path: '/src/logic/presentationState.ts', r: range});
}

/** Sum of the latest computed SPL curve — changes whenever the swept response changes. */
export async function curvesSplSum(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'curvesData' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return (m.curvesData.value?.spl ?? []).reduce((a, b) => a + b, 0);
  }, '/src/logic/appState.ts');
}

/** Number of filters in the focused project's filter chain. */
export async function focusedFilterCount(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().filters.value.length;
  }, '/src/logic/appState.ts');
}

/** The focused project's drive power (W) — the one stored drive fact; voltage derives from it. */
export async function focusedPowerDrive_W(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const value = m.requireFocusedProject().powerDrive_W.value;
    if (value === null) throw new Error('powerDrive_W has no value');
    return value;
  }, '/src/logic/appState.ts');
}

/** The focused project's name. */
export async function focusedProjectName(page: Page): Promise<string> {
  return page.evaluate(async (path): Promise<string> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().name.value;
  }, '/src/logic/appState.ts');
}

/** Dirty the focused design: add a highpass filter and move the drive power off its 1 W reference. */
export async function dirtyFocusedDesign(page: Page): Promise<void> {
  await page.evaluate(async (path): Promise<void> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const project = m.requireFocusedProject();
    project.filters.set([...project.filters.value, { type: 'highpass', family: 'sos', order: 2, enabled: true, fc: 30, Q: 0.7 }]);
    project.powerDrive_W.set(250);
  }, '/src/logic/appState.ts');
}

/** The focused project serialised as `.owpr` JSON, saved first so the saved layer holds the design. */
export async function focusedProjectOwpr(page: Page): Promise<unknown> {
  return page.evaluate(async (path): Promise<unknown> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    const p = m.requireFocusedProject();
    // `saved` is the project baseline (empty) until the wizard's choices are committed.
    p.save();
    return JSON.parse(p.toOwprText());
  }, '/src/logic/appState.ts');
}

/** The focused project's driver added cone mass (kg). */
export async function focusedAddedMass_kg(page: Page): Promise<number> {
  return page.evaluate(async (path): Promise<number> => {
    type AppState = typeof import('../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    return m.requireFocusedProject().driverAddedMass_kg.value;
  }, '/src/logic/appState.ts');
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
