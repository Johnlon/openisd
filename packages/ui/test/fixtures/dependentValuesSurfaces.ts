import type {Browser, Page} from '@playwright/test';
import {editorTab, type EditorTab} from '../fixtures.js';
import {
  type BoxReadings, type SweepBoxType, type SweepValues, differences, expectedAfterEntry, sweepValues, type SweepInput, type SweepScreen, type SweepViewport,
  enterText, importSample, newReferencePage, openScreen, readAllBoxes,
} from './dependentValues.js';

/**
 * Dependent-value sweep, slice 3 (docs/plans/PLAN_20261117_DEPENDENT_VALUE_SWEEP.md): the surfaces that hold a draft or a
 * side panel: the Driver Editor (a modal; its values reach the project when OK is pressed) and the desktop What-if panel
 * (its values show on the charts and never reach the project). Everything acts as a user does: opens the surface from the
 * Driver tab, types, clicks tabs and buttons and reads the boxes on the screen.
 */

export type SurfaceName = 'driver-tab' | 'editor' | 'what-if';

export interface Surface {
  readonly name: SurfaceName;
  /** Opens the surface from the Driver tab (a no-op when it is already open). */
  readonly open: (page: Page, viewport: SweepViewport) => Promise<void>;
  /** Makes the tab holding the input visible (the editor's Parameters, Advanced or Dimensions). */
  readonly show: (page: Page, tab: string) => Promise<void>;
  /** Every box the surface itself shows. */
  readonly readInner: (page: Page) => Promise<BoxReadings>;
  /** The project screens are read while the surface is still open (a side panel); a modal covers them, so it is closed first. */
  readonly outerWhileOpen: boolean;
  /** The surface is a what-if: ending it must leave every project screen as it was before the visit. */
  readonly projectStaysUnchanged: boolean;
  /** Ends the visit the way a user keeps the work: OK for the editor; the What-if stays open. */
  readonly keep: (page: Page) => Promise<void>;
  /** Ends the whole journey: the What-if is closed; the others are already closed. */
  readonly finish: (page: Page) => Promise<void>;
  /** Ends the visit without keeping anything: Cancel for the editor, Close for the What-if. */
  readonly leave: (page: Page) => Promise<void>;
}

const EDITOR_TABS: readonly EditorTab[] = ['Parameters', 'Advanced', 'Dimensions'];

/** Every visible `[data-field]` box under `root`, in one evaluate. */
async function readUnder(page: Page, root: string, prefix: string): Promise<BoxReadings> {
  return page.evaluate(({rootSel, name}) => {
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
      out.push({key: `${name}|${fieldName}#${nth}`, value: box.value, calculated, refused});
    }
    return out;
  }, {rootSel: root, name: prefix});
}

const EDITOR: Surface = {
  name: 'editor',
  outerWhileOpen: false,
  projectStaysUnchanged: false,
  open: async (page, viewport) => {
    if (await page.locator('.de-modal').isVisible()) return;
    if (viewport === 'phone') {
      await page.locator('.mob-tab', {hasText: /^Driver$/}).click();
      await page.locator('.mob-cbtns .mob-btn', {hasText: /^Edit$/}).click();
    } else {
      await page.locator('.project-nav li', {hasText: /^Driver$/}).click();
      await page.locator('.edit-btn[title^="Full editor for this driver"]').click();
    }
    await page.locator('.de-body').waitFor({state: 'visible'});
  },
  show: async (page, tab) => {
    const known = EDITOR_TABS.find(t => t === tab);
    if (known === undefined) throw new Error(`no editor tab ${tab}`);
    await editorTab(page, known);
  },
  readInner: async page => {
    const all: BoxReadings[] = [];
    for (const tab of EDITOR_TABS) {
      await editorTab(page, tab);
      all.push(await readUnder(page, '.de-modal', `Editor ${tab}`));
    }
    return all.flat();
  },
  finish: async () => { /* closed after every visit */ },
  keep: async page => {
    await page.locator('.de-footer button.pri', {hasText: 'OK'}).click();
    await page.locator('.de-body').waitFor({state: 'hidden'});
  },
  leave: async page => {
    await page.locator('.de-footer button', {hasText: 'Cancel'}).click();
    await page.locator('.de-body').waitFor({state: 'hidden'});
  },
};

