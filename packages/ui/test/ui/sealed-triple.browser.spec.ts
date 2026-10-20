/**
 * A closed box's Volume, Fsc and Qtc each fix the other two, so on the Box tab one is entered and the
 * other two are calculated; entering one makes it the entered one, and clearing the entered one gives
 * the entry to Volume (to Qtc for a cleared Volume). docs/design/FIELD_CLEAR_RULE.md, John 16 Oct 2026.
 * The maths is tested in packages/design; this proves both skins show and take it.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {fillAndCommit} from '../fixtures/numField.js';

type Skin = 'desktop' | 'mobile';
type Quantity = 'Volume' | 'Fsc' | 'Qtc';
type Provenance = 'value-e' | 'value-c';

const input = (page: Page, quantity: Quantity): Locator =>
  page.locator('.ui-field', {has: page.locator('label', {hasText: new RegExp(`^${quantity === 'Volume' ? '(Volume|Vb)' : quantity}$`)})}).locator('input').first();

async function provenances(page: Page): Promise<Record<Quantity, Provenance>> {
  const of = async (q: Quantity): Promise<Provenance> =>
    (await input(page, q).getAttribute('class'))?.includes('value-e') ? 'value-e' : 'value-c';
  return {Volume: await of('Volume'), Fsc: await of('Fsc'), Qtc: await of('Qtc')};
}

const entered = (q: Quantity): Record<Quantity, Provenance> =>
  ({Volume: 'value-c', Fsc: 'value-c', Qtc: 'value-c', [q]: 'value-e'});

for (const skin of ['desktop', 'mobile'] as const satisfies readonly Skin[]) {
  test.describe(`${skin}: a closed box's Volume, Fsc and Qtc`, () => {
    test.beforeEach(async ({appPage: page}) => {
      if (skin === 'mobile') await forceMobileSkin(page);
      await page.goto('/');
      if (skin === 'mobile') await openAMobileProject(page); else await openAProject(page);
      await setFocusedBoxType(page, 'sealed');
      await fillAndCommit(input(page, 'Volume'), '20');
    });

    test('a typed Volume is the entered one', async ({appPage: page}) => {
      expect(await provenances(page)).toEqual(entered('Volume'));
    });

    test('a typed Fsc is the entered one: Volume and Qtc follow it', async ({appPage: page}) => {
      const volumeBefore = await input(page, 'Volume').inputValue();
      const qtcBefore = await input(page, 'Qtc').inputValue();
      await fillAndCommit(input(page, 'Fsc'), '70');
      expect(await provenances(page)).toEqual(entered('Fsc'));
      await expect(input(page, 'Fsc')).toHaveValue(/^70/);
      await expect(input(page, 'Volume')).not.toHaveValue(volumeBefore);
      await expect(input(page, 'Qtc')).not.toHaveValue(qtcBefore);
    });

    test('clearing the typed Fsc hands the entry to Volume, with every value unchanged', async ({appPage: page}) => {
      await fillAndCommit(input(page, 'Fsc'), '70');
      const shown = {Volume: await input(page, 'Volume').inputValue(), Qtc: await input(page, 'Qtc').inputValue()};
      await fillAndCommit(input(page, 'Fsc'), '');
      expect(await provenances(page)).toEqual(entered('Volume'));
      await expect(input(page, 'Fsc')).toHaveValue(/^70/);
      await expect(input(page, 'Volume')).toHaveValue(shown.Volume);
      await expect(input(page, 'Qtc')).toHaveValue(shown.Qtc);
    });

    test('a typed Qtc is the entered one: Volume and Fsc follow it', async ({appPage: page}) => {
      const volumeBefore = await input(page, 'Volume').inputValue();
      await fillAndCommit(input(page, 'Qtc'), '0.8');
      expect(await provenances(page)).toEqual(entered('Qtc'));
      await expect(input(page, 'Qtc')).toHaveValue(/^0\.8/);
      await expect(input(page, 'Volume')).not.toHaveValue(volumeBefore);
    });

    test('clearing the typed Qtc hands the entry to Volume, with every value unchanged', async ({appPage: page}) => {
      await fillAndCommit(input(page, 'Qtc'), '0.8');
      const shown = {Volume: await input(page, 'Volume').inputValue(), Fsc: await input(page, 'Fsc').inputValue()};
      await fillAndCommit(input(page, 'Qtc'), '');
      expect(await provenances(page)).toEqual(entered('Volume'));
      await expect(input(page, 'Qtc')).toHaveValue(/^0\.8/);
      await expect(input(page, 'Volume')).toHaveValue(shown.Volume);
      await expect(input(page, 'Fsc')).toHaveValue(shown.Fsc);
    });

    test('a Volume typed after a Qtc takes the entry back', async ({appPage: page}) => {
      await fillAndCommit(input(page, 'Qtc'), '0.8');
      await fillAndCommit(input(page, 'Volume'), '25');
      expect(await provenances(page)).toEqual(entered('Volume'));
      await expect(input(page, 'Volume')).toHaveValue(/^25/);
    });

    test('clearing the typed Volume hands the entry to Qtc, with every value unchanged', async ({appPage: page}) => {
      const shown = {Qtc: await input(page, 'Qtc').inputValue(), Fsc: await input(page, 'Fsc').inputValue()};
      await fillAndCommit(input(page, 'Volume'), '');
      expect(await provenances(page)).toEqual(entered('Qtc'));
      await expect(input(page, 'Qtc')).toHaveValue(shown.Qtc);
      await expect(input(page, 'Fsc')).toHaveValue(shown.Fsc);
      await expect(input(page, 'Volume')).toHaveValue(/^20/);
    });
  });
}
