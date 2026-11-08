import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {BoxTypeName} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureFieldLayoutRules} from '../fixtures/fieldLayoutAudit.js';
import type {Locator, Page} from '@playwright/test';

/**
 * The field layout rules (.claude/rules/field-layout.md, John 5 Nov 2026, QO426), rules 2 to 7, on
 * every screen a number box or dropdown is on: every box type and every tab, both skins, the
 * New project wizard, the What-if panel and the phone port editor. 374 x 705 phone, 1280 x 720 desktop.
 * A fault that is not yet fixed is listed in KNOWN with its bug file; its own test then expects the
 * fault (test.fail) and turns red when it is fixed, so the entry is deleted. No other exemptions.
 * Rule 1 is the architecture gate no-numinput-outside-uifieldbody.test.ts.
 */

const BOXES: readonly {box: BoxTypeName; phone: string}[] = [
  {box: 'sealed', phone: 'sealed'}, {box: 'vented', phone: 'vented'}, {box: 'box-passive-radiator', phone: 'box-passive-radiator'},
  {box: 'bandpass4', phone: 'bandpass4'}, {box: 'bandpass6', phone: 'bandpass6'}, {box: 'abc', phone: 'abc'},
];

/** A fault found by this gate and not yet fixed: the screen, the rules it breaks, and the bug file that records it. */
type Rule = 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';
interface KnownFault {readonly screen: string; readonly rules: readonly Rule[]; readonly bug: string}
const ALL_BOXES = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'] as const;
const KNOWN: readonly KnownFault[] = [
  ...ALL_BOXES.map(box => ({screen: `desktop ${box} Advanced`, rules: ['R4'] as const, bug: 'BUG_20261105_desktop-advanced-air-value-widths'})),
  ...(['sealed', 'vented', 'box-passive-radiator', 'bandpass6', 'abc'] as const).map(box => ({screen: `phone ${box} Box`, rules: ['R4'] as const, bug: 'BUG_20261105_phone-box-tab-box-type-width'})),
  ...ALL_BOXES.map(box => ({screen: `phone ${box} Filters`, rules: ['R2', 'R7'] as const, bug: 'BUG_20261105_phone-filters-strip-scrolls-sideways'})),
  {screen: 'desktop abc ABC', rules: ['R3', 'R4'], bug: 'BUG_20261105_desktop-abc-port-columns-edges-and-widths'},
  {screen: 'desktop What-if panel', rules: ['R2'], bug: 'BUG_20261105_desktop-whatif-panel-scrolls-and-wizard-count-width'},
];

type Skin = 'desktop' | 'phone';
interface Screen {readonly id: string; readonly skin: Skin; readonly root: string; readonly open: (page: Page) => Promise<void>}