const WHAT_IF: Surface = {
  name: 'what-if',
  outerWhileOpen: true,
  projectStaysUnchanged: true,
  open: async page => {
    if (await page.locator('.what-if-panel').isVisible()) return;
    await page.locator('.project-nav li', {hasText: /^Driver$/}).click();
    await page.locator('.save-rail .what-if-btn').click();
    await page.locator('.what-if-panel').waitFor({state: 'visible'});
  },
  show: async () => { /* one panel, no tabs */ },
  readInner: page => readUnder(page, '.what-if-panel', 'What-if'),
  finish: async page => {
    await page.locator('.what-if-panel button', {hasText: 'Close'}).click();
    await page.locator('.what-if-panel').waitFor({state: 'hidden'});
  },
  keep: async () => { /* the What-if stays open: nothing is kept */ },
  leave: async page => {
    await page.locator('.what-if-panel button', {hasText: 'Close'}).click();
    await page.locator('.what-if-panel').waitFor({state: 'hidden'});
  },
};

/** The Driver tab itself: typing happens on the tab, so there is nothing to open or keep; the project screens are the read-out. */
const DRIVER_TAB: Surface = {
  name: 'driver-tab',
  outerWhileOpen: true,
  projectStaysUnchanged: false,
  open: (page, viewport) => openScreen(page, viewport, {name: 'Driver', tab: /^Driver$/}),
  show: async () => { /* no sub-tabs */ },
  readInner: async () => [],
  finish: async () => { /* nothing to close */ },
  keep: async () => { /* typed values are in force at once */ },
  leave: async () => { /* nothing to close */ },
};

export function surfaceOf(name: SurfaceName): Surface {
  return name === 'editor' ? EDITOR : name === 'what-if' ? WHAT_IF : DRIVER_TAB;
}

/** What one visit shows: the surface's own boxes while open, and the project screens after the visit is kept. */
export interface Visit {
  readonly inner: BoxReadings;
  readonly outer: BoxReadings;
}

/** Reads until two reads in a row agree: the surface is closed straight after, so it cannot be polled by the test. */
async function settled(read: () => Promise<BoxReadings>): Promise<BoxReadings> {
  let previous = JSON.stringify(await read());
  for (let attempt = 0; attempt < 40; attempt++) {
    const now = await read();
    const text = JSON.stringify(now);
    if (text === previous) return now;
    previous = text;
  }
  return read();
}

/** Types `text` into the input on the open surface, reads the surface, keeps the work and reads the project screens. */
export async function visit(page: Page, viewport: SweepViewport, surface: Surface, input: SweepInput, tab: string, screens: readonly SweepScreen[], text: string | null): Promise<Visit> {
  await surface.open(page, viewport);
  if (text !== null) {
    await surface.show(page, tab);
    await enterText(input.locate(page), text);
  }
  const inner = await settled(() => surface.readInner(page));
  const whileOpen = surface.outerWhileOpen ? await readAllBoxes(page, viewport, screens) : null;
  if (text === null) await surface.leave(page); else await surface.keep(page);
  return {inner, outer: whileOpen ?? await readAllBoxes(page, viewport, screens)};
}

/** The same visit made in a fresh browser context holding only this entry, in the same sample project. */
export async function freshVisit(
  browser: Browser, baseURL: string, viewport: SweepViewport, type: SweepBoxType, surface: Surface,
  input: SweepInput, tab: string, screens: readonly SweepScreen[], text: string,
): Promise<Visit> {
  const page = await newReferencePage(browser, baseURL, viewport);
  try {
    await page.goto('/');
    await page.locator('.original-root, .mobile-root').first().waitFor({state: 'visible'});
    await importSample(page, viewport);
    await openScreen(page, viewport, {name: 'Box', tab: /^Box$/});
    await page.locator('#og-box-type, #mob-box-type').selectOption(type);
    return await visit(page, viewport, surface, input, tab, screens, text);
  } finally {
    await page.context().close();
  }
}


