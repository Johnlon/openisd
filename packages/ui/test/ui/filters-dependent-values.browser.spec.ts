import type {Page} from '@playwright/test';
import {chartPicture, expect, expectChartDrawn, test} from '../fixtures.js';
import {PHONE_FILTER_CHIPS} from '@openisd/design/fields';
import type {BoxReadings} from '../fixtures/dependentValues.js';
import type {FilterType} from '@openisd/design/engine';
import {
  backAtStart, differences, field, openScreen, openSweepProject, readAllBoxes,
  type SweepInput, type SweepScreen, type SweepViewport,
} from '../fixtures/dependentValues.js';
import {entrySteps, freshVisit, innerProblems, judge, startingBox, visit, type Surface} from '../fixtures/dependentValuesSurfaces.js';

/**
 * Dependent-value sweep, slice 4: the Filters tab (docs/plans/PLAN_20261117_DEPENDENT_VALUE_SWEEP.md; John, 17 Nov 2026: "add more aggressive
 * testing for this style of bug across the app"). Same method as slices 1 to 3: per input the steps normal, tiny, top accepted, absurdly high,
 * absurdly low, then the original typed back; after each step every box on the Filters, Box, (Vented,) Signal and Driver screens is read and must
 * equal a fresh browser context holding only that one entry typed into the same sample project with the same filter added; after the last step no
 * calculated box is refused and every box is back at its start. On the desktop the first chart is also read: it must be redrawn when an accepted
 * entry changes the filter's curve and must be the starting picture again after the original is typed back.
 *
 * Inputs found from the editors, never guessed: one row per number box of each filter type the app offers (PHONE_FILTER_CHIPS: the quick-add
 * buttons on the desktop and the chips on the phone), desktop `original/filters/*Editor.vue`, phone `mobile/filters/*Fields.vue`. The type
 * pickers (the Lowpass or Highpass family, shelf kind) are not number boxes.
 */

/** The number boxes of each filter type, by the label both skins show. The phone shows its frequencies in whole hertz (its own field). */
const ROWS: Readonly<Record<FilterType, readonly string[]>> = {
  lowpass: ['Order', 'Q', 'Cutoff'],
  highpass: ['Order', 'Q', 'Cutoff'],
  allpass: ['Order', 'Q', 't'],
  linkwitz: ['f0', 'Q0', 'fp', 'Qp'],
  peaking: ['fc', 'Gain', 'Q'],
  peakHighpass: ['Gpk', 'fpk'],
  staticGain: ['Gain'],
  raisedCosine: ['fc', 'Gain', 'BW'],
  lowshelf: ['fc', 'Q', 'Gain'],
  highshelf: ['fc', 'Q', 'Gain'],
};

/** What each number box's NumberField is, by label, on each skin. */
const KEY: Readonly<Record<string, string>> = {
  Order: 'filter_Order', Q: 'filter_Q', Q0: 'filter_Q', Qp: 'filter_Q', t: 'filter_T_s', Gain: 'filter_Gain_dB', Gpk: 'filter_Gain_dB', BW: 'filter_BW_oct',
  Cutoff: 'filter_Fc_hz', fc: 'filter_Fc_hz', f0: 'filter_Fc_hz', fp: 'filter_Fc_hz', fpk: 'filter_Fc_hz',
};
const PHONE_KEY: Readonly<Record<string, string>> = {...KEY, Cutoff: 'phone_Filter_Fc_hz', fc: 'phone_Filter_Fc_hz', f0: 'phone_Filter_Fc_hz', fp: 'phone_Filter_Fc_hz', fpk: 'phone_Filter_Fc_hz'};

/** Journeys that fail because of an app bug: the bug file, red until fixed (`test.fail`). Key: "<viewport> <filter type> <input label>". */
const KNOWN: ReadonlyMap<string, string> = new Map([]);

/**
 * Inputs that cannot change the SPL chart (the first chart, the one on screen) in the state the filter is added in, so after a normal change the chart
 * must be the same picture, not a new one. A Butterworth lowpass or highpass is fixed by its order and cutoff: Q is read by the User SOS family only
 * (PassFilterModel). An allpass has a flat magnitude whatever its order, Q and delay: those change the phase and the group delay, not the SPL plotted.
 */
