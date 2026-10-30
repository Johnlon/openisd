import type {Locator, Page} from '@playwright/test';
import {EnumField, FieldAccess, NumberField} from '@openisd/design/fields';
import {expect, test, openAMobileProject, openAProject, COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureFieldInventory} from '../fixtures/fieldInventory.js';
import {CLOSED_BOX_INVENTORY, DESKTOP_CLOSED_BOX_INVENTORY} from '../fixtures/fieldInventoryScenarios.js';

const fieldSelector = (field: NumberField) => `.ui-field[data-field="${field.value}"]`;
const fsc = fieldSelector(NumberField.BOX_FSC_HZ);
const mutations: readonly {name: string; apply: (surface: Locator) => Promise<void>; issue: string}[] = [
  {name: 'spinner removed from Tab order', apply: async surface => { await surface.locator(fsc + ' .num-stepper-btn').first().evaluate(element => element.setAttribute('tabindex', '-1')); }, issue: 'attribute tabindex'},
  {name: 'spinner changed to submit', apply: async surface => { await surface.locator(fsc + ' .num-stepper-btn').first().evaluate(element => element.setAttribute('type', 'submit')); }, issue: 'attribute type'},
  {name: 'stray cue beside select', apply: async surface => { await surface.locator('#mob-box-type,#og-box-type').evaluate(element => { const cue = document.createElement('button'); cue.className = 'winisd-deviation-cue'; cue.textContent = '≠W'; element.after(cue); }); }, issue: 'unaccounted field control'},
  {name: 'stray readout', apply: async surface => { await surface.evaluate(root => { const value = document.createElement('span'); value.className = 'catalogue-colour-readout'; value.textContent = 'red'; root.append(value); }); }, issue: 'unaccounted value control'},
  {name: 'missing field label', apply: async surface => { await surface.locator(fsc + ' .ui-field-label').evaluate(element => element.remove()); }, issue: 'label count 0, expected 1'},
  {name: 'wrong option label', apply: async surface => { await surface.locator('#mob-box-type,#og-box-type').evaluate(element => { const option = element.querySelector('option'); if (option !== null) option.textContent = 'Wrong label'; }); }, issue: EnumField.BOX_TYPE.value + ': options differ from scenario'},
  {name: 'disabled option', apply: async surface => { await surface.locator('#mob-box-type,#og-box-type').evaluate(element => { const option = element.querySelector('option'); if (option !== null) option.disabled = true; }); }, issue: EnumField.BOX_TYPE.value + ': options differ from scenario'},
  {name: 'inert control', apply: async surface => { await surface.locator(fsc + ' input').evaluate(element => element.setAttribute('inert', '')); }, issue: 'inaccessible through inert or aria-hidden'},
  {name: 'hidden ARIA field', apply: async surface => { await surface.locator(fsc).evaluate(element => element.setAttribute('aria-hidden', 'true')); }, issue: 'inaccessible through inert or aria-hidden'},
  {name: 'suppressed tab stop', apply: async surface => { await surface.locator(fsc + ' input').evaluate(element => element.setAttribute('tabindex', '-1')); }, issue: 'value attribute tabindex'},
  {name: 'transparent duplicate', apply: async surface => { await surface.locator(fsc).evaluate(element => { const duplicate = element.cloneNode(true); if (duplicate instanceof HTMLElement) duplicate.style.opacity = '0'; element.after(duplicate); }); }, issue: NumberField.BOX_FSC_HZ.value + ': occurrence count 2, expected 1'},
  {name: 'decoy spinner', apply: async surface => { await surface.locator(fsc).evaluate(row => { row.querySelector('button[title="Increase"]')?.removeAttribute('title'); const button = document.createElement('button'); button.title = 'Increase'; button.textContent = '▲'; row.append(button); }); }, issue: 'increase button count 0, expected 1'},
  {name: 'non-button model cue', apply: async surface => { await surface.locator(fsc + ' .winisd-deviation-cue').evaluate(element => { const span = document.createElement('span'); span.setAttribute('class', element.getAttribute('class') ?? ''); span.textContent = element.textContent; element.replaceWith(span); }); }, issue: 'model cue count 0, expected 1'},
  {name: 'undeclared field control', apply: async surface => { await surface.locator(fsc).evaluate(row => { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Unexpected'; row.append(button); }); }, issue: 'unaccounted field control'},
  {name: 'disabled spinner', apply: async surface => { await surface.locator(fsc + ' .num-stepper-btn').first().evaluate(element => element.setAttribute('disabled', '')); }, issue: 'spinners disabled true, expected false'},
  {name: 'missing spinners', apply: async surface => { await surface.locator(fsc + ' .num-stepper').evaluate(element => element.remove()); }, issue: 'spinners count 0, expected 2'},
  {name: 'missing model cue', apply: async surface => { await surface.locator(fsc + ' .winisd-deviation-cue').evaluate(element => element.remove()); }, issue: 'model cue count 0, expected 1'},
  {name: 'coordinated readonly mutation', apply: async surface => { await surface.locator(fsc).evaluate((row, access) => { row.setAttribute('data-access', access); const input = row.querySelector('input'); if (input !== null) input.readOnly = true; }, FieldAccess.Readonly); }, issue: 'native readonly true, expected false'},
  {name: 'missing whole field', apply: async surface => { await surface.locator(fsc).evaluate(element => element.remove()); }, issue: NumberField.BOX_FSC_HZ.value + ': occurrence count 0, expected 1'},
  {name: 'lost field identity', apply: async surface => { await surface.locator(fsc).evaluate(element => element.removeAttribute('data-field')); }, issue: NumberField.BOX_FSC_HZ.value + ': occurrence count 0, expected 1'},
  {name: 'unaccounted native field', apply: async surface => { await surface.evaluate(root => { const input = document.createElement('input'); input.type = 'text'; root.append(input); }); }, issue: 'unaccounted value control'},
  {name: 'missing unit affordance', apply: async surface => { await surface.locator(fsc + ' .ui-field-unit').evaluate(element => element.removeAttribute('role')); }, issue: 'unit attribute role'},
  {name: 'wrong unit label', apply: async surface => { await surface.locator(fsc + ' .ui-field-unit').evaluate(element => { element.textContent = 'kHz'; }); }, issue: 'unit text "kHz", expected "Hz"'},
  {name: 'missing box choice', apply: async surface => { await surface.locator('#mob-box-type,#og-box-type').evaluate(element => element.lastElementChild?.remove()); }, issue: EnumField.BOX_TYPE.value + ': options differ from scenario'},
  {name: 'duplicated field', apply: async surface => { await surface.locator(fsc).evaluate(element => element.after(element.cloneNode(true))); }, issue: NumberField.BOX_FSC_HZ.value + ': occurrence count 2, expected 1'},
  {name: 'empty audit', apply: async surface => { await surface.evaluate(root => root.replaceChildren()); }, issue: 'no value controls were audited'},
];
const hosts = [
  {name: 'phone', expected: CLOSED_BOX_INVENTORY, prepare: async (page: Page) => { await page.setViewportSize({width: 374, height: 705}); await forceMobileSkin(page); }, open: openAMobileProject, tab: '.mob-tab', box: '#mob-box-type', surface: '.mob-content'},
  {name: 'desktop', expected: DESKTOP_CLOSED_BOX_INVENTORY, prepare: (page: Page) => page.setViewportSize({width: 1280, height: 900}), open: openAProject, tab: '.project-nav li', box: '#og-box-type', surface: '.tab-section.active'},
];
for (const host of hosts) {
  test.describe('Closed Box ' + host.name, () => {
    test.beforeEach(async ({page}) => {
      await host.prepare(page);
      await page.goto('/');
      await host.open(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await page.locator(host.tab).filter({hasText: /^Box$/}).click();
      await page.locator(host.box).selectOption('sealed');
    });

    test('every field has its independently declared editor, access and required parts', async ({page}) => {
      const report = await page.locator(host.surface).evaluate(measureFieldInventory, host.expected);
      expect(report.issues).toEqual([]);
      expect(report.expected).toBe(4);
      expect(report.matched).toBe(report.expected);
      expect(report.controls).toBe(4);
      expect(report.accounted).toBe(report.controls);
    });

    test('native Tab reaches the unit then both spinners without changing the digit place', async ({page}) => {
      const row = page.locator(host.surface).locator(fsc);
      const input = row.locator('input');
      const unit = row.locator('.ui-field-unit');
      const up = row.getByTitle('Increase', {exact: true});
      const down = row.getByTitle('Decrease', {exact: true});
      await input.fill('100.0000');
      await input.evaluate(element => { if (element instanceof HTMLInputElement) element.setSelectionRange(4, 5); });
      await input.press('Tab');
      await expect(unit).toBeFocused();
      await expect(row.locator('.num-mark-underline')).toHaveText('0');
      await expect(input).toHaveValue('100.0000');
      await unit.press('Tab');
      await expect(up).toBeFocused();
      await up.press('ArrowUp');
      await expect(input).toHaveValue('100.1000');
      await expect(row.locator('.num-mark-underline')).toHaveText('1');
      await up.press('Tab');
      await expect(down).toBeFocused();
      await down.press('ArrowDown');
      await expect(input).toHaveValue('100.0000');
      await expect(row.locator('.num-mark-underline')).toHaveText('0');
      await down.press('Tab');
      await expect(row.locator('.winisd-deviation-cue')).toBeFocused();
      await expect(row.locator('.num-mark-underline')).toHaveCount(0);
    });

    for (const mutation of mutations) {
      test('inventory rejects ' + mutation.name, async ({page}) => {
        const surface = page.locator(host.surface);
        expect((await surface.evaluate(measureFieldInventory, host.expected)).issues).toEqual([]);
        await mutation.apply(surface);
        const report = await surface.evaluate(measureFieldInventory, host.expected);
        expect(report.issues.join('\n')).toContain(mutation.issue);
      });
    }
  });
}
