import {expect, test, openAMobileProject, openAProject, COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {FIELD_APPEARANCES, FieldEditor, FieldUnits, type FieldAppearance} from '@openisd/design/fields';
import {measureFieldControlContainment, measureFieldGroupContent} from '../fixtures/fieldControlContainment.js';
import {measureCursorOrdinaryInk} from '../fixtures/fieldCursorContract.js';
import {measureFieldInventory} from '../fixtures/fieldInventory.js';
import {CATALOGUE_INVENTORY, CATALOGUE_REFERENCE_BASE_FORM_COUNT} from '../fixtures/fieldInventoryScenarios.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {approvedCataloguePaint,requiredPaint} from '../fixtures/approvedPaintReference.js';
import type {Locator} from '@playwright/test';

// Expected paint is frozen from the approved preview, not application CSS/tokens.
const paint = (locator: Locator) => locator.evaluate(element => {
  const css = getComputedStyle(element), box = element.getBoundingClientRect();
  const properties = ['fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius', 'backgroundColor', 'backgroundImage', 'color'] as const;
  return {width: box.width, height: box.height, ...Object.fromEntries(properties.map(key => [key, css[key]]))};
});

function comparePaint(issues: string[], name: string, actual: Record<string, string | number>, expected: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) issues.push(`${name}: ${key} is ${actual[key]}, expected ${value}`);
  }
}

function unitTextExpectation(form: FieldAppearance): string | RegExp { return form.units === FieldUnits.None ? '' : /\S/; }

test('every numeric catalogue rendition matches the reviewed control paint and dimensions exactly', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await page.goto('/?field-catalogue=1');
  await expect(page.locator('[data-specimen]')).toHaveCount(FIELD_APPEARANCES.length);
  const inventory = await page.locator('.field-catalogue').evaluate(measureFieldInventory, CATALOGUE_INVENTORY);
  expect(inventory.issues).toEqual([]);
  expect(FIELD_APPEARANCES).toHaveLength(CATALOGUE_REFERENCE_BASE_FORM_COUNT);
  expect(inventory.matched).toBe(CATALOGUE_REFERENCE_BASE_FORM_COUNT);
  expect(inventory.accounted).toBe(inventory.controls);
  const issues: string[] = [];
  for (const form of FIELD_APPEARANCES.filter(form => form.editor === FieldEditor.Number || form.editor === FieldEditor.Count)) {
    const row = page.locator(`[data-specimen="${form.id}"] .ui-field`);
    const control = row.locator('input,select');
    const reference=approvedCataloguePaint(form.id);
    const expected=reference.control;
    comparePaint(issues, form.id, await paint(control), expected);
    const displayedUnit = row.locator('.ui-field-unit');
    const expectedUnit=requiredPaint(reference.unit,'unit '+form.id);
    await expect(displayedUnit, form.id + ' unit slot').toHaveCount(1);
    const actualUnit = await paint(displayedUnit);
    await expect(displayedUnit, form.id + ' unit presence').toHaveText(unitTextExpectation(form));
    for (const _unitForm of [form].filter(item => item.units !== FieldUnits.None)) comparePaint(issues, form.id + ' unit', actualUnit, expectedUnit);
    for (const stepper of await row.locator('.num-stepper-btn').all()) comparePaint(issues, form.id + ' spinner', await paint(stepper), requiredPaint(reference.spinner,'spinner '+form.id));
    for (const cue of await row.locator('.winisd-deviation-cue').all()) comparePaint(issues, form.id + ' model cue', await paint(cue), requiredPaint(reference.model,'model cue '+form.id));
  }
  expect(issues).toEqual([]);
});

const paintMutations = [
  {name: 'quarter-pixel width change', property: 'width', flex:'none', value: (Number(approvedCataloguePaint('number-writable-none-none').control.width)-0.25)+'px'},
  {name: 'missing left border', property: 'border-left-width', value: '0px'},
  {name: 'one-channel border-colour change', property: 'border-left-color', value: 'rgb(195,196,196)'},
  {name: 'one-pixel padding change', property: 'padding-left', value:(parseFloat(String(approvedCataloguePaint('number-writable-none-none').control.paddingLeft))+1)+'px'},
  {name: 'one-pixel font change', property: 'font-size', value: '16px'},
  {name: 'one-channel provenance-colour change', property: 'color', value:String(approvedCataloguePaint('number-writable-none-none').control.color).replace(/\d+/,channel=>String(Number(channel)+1))},
  {name: 'one-pixel radius change', property: 'border-top-left-radius', value: '5px'},
];
for (const mutation of paintMutations) {
  test(`the rendition oracle rejects a ${mutation.name}`, async ({page}) => {
    const expected=approvedCataloguePaint('number-writable-none-none').control;
    await page.setViewportSize({width:374,height:705});
    await page.goto('/?field-catalogue=1');
    const input = page.locator('[data-specimen="number-writable-none-none"] input');
    const baseline: string[] = [];
    comparePaint(baseline, 'control', await paint(input), expected);
    expect(baseline).toEqual([]);
    await input.evaluate((element, change) => {element.style.setProperty('flex',change.flex??'','important');element.style.setProperty(change.property, change.value, 'important');}, mutation);
    const issues: string[] = [];
    comparePaint(issues, 'control', await paint(input), expected);
    expect(issues.length).toBeGreaterThan(0);
    });
}

