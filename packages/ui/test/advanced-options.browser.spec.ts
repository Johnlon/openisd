/**
 * WinISD Advanced-pane simulation options, in the real app.
 *
 * These five checkboxes shipped inert in two skins — bound to shell-local refs nothing
 * read. `inert-control-gate.test.ts` stops that statically; these tests prove the other
 * half: that ticking the box in a browser actually moves the simulation. A DOM assertion
 * that the checkbox is checked would have passed on the broken version too, so every test
 * here reads the store's real sweep output after the interaction.
 *
 * Design: PLAN_ADVANCED_SIM_OPTIONS.md.
 */
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

// Module specifiers as variables: the app modules are served by Vite at runtime, so a
// literal path here would be resolved (and rejected) by tsc at build time.
const STORE  = '/src/store.ts';
const SERIES = '/src/utils/series.ts';

/** The live sweep the charts are drawing, read out of the store. */
async function curves(page: Page): Promise<{
  spl: number[]; splXlim: number[]; xlimited: boolean[]; zmag: number[];
  exc: number[]; pv: number[]; flatClamped: number | null;
}> {
  return await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod);
    const c = s.curvesData.value;
    return { spl: c.spl, splXlim: c.splXlim, xlimited: c.xlimited, zmag: c.zmag,
             exc: c.exc, pv: c.pv, flatClamped: c.flatClamped };
  }, STORE);
}

/**
 * A cheap fingerprint of the drawn curves. The store throttles the sweep, so tests wait for
 * this to CHANGE rather than sleeping for a guessed interval — a fixed delay would be both
 * slower and flaky under load.
 */
async function sweepToken(page: Page): Promise<string> {
  return await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod);
    const c = s.curvesData.value;
    return JSON.stringify([c.spl[0], c.spl[200], c.spl[c.spl.length - 1], c.exc[200], c.pv[200], c.zmag[200]]);
  }, STORE);
}

/** Block until the throttled sweep has produced curves different from `prev`. */
async function waitForResweep(page: Page, prev: string): Promise<void> {
  await page.waitForFunction(async ([mod, p]) => {
    const s = await import(/* @vite-ignore */ mod as string);
    const c = s.curvesData.value;
    return JSON.stringify([c.spl[0], c.spl[200], c.spl[c.spl.length - 1], c.exc[200], c.pv[200], c.zmag[200]]) !== p;
  }, [STORE, prev] as [string, string]);
}

/** Set design parameters directly — the arrange step, never the act step. */
async function setP(page: Page, patch: Record<string, unknown>): Promise<void> {
  const before = await sweepToken(page);
  await page.evaluate(async ([mod, p]) => {
    const s = await import(/* @vite-ignore */ mod as string);
    Object.assign(s.state.P, p);
  }, [STORE, patch] as const);
  await waitForResweep(page, before);
}

/** Largest absolute difference between two curves — 0 means nothing moved. */
const maxDiff = (a: number[], b: number[]) =>
  a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await page.waitForFunction(() => (window as unknown as { _selfTestDone?: boolean })._selfTestDone === true);
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
});

/** The Advanced pane's checkbox by its WinISD label. */
const check = (page: Page, label: string) =>
  page.locator('.tab-section.active .adv-options label', { hasText: label }).locator('input[type=checkbox]');

test('all five Advanced toggles are present and none is inert', async ({ page }) => {
  for (const label of [
    'Simulate voice coil inductance',
    'Force flat response',
    'Use "transmission line"-model for port simulation',
    'Rg is at driver side',
    'SPL graph is Xmax limited',
  ]) await expect(check(page, label), `missing: ${label}`).toBeVisible();

  // Every one carries a tooltip describing its effect (ARCHITECTURE.md UI-1).
  const titles = await page.locator('.tab-section.active .adv-options label').evaluateAll(
    els => els.map(e => e.getAttribute('title') || ''));
  expect(titles.filter(t => t.length > 20)).toHaveLength(5);
});

test('"Simulate voice coil inductance" moves the acoustic response and tracks the circuit model', async ({ page }) => {
  const token = await sweepToken(page);
  const before = await curves(page);
  await check(page, 'Simulate voice coil inductance').check();
  await waitForResweep(page, token);
  const after = await curves(page);
  // Le entering the acoustic path attenuates the top end — the demo driver's 0.7 mH is
  // ~4.4 Ω at 1 kHz against Re = 5.6 Ω, so this is a visible change, not a rounding wobble.
  expect(maxDiff(after.spl, before.spl)).toBeGreaterThan(0.5);

  // It is the SAME setting as SignalPanel's circuit-model select, not a second flag.
  const model = await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod);
    return s.state.P.circuitModel;
  }, STORE);
  expect(model).toBe('gyrator');
});