async function startDesktop(page: Page, box: BoxTypeName): Promise<void> {
  await page.setViewportSize({width: 1280, height: 720});
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await setFocusedBoxType(page, box);
}
async function startPhone(page: Page, boxValue: string): Promise<void> {
  await page.setViewportSize({width: 374, height: 705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
  await page.locator('#mob-box-type').selectOption(boxValue);
}

async function measure(page: Page, root: string): Promise<string[]> {
  return page.locator(root).first().evaluate(measureFieldLayoutRules);
}

const names = (items: Locator) => items.allInnerTexts().then(list => list.map(text => text.trim()).filter(text => text !== ''));

/** The fixed screens other than a box type's tabs. */
const EXTRA: readonly Screen[] = [
  {id: 'desktop What-if panel', skin: 'desktop', root: '.what-if-panel', open: async page => {
    await startDesktop(page, 'box-passive-radiator');
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
    await page.locator('.edit-btn', {hasText: 'What-if'}).click();
    await page.locator('.what-if-panel').waitFor();
  }},
  {id: 'desktop New project wizard step 2', skin: 'desktop', root: '.overlay.open .modal-body', open: async page => {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto('/');
    await page.locator('.tb-btn[title*="New project"]').click();
    await page.locator('.driver-library input.filter').fill('W5-1138SMF');
    await page.locator('.overlay.open .modal-body').getByText('Tang Band W5-1138SMF').first().click();
    await page.locator('.overlay.open .modal-footer').getByText('Next', {exact: true}).click();
    await page.locator('.np-step').getByText('Step 2').waitFor();
  }},
  {id: 'phone New project wizard step 2', skin: 'phone', root: '.mob-np-body', open: async page => {
    await page.setViewportSize({width: 374, height: 705});
    await forceMobileSkin(page);
    await page.goto('/');
    await page.getByText('New project').first().click();
    await page.locator('.driver-library input.filter').fill('W5-1138SMF');
    await page.locator('.mob-np-body').getByText('Tang Band W5-1138SMF').first().click();
    await page.locator('.mob-np-footer').getByText('Next ▸', {exact: true}).click();
    await page.locator('#np-wiring').waitFor();
  }},
  {id: 'desktop New project wizard radiator step', skin: 'desktop', root: '.overlay.open .modal-body', open: async page => {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto('/');
    await page.locator('.tb-btn[title*="New project"]').click();
    await page.locator('.driver-library input.filter').fill('W5-1138SMF');
    await page.locator('.overlay.open .modal-body').getByText('Tang Band W5-1138SMF').first().click();
    const next = page.locator('.overlay.open .modal-footer').getByText('Next', {exact: true});
    await next.click();
    await next.click();
    await page.locator('#np-box-type').selectOption('box-passive-radiator');
    await next.click();
    await page.locator('#np-pr-select').waitFor();
  }},
  {id: 'phone New project wizard radiator step', skin: 'phone', root: '.mob-np-body', open: async page => {
    await page.setViewportSize({width: 374, height: 705});
    await forceMobileSkin(page);
    await page.goto('/');
    await page.getByText('New project').first().click();
    await page.locator('.driver-library input.filter').fill('W5-1138SMF');
    await page.locator('.mob-np-body').getByText('Tang Band W5-1138SMF').first().click();
    const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
    await next.click();
    await next.click();
    await page.locator('#np-box-type').selectOption('box-passive-radiator');
    await next.click();
    await page.locator('#np-pr-select').waitFor();
  }},
  // The phone port editor (What-if sheet, tap Port area) is not walked: John ruled it stays as it is (QO426.c53).
];

/** The faults of one screen that are not in KNOWN. */
function unexpected(screen: string, issues: readonly string[]): string[] {
  return issues.filter(issue => !KNOWN.some(k => k.screen === screen && k.rules.some(rule => issue.startsWith(rule))));
}

/** Every tab of a box type on one skin, measured; the faults are labelled with their tab. */
async function walkTabs(page: Page, skin: Skin, box: string, tabs: Locator, root: string): Promise<string[]> {
  const faults: string[] = [];
  for (const tab of await names(tabs)) {
    await tabs.filter({hasText: new RegExp(`^${tab}$`)}).click();
    faults.push(...unexpected(`${skin} ${box} ${tab}`, await measure(page, root)).map(issue => `${tab}: ${issue}`));
  }
  return faults;
}

/** Opens a KNOWN screen, returns the root to measure. */
async function openKnown(page: Page, screen: string): Promise<string> {
  const extra = EXTRA.find(s => s.id === screen);
  if (extra !== undefined) { await extra.open(page); return extra.root; }
  const [skin, boxName, ...tab] = screen.split(' ');
  const boxes = BOXES.find(b => b.box === boxName);
  const tabName = new RegExp(`^${tab.join(' ')}$`);
  if (skin === 'desktop') {
    await startDesktop(page, boxes?.box ?? 'vented');
    await page.locator('.project-nav li').filter({hasText: tabName}).click();
    return '.content-panel';
  }
  await startPhone(page, boxes?.phone ?? 'vented');
  await page.locator('.mob-tab', {hasText: tabName}).click();
  return '.mob-content';
}

test.use({hasTouch: true});

for (const {box, phone} of BOXES) {
  test(`desktop ${box}: every tab keeps rules 2 to 7`, async ({page}) => {
    await startDesktop(page, box);
    expect(await walkTabs(page, 'desktop', box, page.locator('.project-nav li'), '.content-panel')).toEqual([]);
  });

  test(`phone ${box}: every tab keeps rules 2 to 7`, async ({page}) => {
    await startPhone(page, phone);
    expect(await walkTabs(page, 'phone', box, page.locator('.mob-tab'), '.mob-content')).toEqual([]);
  });
}

for (const screen of EXTRA) {
  test(`${screen.id} keeps rules 2 to 7`, async ({page}) => {
    await screen.open(page);
    expect(unexpected(screen.id, await measure(page, screen.root))).toEqual([]);
  });
}

for (const known of KNOWN) {
  test(`${known.screen} still breaks ${known.rules.join(' ')} (${known.bug})`, async ({page}) => {
    test.fail();
    const root = await openKnown(page, known.screen);
    expect((await measure(page, root)).filter(issue => known.rules.some(rule => issue.startsWith(rule)))).toEqual([]);
  });
}

test('desktop Passive Radiator tab: the Cms difference cue sits inside its section, 10px clear of the next section', async ({page}) => {
  await startDesktop(page, 'box-passive-radiator');
  await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
  const parameters = page.locator('.section-header', {hasText: 'Passive radiator parameters'}).last();
  const cue = page.locator('.tab-section.active .ui-field', {has: page.locator('.ui-field-label', {hasText: /^Cms/})}).locator('.ui-field-dev');
  const options = page.locator('.section-header', {hasText: 'User options'}).last();
  const right = (item: Locator) => item.evaluate(el => el.getBoundingClientRect().right);
  const left = (item: Locator) => item.evaluate(el => el.getBoundingClientRect().left);
  expect(await right(cue)).toBeLessThanOrEqual(await right(parameters));
  expect(await left(options) - await right(parameters)).toBeGreaterThanOrEqual(10);
});

test('desktop Passive Radiator tab: the Mms difference cue is 7px clear of the Cms label', async ({page}) => {
  await startDesktop(page, 'box-passive-radiator');
  await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
  const row = (name: RegExp) => page.locator('.tab-section.active .ui-field', {has: page.locator('.ui-field-label', {hasText: name})});
  const mmsCue = await row(/^Mms/).locator('.ui-field-dev').evaluate(el => el.getBoundingClientRect().right);
  const cmsLabel = await row(/^Cms/).locator('.ui-field-label').evaluate(el => el.getBoundingClientRect().left);
  // Only 5 px of slack is free once the widest User options label ("Fpr (with added mass)", 139.3 px plus its 22 px cue margin) stays on one line: 7.56 px measured.
  expect(cmsLabel - mmsCue).toBeGreaterThanOrEqual(7);
});

test('desktop Passive Radiator tab: every User options label is on one line and its row is level with the left column', async ({page}) => {
  await startDesktop(page, 'box-passive-radiator');
  await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
  const cols = page.locator('.tab-section.active .pr-controls > div');
  const lines = (col: Locator) => col.locator('.ui-field-label').evaluateAll(els => els.map(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set(Array.from(range.getClientRects()).map(r => Math.round(r.top)));
    return {text: el.textContent ?? '', lines: tops.size};
  }));
  const tops = (col: Locator) => col.locator('.ui-field').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top)));
  const options = await lines(cols.nth(1));
  expect(options).toHaveLength(4);
  for (const label of options) expect(label, label.text).toEqual({text: label.text, lines: 1});
  const leftTops = await tops(cols.nth(0));
  const rightTops = await tops(cols.nth(1));
  // the first User options row is level with the first left row, and the rows after it are evenly spaced
  expect(rightTops[0]).toBe(leftTops[0]);
  const steps = rightTops.slice(1).map((top, i) => top - rightTops[i]);
  expect(new Set(steps).size).toBe(1);
});

