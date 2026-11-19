import {expect, openTab, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {PhoneWizardText} from '@openisd/design/fields';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

/**
 * Journey (T921): a person makes a vented project with the Tang Band W5-1138SMF, sets 2 drivers on the Driver tab and
 * picks the vented Alignment on the Box tab. WinISD 0.7.0 proposes twice the volume and the same tuning
 * (winisd_research/runs/vented-picker-ndrivers-20261118/RESULT.md, C4/SC4: one driver 10.6966 L, two drivers 21.3932 L,
 * Fb 35.9002 Hz in both). It missed the defect (the vented picker used one driver's Vas whatever the count). Acts only as
 * a person does: the wizard, the tabs, the Alignment popup. No state is read or seeded.
 */

interface Skin {
  readonly name: string;
  newProject(page: Page): Promise<Locator>;
  next(page: Page): Locator;
  create(page: Page): Locator;
  volume(page: Page): Locator;
  setDrivers(page: Page, n: number): Promise<void>;
  pickAlignment(page: Page): Promise<void>;
}

const desktop: Skin = {
  name: 'desktop',
  newProject: async page => { await page.locator('.tb-btn[title*="New project"]').click(); return page.locator('.overlay.open'); },
  next: page => page.locator('.overlay.open .modal-footer').getByRole('button', {name: 'Next', exact: true}),
  create: page => page.locator('.overlay.open .modal-footer').getByRole('button', {name: 'Create', exact: true}),
  volume: page => page.locator('#og-box-volume'),
  setDrivers: async (page, n) => {
    await openTab(page, 'Driver');
    await page.locator('.tab-section.active .field', {hasText: 'Num. of drivers'}).locator('select').selectOption(String(n));
  },
  pickAlignment: async page => {
    await openTab(page, 'Box');
    await page.getByRole('button', {name: 'Alignment', exact: true}).click();
    await expect(page.locator('.alignment-modal')).toBeVisible();
    await page.locator('.alignment-modal button.ok-btn').click();
    await expect(page.locator('.alignment-modal')).toBeHidden();
  },
};

const phone: Skin = {
  name: 'phone',
  newProject: async page => { await page.getByText('New project').click(); return page.locator('.mob-np-overlay'); },
  next: page => page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.NEXT, exact: true}),
  create: page => page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.CREATE, exact: true}),
  volume: page => mobileFieldRow(page, 'Vb').locator('input').first(),
  setDrivers: async (page, n) => {
    await openTab(page, 'Driver');
    await page.locator('#mob-n-drivers').selectOption(String(n));
  },
  pickAlignment: async page => {
    await openTab(page, 'Box');
    await page.locator('.mob-clink', {hasText: 'Choose alignment'}).click();
    await expect(page.locator('.mob-align-sheet')).toBeVisible();
    await page.locator('.mob-align-footer .mob-btn-primary', {hasText: 'Accept'}).click();
    await expect(page.locator('.mob-align-sheet')).toHaveCount(0);
  },
};

async function litres(box: Locator): Promise<number> {
  return Number(await box.inputValue());
}

/** The person's actions up to a vented project on the Box tab. The driver is the catalogue's, never a My Drivers copy of
 *  the same name (another spec's import stays in My Drivers on the shared page). */
async function makeProject(skin: Skin, page: Page): Promise<void> {
  const root = await skin.newProject(page);
  await expect(root).toBeVisible();
  await root.locator('input.filter').fill('W5-1138SMF');
  await root.locator('.dlist .ditem:not(.my-ditem)', {hasText: 'W5-1138SMF'}).first().click();
  await expect(root.locator('.preview .prev-name')).toContainText('W5-1138SMF');
  await skin.next(page).click();
  await skin.next(page).click();
  await root.locator('#np-box-type').selectOption('vented');
  await skin.next(page).click();
  await skin.next(page).click();
  await skin.create(page).click();
  await expect(root).toHaveCount(0);
  await openTab(page, 'Box');
}

/** The person's actions: pick the Alignment with 1 driver, then with 2; the volumes the Box tab shows after each. */
async function volumesAfterAlignment(skin: Skin, page: Page): Promise<{one: number; two: number}> {
  await makeProject(skin, page);
  await skin.pickAlignment(page);
  await expect(skin.volume(page)).toHaveValue(/\d/);
  const one = await litres(skin.volume(page));
  await skin.setDrivers(page, 2);
  await skin.pickAlignment(page);
  await expect.poll(() => litres(skin.volume(page)), {message: 'the volume the second Alignment pick writes'}).not.toBe(one);
  return {one, two: await litres(skin.volume(page))};
}

test.describe('Journey: the vented Alignment counts the number of drivers', () => {
  test('desktop: 2 drivers then the vented Alignment proposes twice the volume', async ({appPage: page}) => {
    const {one, two} = await volumesAfterAlignment(desktop, page);
    expect(one, 'one driver: WinISD\'s 10.70 L').toBeCloseTo(10.70, 2);
    expect(two, 'two drivers: WinISD\'s 21.39 L').toBeCloseTo(21.39, 2);
  });

  test.describe('phone', () => {
    test.use({isMobile: true, hasTouch: true, viewport: {width: 374, height: 705}});

    test('phone: 2 drivers then the vented Alignment proposes twice the volume', async ({page}) => {
      await forceMobileSkin(page);
      await page.goto('/');
      const {one, two} = await volumesAfterAlignment(phone, page);
      expect(one, 'one driver: WinISD\'s 10.70 L').toBeCloseTo(10.70, 2);
      expect(two, 'two drivers: WinISD\'s 21.39 L').toBeCloseTo(21.39, 2);
    });
  });
});
