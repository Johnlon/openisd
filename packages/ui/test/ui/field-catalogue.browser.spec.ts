import type {Page, Locator} from '@playwright/test';
import {measureFieldBorders} from '../fixtures/fieldVisualContract.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {FIELD_APPEARANCES, NumberField, NumberEditor} from '@openisd/design/fields';
import {approvedFieldContext} from '../fixtures/joinedFieldReference.js';
import {measureCompactFields} from '../fixtures/compactFieldContract.js';
import {measureFieldInventory} from '../fixtures/fieldInventory.js';
import {CATALOGUE_INVENTORY, CATALOGUE_REFERENCE_BASE_FORM_COUNT} from '../fixtures/fieldInventoryScenarios.js';
import {expect, test, openAMobileProject, COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';

test.use({viewport:{width:374,height:705}});

test('the field catalogue shows joined unstacked controls, with readonly units still switchable', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await page.goto('/?field-catalogue=1');
  await expect(page.getByRole('heading', {name: 'Field appearance catalogue', exact: true})).toBeVisible();
  const numeric = page.locator('[data-specimen="number-readonly-switchable-both"]');
  const input = numeric.locator('input');
  await expect(input).toHaveAttribute('readonly', '');
  await expect(numeric.locator('.num-stepper')).toHaveCount(0);
  await expect(numeric.locator('.ui-field-unit')).toHaveAttribute('role', 'button');
  const before = await input.inputValue();
  await numeric.locator('.ui-field-unit').click();
  await expect(input).not.toHaveValue(before);
  const count = page.locator('[data-specimen="count-writable-none-both"]');
  await expect(count.getByRole('combobox')).toBeVisible();
  await expect(count.locator('input,.num-stepper')).toHaveCount(0);
});

const intrinsicNumbers = NumberField.ALL.map(field => ({key: field.value, count: field.editor === NumberEditor.CountSelect, options: field.editor === NumberEditor.CountSelect ? field.countOptions().map(option => String(option.value)) : [], hasUnits: field.display.kind === 'switchable' || field.display.symbol !== ''}));

test('all numeric catalogue forms meet one independent width, cue and native-control contract', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await page.goto('/?field-catalogue=1');
  await expect(page.locator('[data-specimen]')).toHaveCount(FIELD_APPEARANCES.length);
  const report = await page.locator('.field-catalogue').evaluate(measureCompactFields, approvedFieldContext('catalogue',intrinsicNumbers));
  expect(report.rows).toBe(44);
  expect(report.issues).toEqual([]);
});

test('the joined contract detects the wrong editor, missing border, widened readout and inward cues', async ({page}) => {
  await page.goto('/?field-catalogue=1');
  await expect(page.locator('[data-specimen]')).toHaveCount(FIELD_APPEARANCES.length);
  await page.locator('[data-specimen="count-writable-none-both"] select').evaluate(select => {
    const wrong = document.createElement('input');
    wrong.value = '2';
    select.replaceWith(wrong);
  });
  await page.locator('[data-specimen="number-readonly-switchable-both"] input').evaluate(input => {
    const width=input.getBoundingClientRect().width+4;
    input.style.setProperty('width',width+'px','important');
    input.style.setProperty('max-width',width+'px','important');
    input.style.setProperty('border', 'none', 'important');
  });
  await page.locator('[data-specimen="number-writable-none-both"] .ui-field-dev').evaluate(cue => {
    cue.setAttribute('style', 'grid-column:2 !important; margin:0 !important;');
  });
  const report = await page.locator('.field-catalogue').evaluate(measureCompactFields, approvedFieldContext('catalogue',intrinsicNumbers));
  expect(report.issues.some(issue => issue.includes('count requires a select'))).toBe(true);
  expect(report.issues.some(issue => issue.includes('value width'))).toBe(true);
  expect(report.issues.some(issue => issue.includes('border missing'))).toBe(true);
  expect(report.issues.some(issue => issue.includes('model cue must follow'))).toBe(true);
});

const boxTypes = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'] as const;
type PageView = typeof boxTypes[number] | 'Driver' | 'Signal' | 'Filters' | 'Advanced';
async function openPageView(page: Page, view: PageView): Promise<Locator> {
  switch (view) {
    case 'sealed': case 'vented': case 'box-passive-radiator': case 'bandpass4': case 'bandpass6': case 'abc':
      await page.locator('#mob-box-type').selectOption(view); break;
    case 'Advanced': await tapMobileMenuItem(page, 'Advanced'); break;
    case 'Filters':
      await page.locator('.mob-tab').filter({hasText: /^Filters$/}).click();
      await page.getByText('+ AP', {exact: true}).click(); break;
    case 'Driver': case 'Signal': await page.locator('.mob-tab').filter({hasText: view}).click(); break;
  }
  return view === 'Advanced' ? page.locator('.mob-dlg') : page.locator('.mob-content');
}

for (const view of [...boxTypes, 'Driver', 'Signal', 'Filters', 'Advanced'] as const) {
  test(`the same joined contract covers the phone ${view} page`, async ({page}) => {
    await page.setViewportSize({width: 374, height: 705});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    const surface = await openPageView(page, view);
    const report = await surface.evaluate(measureCompactFields, approvedFieldContext(view,intrinsicNumbers));
    expect(report.rows).toBeGreaterThan(0);
    expect(report.measured).toBe(report.rows);
    expect(report.issues).toEqual([]);
  });
}

