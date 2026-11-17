import type {Browser, Locator, Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {NumberField} from '@openisd/design/fields';
import {ensureSampleProject, SAMPLE_PROJECT_OWPR} from './sampleProject.js';
import {standInForSnapshotsSite} from './snapshotsSite.js';
import {fillAndCommit} from './numField.js';
import {openAMobileProject, openAProject, setFocusedBoxType} from '../fixtures.js';
import {forceMobileSkin} from './mobileSkin.js';

/**
 * Dependent-value sweep helpers (plan: docs/plans/PLAN_20261117_DEPENDENT_VALUE_SWEEP.md).
 * One journey types an input to a normal value, an absurdly high one, an absurdly low one and back; after every step
 * every `[data-field]` box on the screen is read in one `evaluate` and compared with what a clean project shows when
 * that same input is typed into it. Everything here acts as a user does: it types, clicks tabs and reads the screen.
 */

export type SweepViewport = 'desktop' | 'phone';
export type SweepBoxType = 'sealed' | 'vented' | 'bandpass4' | 'bandpass6' | 'abc' | 'box-passive-radiator';

export interface BoxReading {
  readonly key: string;
  readonly value: string;
  readonly calculated: boolean;
  /** The refused-entry state: the box is outlined bad, or shows a refusal note. */
  readonly refused: boolean;
}

export type BoxReadings = readonly BoxReading[];

/** A screen the journey reads after each step: a desktop project tab, or the phone's one Box tab. */
export interface SweepScreen {
  readonly name: string;
  /** The desktop `.project-nav` tab label, or the phone `.mob-tab` label. */
  readonly tab: RegExp;
}

export interface SweepInput {
  readonly label: string;
  readonly field: NumberField;
  readonly screen: string;
  /** Finds the input on the open screen. */
  readonly locate: (page: Page) => Locator;
}

const PHONE = {width: 374, height: 705};

export function field(key: string): NumberField {
  const found = NumberField.named(key);
  if (found === undefined) throw new Error(`no NumberField named ${key}`);
  return found;
}

/** The desktop screens of a box type: the Box tab and the tab holding its vent/port block. */
export function desktopScreens(type: SweepBoxType): readonly SweepScreen[] {
  const box: SweepScreen = {name: 'Box', tab: /^Box$/};
  const second: ReadonlyMap<SweepBoxType, SweepScreen> = new Map([
    ['vented', {name: 'Vented', tab: /^Vented$/}],
    ['bandpass4', {name: '4th Order Bandpass', tab: /^4th Order Bandpass$/}],
    ['bandpass6', {name: '6th Order Bandpass', tab: /^6th Order Bandpass$/}],
    ['abc', {name: 'ABC', tab: /^ABC$/}],
    ['box-passive-radiator', {name: 'Passive Radiator', tab: /^Passive Radiator$/}],
  ]);
  const other = second.get(type);
  return other === undefined ? [box] : [box, other];
}

export function phoneScreens(): readonly SweepScreen[] {
  return [{name: 'Box', tab: /^Box$/}];
}

export async function openScreen(page: Page, viewport: SweepViewport, screen: SweepScreen): Promise<void> {
  if (viewport === 'phone') {
    // The phone's Advanced screen is a pane opened from the menu, not a tab; the pane covers the tab bar until closed.
    const pane = page.locator('.mob-dlg');
    if (await pane.isVisible()) await pane.locator('.mob-dlg-close').click();
    if (screen.name === 'Advanced') {
      await page.locator('.mob-hamburger').click();
      await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
      await pane.waitFor({state: 'visible'});
    } else await page.locator('.mob-tab', {hasText: screen.tab}).click();
  } else await page.locator('.project-nav li', {hasText: screen.tab}).click();
}

/** Every visible `[data-field]` box on the open screen, read in one evaluate. */
async function readOpenScreen(page: Page, prefix: string): Promise<BoxReadings> {
  return page.evaluate(screenName => {
    const seen = new Map<string, number>();
    const out: Array<{key: string; value: string; calculated: boolean; refused: boolean}> = [];
    // A phone pane (Advanced) covers the tab beneath it: a person sees and reads only the pane.
    const pane = globalThis.document.querySelector<HTMLElement>('.mob-dlg');
    const scope: ParentNode = pane !== null && pane.checkVisibility() ? pane : globalThis.document;
    for (const wrap of scope.querySelectorAll<HTMLElement>('[data-field]')) {
      if (!wrap.checkVisibility()) continue;
      const box = wrap.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
      if (box === null) continue;
      const name = wrap.getAttribute('data-field') ?? '';
      const nth = seen.get(name) ?? 0;
      seen.set(name, nth + 1);
      const calculated = box.classList.contains('calculated') || box.classList.contains('value-c');
      const refused = box.classList.contains('inp-bad') || wrap.querySelector('.ui-field-note:not(.ui-field-note-warning)') !== null;
      out.push({key: `${screenName}|${name}#${nth}`, value: box.value, calculated, refused});
    }
    return out;
  }, prefix);
}

/** Every box on every screen of the box type, visiting each tab as a user does. */
export async function readAllBoxes(page: Page, viewport: SweepViewport, screens: readonly SweepScreen[]): Promise<BoxReadings> {
  const all: BoxReading[] = [];
  for (const screen of screens) {
    await openScreen(page, viewport, screen);
    all.push(...await readOpenScreen(page, screen.name));
  }
  return all;
}

/** Normal, absurdly high and absurdly low entries for a field, typed in its display unit. */
export interface SweepValues {
  readonly normal: string;
  /** A tiny entry the field accepts: what makes a calculated value (a port length) run past its own limit. */
  readonly tiny: string;
  /** The highest entry the field accepts. */
  readonly top: string;
  readonly high: string;
  readonly low: string;
}

function trimmed(n: number): string {
  return String(Number(n.toPrecision(6)));
}

export function sweepValues(input: SweepInput, original: string): SweepValues {
  const f = input.field;
  const originalNumber = Number(original);
  const topDisplay = f.toDisplay(f.limits.max);
  const grown = originalNumber * 1.25;
  const normal = grown > topDisplay || grown === originalNumber ? originalNumber * 0.8 : grown;
  const high = f.toDisplay(f.limits.max * 10);
  const low = f.floor === 'positive' ? '0' : f.floor === 'non-negative' || f.limits.min >= 0 ? '-1' : trimmed(f.toDisplay(f.limits.min * 10));
  const tiny = Math.max(originalNumber / 1000, f.toDisplay(f.limits.min));
  return {normal: trimmed(normal), tiny: trimmed(tiny), top: trimmed(topDisplay), high: trimmed(high), low};
}

async function newReferencePage(browser: Browser, baseURL: string, viewport: SweepViewport): Promise<Page> {
  const context = await browser.newContext({baseURL, viewport: viewport === 'phone' ? PHONE : {width: 1280, height: 720}});
  await standInForSnapshotsSite(context);
  const page = await context.newPage();
  await page.addInitScript(skin => {
    try { localStorage.setItem('openisd_view', JSON.stringify({ui: skin === 'phone' ? {splashSeen: true, skinOverride: 'mobile'} : {splashSeen: true}})); } catch { /* storage disabled */ }
    try { localStorage.setItem('openisd_persist_warning_dismissed', '1'); } catch { /* storage disabled */ }
    try { sessionStorage.setItem('openisd_usage_notice_shown', '1'); } catch { /* storage disabled */ }
  }, viewport);
  return page;
}

async function importSample(page: Page, viewport: SweepViewport): Promise<void> {
  ensureSampleProject();
  const root = viewport === 'phone' ? '.mobile-root' : '.original-root';
  await page.locator(`${root} input[type=file]`).setInputFiles({name: 'sample-project.owpr', mimeType: 'application/json', buffer: readFileSync(SAMPLE_PROJECT_OWPR)});
  await page.locator(viewport === 'phone' ? '.mob-tabbar' : '.original-root').waitFor({state: 'visible'});
}

/**
 * What a clean project shows when `text` is typed into this one input: a fresh browser context, the sample project,
 * the box type chosen, the one entry made, every box read. Closed afterwards, so nothing carries over.
 */
export async function freshProjectReadings(
  browser: Browser, baseURL: string, viewport: SweepViewport, type: SweepBoxType,
  screens: readonly SweepScreen[], input: SweepInput, text: string,
): Promise<BoxReadings> {
  const page = await newReferencePage(browser, baseURL, viewport);
  try {
    await page.goto('/');
    await page.locator('.original-root, .mobile-root').first().waitFor({state: 'visible'});
    await importSample(page, viewport);
    await openScreen(page, viewport, {name: 'Box', tab: /^Box$/});
    await page.locator('#og-box-type, #mob-box-type').selectOption(type);
    await openScreen(page, viewport, screens.find(s => s.name === input.screen) ?? screens[0]!);
    await enterText(input.locate(page), text);
    return await readAllBoxes(page, viewport, screens);
  } finally {
    await page.context().close();
  }
}

/** Enters `text` the way a person does: picks it from a count list, or types it into a number box and commits. */
export async function enterText(box: Locator, text: string): Promise<void> {
  if (await box.evaluate(el => el.tagName === 'SELECT')) await box.selectOption(text);
  else await fillAndCommit(box, text);
}

/** How a box may differ from the expected reading: `exact`, or within the rounding the screen shows. */
export type Match = 'exact' | 'rounded';

/** `b` is the expected text: the rounding allowed is half a unit of its last shown digit, or half a percent. */
function sameNumber(a: string, b: string, match: Match): boolean {
  if (a === b) return true;
  if (match === 'exact') return false;
  const x = Number(a), y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const decimals = b.includes('.') ? b.length - b.indexOf('.') - 1 : 0;
  return Math.abs(x - y) <= Math.max(0.005 * Math.max(Math.abs(x), Math.abs(y)), 0.5 * 10 ** -decimals);
}

/** Lines naming each box that differs from the expected reading; empty when every box follows. */
export function differences(expected: BoxReadings, actual: BoxReadings, match: Match, compareCalculatedFlag: boolean): string[] {
  const out: string[] = [];
  const got = new Map(actual.map(r => [r.key, r]));
  for (const want of expected) {
    const have = got.get(want.key);
    if (have === undefined) { out.push(`${want.key}: missing, expected "${want.value}"`); continue; }
    if (!sameNumber(have.value, want.value, match)) out.push(`${want.key}: shows "${have.value}", expected "${want.value}"`);
    if (compareCalculatedFlag && want.calculated !== have.calculated) out.push(`${want.key}: ${have.calculated ? 'calculated' : 'entered'}, expected ${want.calculated ? 'calculated' : 'entered'}`);
  }
  for (const have of actual) if (!expected.some(r => r.key === have.key)) out.push(`${have.key}: extra box shows "${have.value}"`);
  return out;
}

/** Calculated boxes still in the refused-entry state. */
export function refusedCalculated(actual: BoxReadings): string[] {
  return actual.filter(r => r.calculated && r.refused).map(r => `${r.key}: calculated box still in the refused-entry state (shows "${r.value}")`);
}

/** Opens the sample project on the worker page in the viewport's skin, with the box type chosen. */
export async function openSweepProject(page: Page, viewport: SweepViewport, type: SweepBoxType): Promise<void> {
  if (viewport === 'phone') {
    await page.setViewportSize(PHONE);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
  } else {
    await page.goto('/');
    await openAProject(page);
  }
  await setFocusedBoxType(page, type);
}

/**
 * What every box must show after `text` is typed. A refused entry leaves the last accepted value in force, so the
 * boxes follow the clean project holding that value (never the whole history, which would repeat a latch instead of
 * catching it); the refused box itself shows what the clean project shows for the typed text.
 */
export function expectedAfterEntry(typed: BoxReadings, lastAccepted: BoxReadings): BoxReadings {
  const refusedKeys = typed.filter(r => r.refused).map(r => r.key);
  if (refusedKeys.length === 0) return typed;
  const kept = lastAccepted.filter(r => !refusedKeys.includes(r.key));
  const shown = typed.filter(r => refusedKeys.includes(r.key)).map(r => ({...r, calculated: lastAccepted.find(a => a.key === r.key)?.calculated ?? r.calculated}));
  return [...kept, ...shown];
}

/** The readings of the last accepted entry: the new ones unless the entry was refused. */
export function acceptedAfterEntry(typed: BoxReadings, lastAccepted: BoxReadings): BoxReadings {
  return typed.some(r => r.refused) ? lastAccepted : typed;
}

/** What is still wrong once an input has its shown starting text typed back: held to the start within the rounding the
 *  screen shows, and exactly to a clean project with that same text typed. */
export function backAtStart(start: BoxReadings, fresh: BoxReadings, now: BoxReadings, startedCalculated: boolean): string[] {
  return [...refusedCalculated(now), ...differences(start, now, 'rounded', !startedCalculated), ...differences(fresh, now, 'exact', true)];
}
