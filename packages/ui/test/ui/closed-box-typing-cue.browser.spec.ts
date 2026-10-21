/**
 * A closed box's Fsc and Qtc can be typed in OpenISD but not in WinISD, which lets you type only the
 * volume (observed in WinISD's control list, winisd_research PROBE_FINDINGS.md, 17 Oct 2026). Each of
 * the two fields carries a ≠W cue that opens the help page at its entry, on both skins; a vented box
 * has no such cue.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const TITLE = 'WinISD lets you type only the volume of a closed box';
const cueOf = (page: Page, label: 'Fsc' | 'Qtc') =>
  page.locator('.ui-field', {has: page.locator('label', {hasText: new RegExp(`^${label}$`)})}).locator('button.winisd-deviation-cue');

for (const skin of ['desktop', 'mobile'] as const) {
  const volume = skin === 'mobile' ? 'Vb' : 'Volume';

  test.describe(`${skin}: the closed box's Fsc and Qtc carry a ≠W cue`, () => {
    test.beforeEach(async ({appPage: page}) => {
      if (skin === 'mobile') await forceMobileSkin(page);
      await page.goto('/');
      if (skin === 'mobile') await openAMobileProject(page); else await openAProject(page);
    });

    test('both fields have it on a closed box, and a click opens the entry', async ({appPage: page}) => {
      await setFocusedBoxType(page, 'sealed');
      for (const label of ['Fsc', 'Qtc'] as const) {
        await expect(cueOf(page, label)).toHaveAttribute('title', `Differs from WinISD: ${TITLE}`);
      }
      await cueOf(page, 'Qtc').click();
      const help = page.getByRole('dialog', {name: 'OpenISD and WinISD differences'});
      await expect(help).toBeVisible();
      await expect(help.locator('.wd-entry.current h4, .mob-dcard.current .mob-dcard-title')).toHaveText(TITLE);
    });

    test('the cue never moves the field: Fsc and Qtc rows are as wide as the Volume row', async ({appPage: page}) => {
      await setFocusedBoxType(page, 'sealed');
      const inputWidth = async (label: string) => Math.round((await page.locator('.ui-field', {has: page.locator('label', {hasText: new RegExp(`^${label}$`)})}).locator('input').first().boundingBox())?.width ?? NaN);
      expect(await inputWidth('Fsc')).toBe(await inputWidth(volume));
      expect(await inputWidth('Qtc')).toBe(await inputWidth(volume));
    });

    test('a vented box has no such field and no cue', async ({appPage: page}) => {
      await setFocusedBoxType(page, 'vented');
      await expect(cueOf(page, 'Fsc')).toHaveCount(0);
      await expect(cueOf(page, 'Qtc')).toHaveCount(0);
    });
  });
}