test('"Force flat response" flattens the SPL curve and charges the boost to excursion', async ({ page }) => {
  const before = await curves(page);
  const spread = (a: number[]) => {
    const real = a.filter(v => Number.isFinite(v) && v > -190);
    return Math.max(...real) - Math.min(...real);
  };
  expect(spread(before.spl), 'the un-EQ\'d response must roll off before we flatten it').toBeGreaterThan(10);

  const token = await sweepToken(page);
  await check(page, 'Force flat response').check();
  await waitForResweep(page, token);
  const after = await curves(page);

  expect(spread(after.spl), 'the EQ\'d response should be far flatter').toBeLessThan(spread(before.spl));
  expect(maxDiff(after.exc, before.exc), 'the boost must show up as extra cone travel').toBeGreaterThan(0);
  expect(maxDiff(after.zmag, before.zmag), 'a line-level EQ must not move the impedance').toBe(0);
  // A vented rolloff needs far more than the 20 dB ceiling, so the clamp must bind AND say so.
  expect(after.flatClamped).not.toBeNull();
  const warnings = await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod);
    return s.curveIssues.value.map((e: { message: string }) => e.message);
  }, STORE);
  expect(warnings.join(' ')).toContain('Force-flat');
});

test('the transmission-line port model changes port behaviour, and is offered only for a vented box', async ({ page }) => {
  // A long port puts its half-wave resonance inside the sweep, where the models diverge.
  await setP(page, { ventL: 0.30, ventD: 0.05, fmax: 2000 });
  const before = await curves(page);

  const token = await sweepToken(page);
  await check(page, 'Use "transmission line"-model for port simulation').check();
  await waitForResweep(page, token);
  const after = await curves(page);
  // Compare as a RATIO, not an absolute delta: the duct's half-wave resonance sits far above
  // the passband, where port velocity is small in m/s but changes by orders of magnitude.
  const pvRatio = after.pv.reduce((m, v, i) => Math.max(m, v / Math.max(before.pv[i], 1e-9)), 0);
  expect(pvRatio, 'the port air velocity must respond to the pipe resonance').toBeGreaterThan(5);

  // A sealed box has no port to model, so the control says so instead of pretending.
  await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod);
    s.state.box = 'sealed';
  }, STORE);
  await expect(check(page, 'Use "transmission line"-model for port simulation')).toBeDisabled();
});

test('"Rg is at driver side" moves the response once more than one driver is wired', async ({ page }) => {
  // The n = 1 case is an EXACT no-op and is asserted bit-for-bit in the engine suite
  // (advanced-options.test.ts); what needs proving in a browser is that the checkbox
  // reaches the sweep at all, which needs a case where the physics actually differs.
  await setP(page, { Rs: 1.0, nDrivers: 2, wiring: 'parallel' });
  const token = await sweepToken(page);
  const atDriver = await curves(page);

  await check(page, 'Rg is at driver side').uncheck();
  await waitForResweep(page, token);
  const atAmp = await curves(page);

  // One Rg carrying both drivers' current is the heavier loss than Rg/2 seen per driver.
  expect(maxDiff(atAmp.spl, atDriver.spl)).toBeGreaterThan(0.1);
  expect(atAmp.spl[atAmp.spl.length - 1]).toBeLessThan(atDriver.spl[atDriver.spl.length - 1]);
});

test('"SPL graph is Xmax limited" swaps the plotted curve for the achievable one', async ({ page }) => {
  await setP(page, { Pin: 400 });                     // drive hard enough to run out of Xmax
  const c = await curves(page);
  expect(c.xlimited.some(Boolean), 'the drive should exceed Xmax somewhere').toBe(true);

  // The engine always computes both curves; the toggle chooses which the SPL chart draws.
  const plotted = async () => await page.evaluate(async ([storeMod, seriesMod]) => {
    const s = await import(/* @vite-ignore */ storeMod);
    const { buildPlotData } = await import(/* @vite-ignore */ seriesMod);
    const d = { driver: s.driver.value, box: s.state.box, P: s.syncedP.value,
                curves: s.curvesData.value, maxCurves: s.maxData.value };
    const pd = buildPlotData('SPL', 10, 20000, d, []);
    return { name: pd.value.series[0].name, ys: pd.value.series[0].ys, count: pd.value.series.length };
  }, [STORE, SERIES]);

  const raw = await plotted();
  expect(raw.name).toBe('SPL');

  await check(page, 'SPL graph is Xmax limited').check();
  await expect.poll(async () => (await plotted()).name).toBe('SPL (Xmax limited)');
  const limited = await plotted();
  expect(limited.name).toBe('SPL (Xmax limited)');
  expect(maxDiff(limited.ys, raw.ys)).toBeGreaterThan(0.5);
  // The raw curve is kept alongside, dashed, so the cost of the limit is visible.
  expect(limited.count).toBeGreaterThan(raw.count);
});

test('the Advanced toggles survive a reload — they are design state, not view state', async ({ page }) => {
  await check(page, 'Force flat response').check();
  await check(page, 'Rg is at driver side').uncheck();
  // Wait for the persistence watcher to have written, rather than guessing a delay.
  await expect.poll(async () => await page.evaluate(
    () => (localStorage.getItem('openisd.state') || '').includes('"forceFlatResponse":true'))).toBe(true);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { _selfTestDone?: boolean })._selfTestDone === true);
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  await expect(check(page, 'Force flat response')).toBeChecked();
  await expect(check(page, 'Rg is at driver side')).not.toBeChecked();
});