const NO_SPL_EFFECT: ReadonlySet<string> = new Set(['lowpass Q', 'highpass Q', 'allpass Order', 'allpass Q', 'allpass t']);

function baseUrl(): string {
  const port = process.env.OPENISD_TEST_PORT;
  return port ? `http://localhost:${port}` : 'http://localhost:4100';
}

const FILTERS_SCREEN: SweepScreen = {name: 'Filters', tab: /^Filters$/};
const BOX_SCREEN: SweepScreen = {name: 'Box', tab: /^Box$/};
const DESKTOP_SCREENS: readonly SweepScreen[] = [BOX_SCREEN, {name: 'Vented', tab: /^Vented$/}, {name: 'Signal', tab: /^Signal$/}, {name: 'Driver', tab: /^Driver$/}];
const PHONE_SCREENS: readonly SweepScreen[] = [BOX_SCREEN, {name: 'Signal', tab: /^Signal$/}, {name: 'Driver', tab: /^Driver$/}];

/** Every visible `[data-field]` box under `root`, in one evaluate. The Filters tab is read while it is still open: a refused entry is shown only until the tab is left. */
async function readUnder(page: Page, root: string): Promise<BoxReadings> {
  return page.evaluate(rootSel => {
    const seen = new Map<string, number>();
    const out: Array<{key: string; value: string; calculated: boolean; refused: boolean}> = [];
    const scope = globalThis.document.querySelector(rootSel);
    if (scope === null) return out;
    for (const wrap of scope.querySelectorAll<HTMLElement>('[data-field]')) {
      if (!wrap.checkVisibility()) continue;
      const box = wrap.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
      if (box === null) continue;
      const fieldName = wrap.getAttribute('data-field') ?? '';
      const nth = seen.get(fieldName) ?? 0;
      seen.set(fieldName, nth + 1);
      const calculated = box.classList.contains('calculated') || box.classList.contains('value-c');
      const refused = box.classList.contains('inp-bad') || wrap.querySelector('.ui-field-note:not(.ui-field-note-warning)') !== null;
      out.push({key: `Filters|${fieldName}#${nth}`, value: box.value, calculated, refused});
    }
    return out;
  }, root);
}

/** The Filters tab holding one filter of a type: opening it adds the filter the way a user does (the quick-add button) when the project has none. */
function filtersSurface(type: FilterType): Surface {
  const chip = PHONE_FILTER_CHIPS.find(c => c.type === type);
  if (chip === undefined) throw new Error(`no filter chip for ${type}`);
  return {
    name: 'driver-tab',
    outerWhileOpen: true,
    projectStaysUnchanged: false,
    open: async (page, viewport) => {
      await openScreen(page, viewport, FILTERS_SCREEN);
      const added = viewport === 'phone' ? page.locator('.mob-fcard') : page.locator('.filter-row-inline');
      if (await added.count() === 0) {
        if (viewport === 'phone') await page.locator('.mob-fstrip .mob-btn', {hasText: new RegExp(`^\\+ ${chip.short}$`)}).click();
        else await page.locator('.filters-quickadd .action-btn', {hasText: new RegExp(`^\\+ ${chip.short}$`)}).click();
      }
      // The desktop row is open for editing after it is added; a row that was folded (the user left the tab) is opened by a click on its summary.
      if (viewport === 'desktop' && await page.locator('.filter-edit-body').count() === 0) await page.locator('.filter-summary').first().click();
    },
    show: async () => { /* one editor, no sub-tabs */ },
    readInner: page => readUnder(page, '.og-filters, .mob-fcard'),
    finish: async () => { /* nothing to close */ },
    keep: async () => { /* typed values are in force at once */ },
    leave: async () => { /* nothing to close */ },
  };
}

const locateRow = (label: string) => (page: Page) =>
  page.locator('.filter-edit-body .ui-field, .mob-fcard-body .ui-field').filter({has: page.locator('label').filter({hasText: new RegExp(`^${label}$`)})}).locator('input[data-numinput]:visible').first();