type ExtraView = 'General' | 'Parameters' | 'Advanced' | 'Dimensions' | 'Tune' | 'What-if';
async function openExtraView(page: Page, tab: ExtraView): Promise<Locator> {
  if (tab === 'Tune' || tab === 'What-if') {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await page.locator('.mob-tab').filter({hasText: /^Graph$/}).click();
    await page.getByRole('button', {name: `Open ${tab}`}).click();
    return page.locator('.mob-sheet');
  }
  await page.locator('.mob-tab').filter({hasText: /^Driver$/}).click();
  await page.getByRole('button', {name: /^(?:✎ )?Edit$/}).click();
  const surface = page.locator('.de-modal');
  await surface.getByRole('button', {name: tab, exact: true}).click();
  return surface;
}

for (const tab of ['General', 'Parameters', 'Advanced', 'Dimensions', 'Tune', 'What-if'] as const) {
  test(`the joined contract also covers ${tab}`, async ({page}) => {
    await page.setViewportSize({width: 374, height: 705});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    const surface = await openExtraView(page, tab);
    const report = await surface.evaluate(measureCompactFields, approvedFieldContext(tab==='Tune'||tab==='What-if'?tab:'editor-'+tab,intrinsicNumbers));
    const borders = await surface.evaluate(measureFieldBorders);
    expect(report.rows + borders.rows, 'each surface must have measured controls; General uses the text/border checker and sheets use the numeric checker').toBeGreaterThan(0);
    expect(borders.controls).toBe(borders.rows);
    expect(borders.issues).toEqual([]);
    expect(report.measured).toBe(report.rows);
    expect(report.issues).toEqual([]);
  });
}

test('the joined contract rejects a row whose unit and spinner controls escape its bounds', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await page.goto('/?field-catalogue=1');
  await expect(page.locator('[data-specimen]')).toHaveCount(FIELD_APPEARANCES.length);
  await page.locator('[data-specimen="number-writable-none-both"] .ui-field').evaluate(row => row.style.setProperty('width', '200px', 'important'));
  const report = await page.locator('.field-catalogue').evaluate(measureCompactFields, approvedFieldContext('catalogue',intrinsicNumbers));
  expect(report.issues.some(issue => issue.includes('control leaves its row'))).toBe(true);
});


test('every catalogue field is included in the inventory', async ({page}) => {
  await page.goto('/?field-catalogue=1');
  await expect(page.locator('[data-specimen]')).toHaveCount(FIELD_APPEARANCES.length);
  const report = await page.locator('.field-catalogue').evaluate(measureFieldInventory, CATALOGUE_INVENTORY);
  expect(report.issues).toEqual([]);
  expect(FIELD_APPEARANCES).toHaveLength(CATALOGUE_REFERENCE_BASE_FORM_COUNT);
  expect(report.expected).toBe(CATALOGUE_REFERENCE_BASE_FORM_COUNT);
  expect(report.matched).toBe(report.expected);
  expect(report.accounted).toBe(report.expected);
  expect(report.controls).toBe(report.accounted);
});


const rendererMutations = [
  {name: 'bug marker added to ordinary checkbox', specimen: 'boolean-writable-none-none', selector: 'input', change: (element: Element) => element.classList.add('catalogue-bug'), issue: 'wrong editor'},
  {name: 'bug marker added to ordinary readonly checkbox', specimen: 'boolean-readonly-none-none', selector: '[role="checkbox"]', change: (element: Element) => element.classList.add('catalogue-bug'), issue: 'wrong editor'},
  {name: 'ordinary checkbox substituted for bug switch', specimen: 'bug-toggle-writable-none-none', selector: 'input', change: (element: Element) => element.classList.remove('catalogue-bug'), issue: 'wrong editor'},
  {name: 'ordinary readonly checkbox substituted for bug switch', specimen: 'bug-toggle-readonly-none-none', selector: '[role="checkbox"]', change: (element: Element) => element.classList.remove('catalogue-bug'), issue: 'wrong editor'},
  {name: 'numeric editor substituted for readonly renderer', specimen: 'number-readonly-none-none', selector: 'input', change: (element: Element) => { const wrap = document.createElement('span'); wrap.className = 'num-input-wrap'; element.before(wrap); wrap.append(element); element.setAttribute('data-numinput', ''); }, issue: 'wrong editor'},
  {name: 'non-button DQ cue', specimen: 'number-writable-none-dq', selector: '.ui-field-dq-btn', change: (element: Element) => { const span = document.createElement('span'); span.setAttribute('class', element.getAttribute('class') ?? ''); span.textContent = element.textContent; element.replaceWith(span); }, issue: 'DQ cue count 0, expected 1'},
];
for (const mutation of rendererMutations) {
  test('catalogue inventory rejects ' + mutation.name, async ({page}) => {
    await page.goto('/?field-catalogue=1');
    const root = page.locator('.field-catalogue');
    expect((await root.evaluate(measureFieldInventory, CATALOGUE_INVENTORY)).issues).toEqual([]);
    await page.locator(`[data-specimen="${mutation.specimen}"] ${mutation.selector}`).evaluate(mutation.change);
    expect((await root.evaluate(measureFieldInventory, CATALOGUE_INVENTORY)).issues.join('\n')).toContain(mutation.issue);
  });
}
