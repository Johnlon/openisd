/**
 * A passive radiator box can be typed more freely in OpenISD than in WinISD (observed in WinISD's own
 * Box and Passive Radiator tabs, winisd_research runs/pr_box_tab2.png and pr_addedmass_tab.png):
 * WinISD greys out Fh on the Box tab and shows no Mms or Cms. Each field carries a ≠W cue that opens
 * the help page at its entry, on both skins.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const FH_TITLE = 'WinISD lets you type the passive radiator tuning only on the Passive Radiator tab';
const FIGURES_TITLE = 'WinISD has no Mms or Cms on the Passive Radiator tab';

const rowOf = (page: Page, label: RegExp): Locator =>
  page.locator('.ui-field', {has: page.locator('label', {hasText: label})});
const cueOf = (page: Page, label: RegExp): Locator => rowOf(page, label).locator('button.winisd-deviation-cue');

for (const skin of ['desktop', 'mobile'] as const) {
  test.describe(`${skin}: the passive radiator's typeable Fh, Mms and Cms carry a ≠W cue`, () => {
    test.beforeEach(async ({appPage: page}) => {
      if (skin === 'mobile') await forceMobileSkin(page);
      await page.goto('/');
      if (skin === 'mobile') await openAMobileProject(page); else await openAProject(page);
      await setFocusedBoxType(page, 'box-passive-radiator');
    });

    const openTab = async (page: Page, tab: 'Box' | 'Passive Radiator'): Promise<void> => {
      if (skin === 'mobile') await page.locator('.mob-tab', {hasText: 'Box'}).click();
      else await page.locator('.project-nav li', {hasText: tab}).first().click();
    };

    test('Fh on the Box tab is typeable and has the cue, which opens its entry', async ({appPage: page}) => {
      await openTab(page, 'Box');
      const fh = rowOf(page, /^Fh$/);
      await expect(fh.locator('input').first()).toBeEditable();
      await expect(cueOf(page, /^Fh$/)).toHaveAttribute('title', `Differs from WinISD: ${FH_TITLE}`);
      await cueOf(page, /^Fh$/).click();
      const help = page.getByRole('dialog', {name: 'OpenISD and WinISD differences'});
      await expect(help).toBeVisible();
      await expect(help.locator('.wd-entry.current h4, .mob-dcard.current .mob-dcard-title')).toHaveText(FH_TITLE);
    });

    test('Mms and Cms on the Passive Radiator tab are typeable and have the cue', async ({appPage: page}) => {
      await openTab(page, 'Passive Radiator');
      for (const label of [/^Mms$/, /^Cms$/]) {
        await expect(rowOf(page, label).locator('input').first()).toBeEditable();
        await expect(cueOf(page, label)).toHaveAttribute('title', `Differs from WinISD: ${FIGURES_TITLE}`);
      }
      await cueOf(page, /^Cms$/).click();
      const help = page.getByRole('dialog', {name: 'OpenISD and WinISD differences'});
      await expect(help.locator('.wd-entry.current h4, .mob-dcard.current .mob-dcard-title')).toHaveText(FIGURES_TITLE);
    });

    test('the Box tab of a vented box has no passive radiator cue', async ({appPage: page}) => {
      await setFocusedBoxType(page, 'vented');
      await openTab(page, 'Box');
      await expect(page.locator(`button.winisd-deviation-cue[title="Differs from WinISD: ${FH_TITLE}"]`)).toHaveCount(0);
    });
  });
}
