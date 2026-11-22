import {expect, openTab, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {PhoneWizardText} from '@openisd/design/fields';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

/**
 * Journey (T910): a person picks a sealed alignment in the New project wizard, makes the project and reads the Box tab.
 * The Box tab's Qtc must be the Qtc picked, to the figures it shows: the pick is the person's choice, so a different figure
 * means the two screens disagree. It would have caught bugs/BUG_20261118_wizard-rounds-the-picked-sealed-volume.md
 * (T902): the wizard rounded the volume it picked to the volume field's decimals, so a pick of 0.900 read 0.8999 on the Box tab.
 * Acts only as a person does: the wizard, its alignment list, the tabs. Nothing is read or set behind the screen.
 * The Tang Band W5-1138SMF at the project's default losses; the picks are the wizard's own list (a figure the driver cannot reach,
 * such as 0.500 for this driver, is not offered here).
 */

const DRIVER = 'W5-1138SMF';
const PICKS = [0.577, 0.707, 0.8, 0.9, 1, 1.1, 1.2, 1.5] as const;

/** Journeys that fail because of an app bug: the bug file, red until fixed (`test.fail`). Key: the test's title. */
const KNOWN: ReadonlyMap<string, string> = new Map([]);

interface Skin {
  newProject(page: Page): Promise<Locator>;
  next(page: Page): Locator;
  create(page: Page): Locator;
  qtc(page: Page): Locator;
}

const desktop: Skin = {
  newProject: async page => { await page.locator('.tb-btn[title*="New project"]').click(); return page.locator('.overlay.open'); },
  next: page => page.locator('.overlay.open .modal-footer').getByRole('button', {name: 'Next', exact: true}),
  create: page => page.locator('.overlay.open .modal-footer').getByRole('button', {name: 'Create', exact: true}),
  qtc: page => page.locator('#og-box-qtc'),
};

const phone: Skin = {
  newProject: async page => { await page.getByText('New project').click(); return page.locator('.mob-np-overlay'); },
  next: page => page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.NEXT, exact: true}),
  create: page => page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.CREATE, exact: true}),
  qtc: page => mobileFieldRow(page, 'Qtc').locator('input').first(),
};

/** The person's actions: pick the driver, a closed box, an alignment, make the project, open the Box tab. */
async function pickAndRead(skin: Skin, page: Page, pick: number): Promise<string> {
  const root = await skin.newProject(page);
  await expect(root).toBeVisible();
  await root.locator('input.filter').fill(DRIVER);
  await root.locator('.dlist .ditem', {hasText: DRIVER}).first().click();
  await expect(root.locator('.preview .prev-name')).toContainText(DRIVER);
  await skin.next(page).click();
  await skin.next(page).click();
  await root.locator('#np-box-type').selectOption('sealed');
  await skin.next(page).click();
  await root.locator('#np-alignment').selectOption(String(pick));
  await skin.next(page).click();
  await skin.create(page).click();
  await expect(root).toHaveCount(0);
  await openTab(page, 'Box');
  await expect(skin.qtc(page)).not.toHaveValue('');
  return skin.qtc(page).inputValue();
}

test.describe('Journey: the Box tab shows the Qtc the wizard picked', () => {
  for (const pick of PICKS) {
    const name = `desktop: pick ${pick}`;

    test(name, async ({appPage: page}) => {
      test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
      const shown = await pickAndRead(desktop, page, pick);
      expect(Number(shown), `picked Qtc ${pick}, the Box tab reads ${shown}`).toBe(pick);
    });
  }

  test.describe('phone', () => {
    test.use({isMobile: true, hasTouch: true, viewport: {width: 374, height: 705}});

    for (const pick of PICKS) {
      const name = `phone: pick ${pick}`;

      test(name, async ({page}) => {
        test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
        await forceMobileSkin(page);
        await page.goto('/');
        const shown = await pickAndRead(phone, page, pick);
        expect(Number(shown), `picked Qtc ${pick}, the Box tab reads ${shown}`).toBe(pick);
      });
    }
  });
});