test('calculated closed-box values retain the reference calculated colour', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab').filter({hasText: /^Box$/}).click();
  await page.locator('#mob-box-type').selectOption('sealed');
  await expect(mobileFieldRow(page, 'Vb').locator('input')).toHaveCSS('color', String(approvedCataloguePaint('number-writable-none-none').control.color));
  await expect(mobileFieldRow(page, 'Fsc').locator('input')).toHaveCSS('color', String(approvedCataloguePaint('number-readonly-none-none').control.color));
  await expect(mobileFieldRow(page, 'Qtc').locator('input')).toHaveCSS('color', String(approvedCataloguePaint('number-readonly-none-none').control.color));
});

for (const width of [1280, 1024]) {
  test(`the desktop reference controls fit every clipping ancestor at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator('.project-nav li').filter({hasText: /^Box$/}).click();
    await page.locator('#og-box-type').selectOption('sealed');
    const report = await page.locator('.original-root').evaluate(measureFieldControlContainment);
    expect(report.controls).toBeGreaterThan(0);
    expect(report.issues).toEqual([]);
  });
}

test('closed-box actions clear diagrams and stay inside their chamber heading', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.project-nav li').filter({hasText: /^Box$/}).click();
  await page.locator('#og-box-type').selectOption('sealed');
  expect(await page.locator('.tab-section.active').evaluate(measureFieldGroupContent)).toEqual([]);
});

test('the pane collapse button follows the actual sidebar boundary', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  const gap = () => page.evaluate(() => {
    const toggle = document.querySelector('.split-h .split-toggle'), divider = document.querySelector('.split-v');
    if (toggle === null || divider === null) throw new Error('Shell split controls are missing');
    return toggle.getBoundingClientRect().left - divider.getBoundingClientRect().right;
  });
  await expect.poll(gap).toBe(8);
  await page.locator('.split-v .split-toggle').click();
  await expect.poll(gap).toBe(8);
});

test('every field label uses the reference typography', async ({page}) => {
  await page.setViewportSize({width:374,height:705});
  const labelStyle = (label: Locator) => label.evaluate(element => {
    const css = getComputedStyle(element);
    return {family: css.fontFamily, size: css.fontSize, weight: css.fontWeight, lineHeight: css.lineHeight, colour: css.color, align: css.textAlign};
  });
  const expected=approvedCataloguePaint('number-writable-none-none').label;
  expect(expected).not.toBeNull();
  await page.goto('/?field-catalogue=1');
  await expect(page.locator('[data-specimen]')).toHaveCount(FIELD_APPEARANCES.length);
  for (const label of await page.locator('.ui-field-label').all()) expect(await labelStyle(label)).toEqual(expected);
});


for (const skin of ['mobile', 'desktop'] as const) {
  test(`${skin}: the cursor ordinary phase preserves calculated ink without editing the value`, async ({page}) => {
    await page.setViewportSize(skin === 'mobile' ? {width: 374, height: 705} : {width: 1280, height: 900});
    const prepare = {mobile: () => forceMobileSkin(page), desktop: async () => {}};
    await prepare[skin]();
    await page.goto('/');
    const open = {mobile: openAMobileProject, desktop: openAProject};
    await open[skin](page, COMPLETE_DRIVER_PROJECT_OWPR);
    const tab = {mobile: '.mob-tab', desktop: '.project-nav li'};
    await page.locator(tab[skin]).filter({hasText: /^Box$/}).click();
    const boxType = {mobile: '#mob-box-type', desktop: '#og-box-type'};
    await page.locator(boxType[skin]).selectOption('sealed');
    const row = page.locator('.ui-field[data-field="box_Fsc_hz"]:visible'), input = row.locator('input');
    const value = await input.inputValue();
    await input.focus();
    await input.evaluate(element => { if (element instanceof HTMLInputElement) element.setSelectionRange(0, 1); });
    const marker = row.locator('.num-mark-underline');
    await expect(marker).toBeVisible();
    await expect(input).toHaveCSS('color', String(approvedCataloguePaint('number-readonly-none-none').control.color));
    const cursor = await input.evaluate(measureCursorOrdinaryInk);
    expect(cursor.markers).toBe(1);
    expect(cursor.issues).toEqual([]);
    await expect(input).toHaveValue(value);
  });
}