/** John, QO426.c87, c96, QO428.c2: the Num. of drivers and Voice coil connection dropdowns on the desktop Driver tab
 *  and the wizard's step 2 have no number boxes under them, so they are as wide as "Parallel" and its arrow (90 px,
 *  the old hand-built width), both the same, and nothing in either list is cut off. The Num. of PRs dropdown has
 *  number boxes under it and stays at the number-box width. */
const SHORT_DROPDOWN_PX = 90;

/** Width and edges of a dropdown, and whether its longest option text fits when that option is chosen. */
async function dropdown(page: Page, id: string) {
  return page.locator(`#${id}`).evaluate(async (select: HTMLSelectElement) => {
    const box = select.getBoundingClientRect();
    const wanted = [...select.options].reduce((a, o) => (o.text.length > a.text.length ? o : a));
    const before = select.value;
    select.value = wanted.value;
    const style = getComputedStyle(select);
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = style.font;
    const textPx = context.measureText(wanted.text).width;
    const room = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 20;
    select.value = before;
    return {left: box.left, right: box.right, width: box.width, longest: wanted.text, textPx, fits: textPx <= room, clipped: select.scrollWidth > select.clientWidth + 1};
  });
}

const COUNT_SCREENS: readonly {name: string; count: string; wiring: string; open: (page: Page) => Promise<void>}[] = [
  {name: 'desktop Driver tab', count: 'og-ndrivers', wiring: 'og-wiring', open: async page => {
    await startDesktop(page, 'sealed');
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  }},
  {name: 'wizard step 2', count: 'np-ndrivers', wiring: 'np-wiring', open: EXTRA[1]!.open},
];

