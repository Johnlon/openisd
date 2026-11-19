import {expect, openAProject, openDriverEditor, driverEditorField, test} from '../fixtures.js';
import {clearWithKeyboard, fillAndBlur} from '../fixtures/numField.js';
import type {Page} from '@playwright/test';

/**
 * Journey (T910): a person opens the Driver Editor, types figures, lets a value calculate, turns on Inspect Provenance and clicks
 * the calculated figure. The first formula the panel shows, worked out with the figures the editor shows for the fields it names,
 * must give the figure the editor shows. It would have caught bugs/BUG_20261118_formula-panel-is-a-hand-typed-copy-of-the-engine.md
 * (T902): with Hg 10 mm and Xmax 3 mm the editor showed Hc 4 mm and the panel said Hc = 2 x Xmax + Hg, which is 16 mm; Mpow showed
 * BL / sqrt(Re) and the panel said sqrt(Rme). Acts only as a person does: typing, clearing, the Inspect Provenance box, a click on a label.
 * Desktop only: the phone's panel is the same text, but its fields sit on other tabs behind a docked popup that hides the editor.
 */

/** Journeys that fail because of an app bug: the bug file, red until fixed (`test.fail`). Key: the test's title. */
const KNOWN: ReadonlyMap<string, string> = new Map([]);

const TABS = ['Parameters', 'Advanced', 'Dimensions'] as const;

/** The editor's label for a name the panel prints ("Xmax_m", "BL_Tm", "Re_ohm", "Rme_kg_per_s": the part before the first underscore). */
function labelOf(name: string): string {
  return name.split('_')[0] ?? name;
}

/** The figure a field shows now, whichever tab it is on. */
async function shownFigure(page: Page, label: string): Promise<number> {
  for (const tab of TABS) {
    await page.getByRole('button', {name: tab, exact: true}).click();
    const field = page.locator('.de-body .de-fld', {has: page.locator(`label:text-is("${label}")`)});
    if (await field.count() > 0) return Number(await field.first().locator('input').first().inputValue());
  }
  throw new Error(`no field labelled ${label} on any tab`);
}

/** Work out the right-hand side of the panel's first formula with the figures shown. A formula with a "when" clause is worked as
 *  its first branch (the one a person reads first). Every name must be one the editor shows; the arithmetic is + - × / ( ) and √. */
function work(formula: string, shown: ReadonlyMap<string, number>): number {
  const [, rhs = ''] = formula.split(' = ');
  const first = rhs.split(' when ')[0] ?? rhs;
  const tokens = first.match(/[A-Za-z][A-Za-z0-9_]*|\d+(?:\.\d+)?|[+\-−×/()√]/g) ?? [];
  let at = 0;
  const peek = (): string | undefined => tokens[at];
  const take = (): string => {
    const token = tokens[at++];
    if (token === undefined) throw new Error(`the panel formula "${formula}" ends too soon`);
    return token;
  };
  function atom(): number {
    const token = take();
    if (token === '(') { const v = sum(); take(); return v; }
    if (token === '√') return Math.sqrt(atom());
    if (/^\d/.test(token)) return Number(token);
    const value = shown.get(labelOf(token));
    if (value === undefined) throw new Error(`the panel formula "${formula}" names ${token}, which the editor does not show`);
    return value;
  }
  function product(): number {
    let v = atom();
    for (let op = peek(); op === '×' || op === '/'; op = peek()) { take(); const w = atom(); v = op === '×' ? v * w : v / w; }
    return v;
  }
  function sum(): number {
    let v = product();
    for (let op = peek(); op === '+' || op === '-' || op === '−'; op = peek()) { take(); const w = product(); v = op === '+' ? v + w : v - w; }
    return v;
  }
  return sum();
}

/** Inspect Provenance on, click the field's label, read the first formula and the names it lists. */
async function firstFormula(page: Page, label: string): Promise<{formula: string; names: string[]}> {
  await page.locator('.de-provenance-chk', {hasText: 'Inspect Provenance'}).locator('input').check();
  await driverEditorField(page, label).locator('label').click();
  const card = page.locator('.eq-inspector-card');
  await expect(card).toBeVisible();
  const formula = (await card.locator('.eq-formula').first().innerText()).trim();
  const names = (await card.locator('.eq-path-card').first().locator('.eq-in-badge').allInnerTexts()).map(s => s.trim());
  await page.locator('.eq-x').click();
  await page.locator('.de-provenance-chk', {hasText: 'Inspect Provenance'}).locator('input').uncheck();
  return {formula, names};
}

/** What the editor shows for a calculated field, and what its panel's first formula gives from the figures the editor shows. */
async function shownAndWorked(page: Page, label: string, shownTargetTab: string): Promise<{target: number; worked: number; said: string}> {
  await page.getByRole('button', {name: shownTargetTab, exact: true}).click();
  const target = Number(await driverEditorField(page, label).locator('input').first().inputValue());
  const {formula, names} = await firstFormula(page, label);
  const shown = new Map<string, number>();
  for (const name of names) shown.set(labelOf(name), await shownFigure(page, labelOf(name)));
  const worked = work(formula, shown);
  return {target, worked, said: `the panel says "${formula}"; with ${[...shown].map(([k, v]) => `${k} ${v}`).join(', ')} that is ${worked}, the editor shows ${label} ${target}`};
}

test.describe('Journey: the Driver Editor formula panel agrees with the figures the editor shows', () => {
  test.beforeEach(async ({appPage: page}) => {
    await openAProject(page);
    await openDriverEditor(page);
  });

  test('Hc calculated from Hg 10 and Xmax 3 agrees with its formula', async ({appPage: page}) => {
    const name = 'Hc calculated from Hg 10 and Xmax 3 agrees with its formula';
    test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
    await page.getByRole('button', {name: 'Parameters', exact: true}).click();
    await clearWithKeyboard(driverEditorField(page, 'Hc').locator('input').first());
    await fillAndBlur(driverEditorField(page, 'Hg').locator('input').first(), '10');
    await fillAndBlur(driverEditorField(page, 'Xmax').locator('input').first(), '3');
    await expect(driverEditorField(page, 'Hc').locator('input').first()).toHaveValue('4.00');
    const {target, worked, said} = await shownAndWorked(page, 'Hc', 'Parameters');
    expect(worked, said).toBeCloseTo(target, 2);
  });

  test('Mpow calculated agrees with its formula', async ({appPage: page}) => {
    const name = 'Mpow calculated agrees with its formula';
    test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
    const {target, worked, said} = await shownAndWorked(page, 'Mpow', 'Advanced');
    expect(worked, said).toBeCloseTo(target, 2);
  });
});
