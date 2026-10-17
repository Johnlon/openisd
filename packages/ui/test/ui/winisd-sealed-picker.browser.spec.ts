import {expect, openAProject, setFocusedBoxType, setFocusedDriverSpecs, setFocusedSealedLosses, shownBoxVolume, test, W5_1138SMF} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {owdrText} from '../fixtures/seedMyDrivers.js';

/**
 * "Sealed picker volume" (WinISD Compatibility, Enable WinISD bugs): ticked, the sealed alignment picker gives
 * WinISD's volume. The W5-1138SMF (Qts 0.49, Vas 4.85 L, Ql 10, Qa 100) at Qtc 0.800: WinISD 3.13 L, whose
 * Box tab shows Qtc 0.787; OpenISD 2.96 L, whose Box tab shows 0.800.
 */

const W5 = {Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: null, Vas_m3: 0.00485, Re_ohm: 3.4} as const;
const switchLabel = (page: Page) => page.locator('label[data-field-key="winisdSealedPicker"]');
const qtcInput = (page: Page) => page.locator('.box-layout .field', {hasText: 'Qtc'}).locator('input');

async function setSwitch(page: Page, on: boolean): Promise<void> {
  await page.locator('li', {hasText: /^Advanced$/}).click();
  await switchLabel(page).locator('input').setChecked(on);
}

/** Open the Box tab's alignment dialog, pick Qtc 0.800, and return the volume it shows. */
async function pick0800(page: Page): Promise<number> {
  await page.locator('.project-nav li', {hasText: /^Box$/}).click();
  await page.getByRole('button', {name: 'Alignment', exact: true}).click();
  await page.locator('.alignment-modal select').selectOption('0.8');
  return Number(await page.locator('.alignment-modal input[data-numinput], .alignment-modal input[type="number"]').inputValue());
}

test.beforeEach(async ({appPage: page}) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedDriverSpecs(page, W5);
  await setFocusedBoxType(page, 'sealed');
  await setFocusedSealedLosses(page, {Ql: 10, Qa: 100});
});

test.describe('Sealed picker volume switch', () => {
  test('unticked (default), Qtc 0.800 gives the volume at which the Box tab shows 0.800', async ({appPage: page}) => {
    await setSwitch(page, false);
    expect(await pick0800(page)).toBeCloseTo(2.96, 2);
    await page.locator('.alignment-modal button.ok-btn').click();
    expect(await shownBoxVolume(page)).toBeCloseTo(2.96, 2);
    expect(parseFloat(await qtcInput(page).inputValue())).toBeCloseTo(0.8, 3);
  });

  test('ticked, Qtc 0.800 gives WinISD\'s 3.13 L, and the Box tab shows 0.787', async ({appPage: page}) => {
    await setSwitch(page, true);
    expect(await pick0800(page)).toBeCloseTo(3.13, 2);
    await page.locator('.alignment-modal button.ok-btn').click();
    expect(await shownBoxVolume(page)).toBeCloseTo(3.13, 2);
    expect(parseFloat(await qtcInput(page).inputValue())).toBeCloseTo(0.787, 3);
  });

  test('unticked again, the picker gives OpenISD\'s volume back', async ({appPage: page}) => {
    await setSwitch(page, true);
    await setSwitch(page, false);
    expect(await pick0800(page)).toBeCloseTo(2.96, 2);
  });

  test('the ≠W cue sits by the picker while the switch is unticked, and goes once ticked', async ({appPage: page}) => {
    await setSwitch(page, false);
    await pick0800(page);
    const cue = page.locator('.alignment-modal .winisd-deviation-cue');
    await expect(cue).toBeVisible();
    await page.locator('.alignment-modal button.cancel-btn').click();
    await setSwitch(page, true);
    await pick0800(page);
    await expect(cue).toHaveCount(0);
  });

  test('the switch is the yellow bug switch, under Enable WinISD bugs, unticked in a new project', async ({appPage: page}) => {
    await page.locator('li', {hasText: /^Advanced$/}).click();
    await expect(page.locator('.error-switch-group label[data-field-key="winisdSealedPicker"]')).toHaveCount(1);
    await expect(switchLabel(page)).toHaveClass(/error-switch-marked/);
    await expect(switchLabel(page)).toContainText('Sealed picker volume');
    await expect(switchLabel(page).locator('input')).not.toBeChecked();
    await expect(switchLabel(page).locator('input')).toBeEnabled();
  });

  test.describe('New Project wizard', () => {
    async function wizardVolume(page: Page): Promise<number> {
      await page.locator('.tb-btn[title*="New project"]').click();
      const modal = page.locator('.overlay.open');
      await modal.locator('input[type=file]').setInputFiles({
        name: 'W5.owdr', mimeType: 'application/x-openisd-driver', buffer: Buffer.from(owdrText(W5_1138SMF.toSeedDriver(), '00000000-0000-4000-8000-000000000001')),
      });
      await modal.locator('button', {hasText: 'Next'}).click();
      await modal.locator('button', {hasText: 'Next'}).click();
      await modal.locator('.field', {hasText: 'Box type'}).locator('select').selectOption('sealed');
      await modal.locator('button', {hasText: 'Next'}).click();
      await modal.locator('#np-alignment').selectOption('0.8');
      return Number(await modal.locator('#np-sealed-volume').inputValue());
    }

    test('unticked, the wizard picker gives OpenISD\'s volume and carries the ≠W cue', async ({appPage: page}) => {
      await setSwitch(page, false);
      const unticked = await wizardVolume(page);
      await expect(page.locator('.overlay.open .winisd-deviation-cue')).toBeVisible();
      expect(unticked).toBeCloseTo(2.96, 1);
    });

    test('ticked on the open project, the wizard picker gives WinISD\'s volume and no cue', async ({appPage: page}) => {
      await setSwitch(page, true);
      const ticked = await wizardVolume(page);
      await expect(page.locator('.overlay.open .winisd-deviation-cue')).toHaveCount(0);
      expect(ticked).toBeCloseTo(3.13, 1);
    });
  });
});