for (const screen of COUNT_SCREENS) {
  test(`${screen.name}: Num. of drivers and Voice coil connection are ${SHORT_DROPDOWN_PX} px, same edges, nothing cut off`, async ({page}) => {
    await screen.open(page);
    const count = await dropdown(page, screen.count);
    const wiring = await dropdown(page, screen.wiring);
    expect(count.width).toBeCloseTo(SHORT_DROPDOWN_PX, 0);
    expect(wiring.width).toBeCloseTo(SHORT_DROPDOWN_PX, 0);
    expect(wiring.left).toBeCloseTo(count.left, 1);
    expect(wiring.right).toBeCloseTo(count.right, 1);
    expect(wiring.fits, `"${wiring.longest}" ${wiring.textPx}px in ${wiring.width}px`).toBe(true);
    expect(count.fits, `"${count.longest}" ${count.textPx}px in ${count.width}px`).toBe(true);
    expect(wiring.clipped || count.clipped).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('desktop Passive Radiator tab: Num. of PRs keeps the number-box width, not the short width', async ({page}) => {
  await startDesktop(page, 'box-passive-radiator');
  await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
  // It measured 150 px here (not 124) before and after this change: only the Driver tab and wizard dropdowns changed.
  expect((await dropdown(page, 'og-pr-count')).width).toBeCloseTo(150, 0);
});

/** The widest blank allowed between the longest label of a What-if column and that column's boxes:
 *  the desktop's 22px warning slot after every label, and a few px. */
const WHAT_IF_LABEL_GAP_MAX_PX = 22 + 8;
/** The What-if number box, 25% narrower than the 124px it had (John, 8 Nov 2026: "reduce the field widths by 25%"). */
const WHAT_IF_BOX_PX = 93;

for (const box of ['vented', 'bandpass6', 'abc'] as const) {
  // John, 8 Nov 2026, QO449.c11/c16: "there is too much space between labels and cells"; "the what if on the desktop".
  test(`desktop What-if, ${box}: each column's boxes share one edge, next to its longest label`, async ({page}) => {
    await startDesktop(page, box);
    await page.locator('.edit-btn', {hasText: 'What-if'}).first().click();
    const panel = page.locator('.what-if-panel');
    await panel.waitFor();
    const fields = await panel.locator('.ui-field').evaluateAll(all => all.flatMap(field => {
      const label = field.querySelector('label');
      const control = field.querySelector('input,select');
      if (label === null || control === null) return [];
      const text = field.ownerDocument.createRange();
      text.selectNodeContents(label);
      const textRight = text.getBoundingClientRect().right;
      return [{label: (label.textContent ?? '').trim(), labelX: Math.round(label.getBoundingClientRect().x), textRight: Math.round(textRight), boxX: Math.round(control.getBoundingClientRect().x)}];
    }));
    const columns = [...new Set(fields.map(f => f.labelX))];
    expect(columns.length, JSON.stringify(fields)).toBe(2);
    for (const x of columns) {
      const column = fields.filter(f => f.labelX === x);
      expect(new Set(column.map(f => f.boxX)).size, JSON.stringify(column)).toBe(1);
      const gap = Math.min(...column.map(f => f.boxX)) - Math.max(...column.map(f => f.textRight));
      expect(gap, JSON.stringify(column)).toBeLessThanOrEqual(WHAT_IF_LABEL_GAP_MAX_PX);
    }
    const boxWidths = await panel.locator('.ui-field .num-input-wrap').evaluateAll(all => all.map(w => Math.round(w.getBoundingClientRect().width)));
    expect(boxWidths.length).toBeGreaterThan(0);
    expect(new Set(boxWidths), JSON.stringify(boxWidths)).toEqual(new Set([WHAT_IF_BOX_PX]));
  });
}