/** The box where the input sits, as it reads at the start; a missing box means the screen is not what the journey assumes. */
export function startingBox(start: Visit, key: string, label: string): BoxReadings[number] {
  const found = [...start.inner, ...start.outer].find(r => r.key === key);
  if (found === undefined) throw new Error(`${label}: no box ${key} on the screen at the start`);
  return found;
}

/** Plain digits for a number written with an exponent: a box takes no letter 'e'. */
function plain(text: string): string {
  return /e/i.test(text) ? Number(text).toLocaleString('en-US', {useGrouping: false, maximumFractionDigits: 20}) : text;
}

/**
 * What to type: a count list offers only its own options; a number box gets the five steps. A box that starts blank (the datasheet gave no
 * value) is swept from 1, so the normal and tiny entries are real values. A field whose limit is the largest number there is (most driver T/S
 * fields) would be typed as 1.79769e+308: a box takes no letter 'e', so the entry reverts with no refusal mark and is not something a person
 * can type; for these the "top" is a plain huge entry (1e9) and the "absurd high" 1e30, both inside the limit. Every step is plain digits.
 */
export function entrySteps(input: SweepInput, original: string, options: readonly string[]): ReadonlyArray<readonly [string, string]> {
  if (options.length > 0) return options.filter(o => o !== original).map(o => [`option ${o}`, o] as const);
  const swept: SweepValues = sweepValues(input, original.trim() === '' ? '1' : original);
  const v = input.field.limits.max >= 1e100 ? {...swept, top: '1000000000', high: '1000000000000000000000000000000'} : swept;
  return [['normal', v.normal], ['tiny', v.tiny], ['top', v.top], ['high', v.high], ['low', v.low]].map(([step, text]) => [step ?? '', plain(text ?? '')] as const);
}

/** Whether a box shows the text that was typed, within the rounding of what it shows (half a unit of the last digit, or half a percent). */
function showsText(shown: string, typed: string): boolean {
  if (shown.trim() === '' || typed.trim() === '') return shown.trim() === typed.trim();
  const a = Number(shown), b = Number(typed);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return shown === typed;
  const decimals = shown.includes('.') ? shown.length - shown.indexOf('.') - 1 : 0;
  return Math.abs(a - b) <= Math.max(0.005 * Math.max(Math.abs(a), Math.abs(b)), 0.5 * 10 ** -decimals);
}

export interface Judgement {
  readonly expectedInner: BoxReadings;
  readonly expectedOuter: BoxReadings;
  /** The readings of the last accepted entry after this one. */
  readonly accepted: Visit;
}

/**
 * What every box must show after `text` is typed, given a fresh project's visit with that entry and the last accepted visit. A box refuses an
 * entry in one of two ways: it stays marked bad with the typed text, or it goes back to the value it held before (the editor does this: Xmax
 * 5000 puts 9.25 back, and the box is not marked). Either leaves the last accepted entry in force on the project.
 */
export function judge(typed: Visit, accepted: Visit, homeKey: string, text: string, original: string): Judgement {
  const refusedInner = typed.inner.some(r => r.refused);
  const refusedOuter = typed.outer.some(r => r.refused);
  const home = [...typed.inner, ...typed.outer].find(r => r.key === homeKey);
  const reverted = !refusedInner && !refusedOuter && home !== undefined && !showsText(home.value, text) && home.value === original;
  const expectedInner = reverted ? accepted.inner : expectedAfterEntry(typed.inner, accepted.inner);
  const expectedOuter = reverted ? accepted.outer : refusedOuter ? expectedAfterEntry(typed.outer, accepted.outer) : refusedInner ? accepted.outer : typed.outer;
  return {expectedInner, expectedOuter, accepted: refusedInner || refusedOuter || reverted ? accepted : typed};
}

/** Differences between what the live surface showed and what a fresh project shows, for the surface's own boxes. */
export function innerProblems(expected: BoxReadings, live: Visit): string[] {
  return differences(expected, live.inner, 'exact', true);
}

/** The What-if never changes the project: once it is closed, the project screens must read as they did before any entry. */
export async function projectProblems(page: Page, viewport: SweepViewport, surface: Surface, screens: readonly SweepScreen[], startClosed: BoxReadings): Promise<string[]> {
  return surface.projectStaysUnchanged ? differences(startClosed, await readAllBoxes(page, viewport, screens), 'exact', true) : [];
}
