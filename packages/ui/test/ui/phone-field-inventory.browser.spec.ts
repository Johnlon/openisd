import type {Locator, Page} from '@playwright/test';
import type {ExpectedFieldOccurrence} from '../fixtures/fieldInventory.js';
import {NumberField} from '@openisd/design/fields';
import {expect, test, openAMobileProject, COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureFieldInventory} from '../fixtures/fieldInventory.js';
import {PHONE_DRIVER_INVENTORY, PHONE_SIGNAL_INVENTORY, PHONE_ALLPASS_INVENTORY} from '../fixtures/fieldInventoryScenarios.js';

const pages: readonly {name: string; tab: RegExp; expected: readonly ExpectedFieldOccurrence[]; controls: number; target: NumberField; afterOpen?: (page: Page) => Promise<void>; mutations?: readonly {name: string; apply: (surface: Locator) => Promise<void>; issue: string}[]}[] = [
  {name: 'Driver', tab: /^Driver$/, expected: PHONE_DRIVER_INVENTORY, controls: 7, target: NumberField.FS_HZ},
  {name: 'Signal', tab: /^Signal$/, expected: PHONE_SIGNAL_INVENTORY, controls: 3, target: NumberField.SIGNAL_PIN_W},
  {name: 'Allpass', tab: /^Filters$/, afterOpen: page => page.getByText('+ AP', {exact: true}).click(), expected: PHONE_ALLPASS_INVENTORY, controls: 4, target: NumberField.FILTER_T_S, mutations: [{name: 'wrong enabled state', apply: async surface => { await surface.locator('.mob-fcard-tick input').evaluate(element => { if (element instanceof HTMLInputElement) element.checked = false; }); }, issue: 'checked false, expected true'}]},
];
for (const view of pages) {
  test.describe('phone ' + view.name, () => {
    test.beforeEach(async ({page}) => {
      await page.setViewportSize({width: 374, height: 705});
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await page.locator('.mob-tab').filter({hasText: view.tab}).click();
      await view.afterOpen?.(page);
    });

    test('every value control has its declared editor, access and required parts', async ({page}) => {
      const report = await page.locator('.mob-content').evaluate(measureFieldInventory, view.expected);
      expect(report.issues).toEqual([]);
      expect(report.expected).toBe(view.controls);
      expect(report.matched).toBe(view.controls);
      expect(report.controls).toBe(view.controls);
      expect(report.accounted).toBe(view.controls);
    });

    for (const mutation of view.mutations ?? []) {
      test('inventory rejects ' + mutation.name, async ({page}) => {
        const surface = page.locator('.mob-content');
        expect((await surface.evaluate(measureFieldInventory, view.expected)).issues).toEqual([]);
        await mutation.apply(surface);
        expect((await surface.evaluate(measureFieldInventory, view.expected)).issues.join('\n')).toContain(mutation.issue);
      });
    }

    test('the same detector rejects a missing required unit', async ({page}) => {
      const surface = page.locator('.mob-content');
      expect((await surface.evaluate(measureFieldInventory, view.expected)).issues).toEqual([]);
      await surface.locator(`[data-field="${view.target.value}"] .ui-field-unit`).evaluate(element => element.remove());
      expect((await surface.evaluate(measureFieldInventory, view.expected)).issues.join('\n')).toContain('unit count 0, expected 1');
    });
  });
}


test.describe('phone Driver readonly numeric rendition', () => {
  test.beforeEach(async ({page}) => {
    await page.setViewportSize({width: 374, height: 705});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator('.mob-tab').filter({hasText: /^Driver$/}).click();
  });

  test('all readonly figures use labelled native readonly inputs without spinners', async ({page}) => {
    const rows = page.locator('.mob-content .ui-field-readout');
    await expect(rows).toHaveCount(5);
    await expect(rows.locator('input[readonly]')).toHaveCount(5);
    for (const row of await rows.all()) {
      const input = row.locator('input');
      const value = await input.inputValue();
      await expect(row.locator('label')).toHaveAttribute('for', await input.getAttribute('id') ?? '');
      await expect(row.locator('.num-stepper-btn')).toHaveCount(0);
      await input.focus();
      await input.pressSequentially('123');
      await expect(input).toHaveValue(value);
    }
  });

  for (const action of ['pointer', 'keyboard'] as const) {
  test(`${action}: changing readonly units changes display without opening the editor`, async ({page}) => {
    const row = page.locator('.mob-content [data-field="Fs_hz"]');
    const unit = row.locator('.ui-field-unit');
    const before = await unit.textContent();
    const activate = {pointer: () => unit.click(), keyboard: () => unit.press('Enter')};
    await activate[action]();
    await expect(page.locator('.de-modal')).toHaveCount(0);
    await expect(unit).not.toHaveText(before ?? '');
  });
  }
});