/** The chart's picture; the phone shows no chart beside the Filters tab, so every phone reading is the same text. */
async function chartNow(page: Page, viewport: SweepViewport): Promise<string> {
  if (viewport === 'phone') return 'no chart beside the phone Filters tab';
  // A flash message ("Project imported") sits over the chart for a few seconds and is part of its picture.
  await expect(page.locator('.flash')).toHaveCount(0);
  await expectChartDrawn(page);
  let last = '';
  await expect.poll(async () => { const now = await chartPicture(page); const same = now === last; last = now; return same; }, {message: 'the chart has stopped changing'}).toBe(true);
  return last;
}

for (const viewport of ['desktop', 'phone'] as const satisfies readonly SweepViewport[]) {
  const screens = viewport === 'desktop' ? DESKTOP_SCREENS : PHONE_SCREENS;
  for (const chip of PHONE_FILTER_CHIPS) {
    const surface = filtersSurface(chip.type);

    test.describe(`${viewport} ${chip.short} filter: every box follows its inputs`, () => {
      for (const label of ROWS[chip.type]) {
        const name = `${viewport} ${chip.type} ${label}`;
        const key = (viewport === 'phone' ? PHONE_KEY : KEY)[label] ?? '';
        const input: SweepInput = {label, field: field(key), screen: 'Filters', locate: locateRow(label)};
        /** Whether a normal change must draw a new SPL picture: only on the desktop, and not for an input that cannot change it. */
        const chartChanges = viewport === 'desktop' && !NO_SPL_EFFECT.has(`${chip.type} ${label}`);
        const homeKey = `Filters|${key}#${ROWS[chip.type].filter(l => (viewport === 'phone' ? PHONE_KEY : KEY)[l] === key).indexOf(label)}`;

        test(`${label}: normal, tiny, top, absurdly high, absurdly low, back`, async ({appPage: page, browser}) => {
          test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
          await openSweepProject(page, viewport, 'vented');

          const start = await visit(page, viewport, surface, input, '', screens, null);
          const home = startingBox(start, homeKey, label);
          const original = home.value;
          const startedCalculated = home.calculated;
          await surface.open(page, viewport);
          const startChart = await chartNow(page, viewport);

          let accepted = start;
          const pictures = new Map<string, string>();
          for (const [step, text] of entrySteps(input, Number(original) === 0 ? '1' : original, [])) {
            const live = await visit(page, viewport, surface, input, '', screens, text);
            const typed = await freshVisit(browser, baseUrl(), viewport, 'vented', surface, input, '', screens, text);
            const verdict = judge(typed, accepted, homeKey, text, original);
            accepted = verdict.accepted;
            const surfaceDiffs = innerProblems(verdict.expectedInner, live);
            await expect.poll(async () => [...surfaceDiffs, ...differences(verdict.expectedOuter, await readAllBoxes(page, viewport, screens), 'exact', true)],
              {message: `${label} typed ${step} (${text}): every box must show what a fresh project shows`, timeout: 20_000}).toEqual([]);
            await surface.open(page, viewport);
            pictures.set(step, await chartNow(page, viewport));
          }
          expect(pictures.get('normal') !== startChart, `${label}: the chart is ${chartChanges ? 'redrawn' : 'the same picture'} after a normal change`).toBe(chartChanges);

          const back = await visit(page, viewport, surface, input, '', screens, original);
          const fresh = await freshVisit(browser, baseUrl(), viewport, 'vented', surface, input, '', screens, original);
          const backSurface = backAtStart(start.inner, fresh.inner, back.inner, startedCalculated);
          await expect.poll(async () => [...backSurface, ...backAtStart(start.outer, fresh.outer, await readAllBoxes(page, viewport, screens), startedCalculated)],
            {message: `${label} typed back to ${original}: no calculated box refused, every box back to its start`, timeout: 20_000}).toEqual([]);
          await surface.open(page, viewport);
          expect(await chartNow(page, viewport), `${label}: the chart is the starting picture again`).toBe(startChart);
        });
      }
    });
  }
}
