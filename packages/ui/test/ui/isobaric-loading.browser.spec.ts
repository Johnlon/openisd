/**
 * Iso-Barik loading is on, on each shell (T919, QO953.c38 "A: turn on isobaric"). A user's actions only.
 *  - Driver tab: pick Iso-Barik; the Box tab's closed box then gives, in half the volume, the Qtc it gave in the whole volume.
 *  - New project: pick Iso-Barik on the driver count step; the new project's Driver tab shows it chosen.
 * The pictures it takes (before and after) go to the folder named by ISOBARIC_PICTURES when that is set.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, expectChartDrawn, openAMobileProject, openAProject, openTab, setFocusedBoxType, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

type Shell = 'desktop' | 'phone';
const TEST_DRIVER = 'Tang Band W5-1138SMF';
const PICTURES = process.env['ISOBARIC_PICTURES'];

async function open(page: Page, shell: Shell): Promise<void> {
  if (shell === 'phone') {
    await page.setViewportSize(PIXEL_9);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
  } else {
    await page.goto('/');
    await openAProject(page);
  }
}

const field = (page: Page, label: string): Locator => page.locator('.ui-field', {has: page.locator('label', {hasText: new RegExp(`^${label}$`)})}).locator('input').first();

async function picture(page: Page, name: string): Promise<void> {
  if (PICTURES !== undefined) await page.screenshot({path: `${PICTURES}/${name}.png`, fullPage: false});
}

/** Chooses Iso-Barik on the Driver tab the way a user does. */
async function chooseIsobaric(page: Page, shell: Shell): Promise<void> {
  await openTab(page, 'Driver');
  if (shell === 'phone') await page.locator('#mob-driver-placement').selectOption('isobaric');
  else await page.locator('input[name=og-placement][type=radio]').nth(1).check();
}

for (const shell of ['desktop', 'phone'] as const) {
  const volume = shell === 'phone' ? 'Vb' : 'Volume';

  test.describe(`${shell}: Iso-Barik`, () => {
    test('Driver tab: Iso-Barik is offered, not greyed, and the closed box reads the same Qtc in half the volume', async ({appPage: page}) => {
      await open(page, shell);
      await setFocusedBoxType(page, 'sealed');
      const vb = Number(await field(page, volume).inputValue());
      const standardQtc = await field(page, 'Qtc').inputValue();
      await picture(page, `${shell}-1-before-box-standard`);

      await openTab(page, 'Driver');
      if (shell === 'phone') {
        const select = page.locator('#mob-driver-placement');
        await expect(select).toBeEnabled();
        await expect(select).toHaveValue('standard');
      } else {
        await expect(page.locator('input[name=og-placement][type=radio]').nth(1)).toBeEnabled();
        await expect(page.locator('input[name=og-placement][type=radio]').nth(0)).toBeChecked();
      }
      await expect(page.locator('.radio-group, .mob-crow').filter({hasText: 'Iso-Barik'})).not.toContainText('not modelled');
      await picture(page, `${shell}-2-before-driver-standard`);

      await chooseIsobaric(page, shell);
      await picture(page, `${shell}-3-after-driver-isobaric`);
      if (shell === 'phone') await expect(page.locator('#mob-driver-placement')).toHaveValue('isobaric');
      else await expect(page.locator('input[name=og-placement][type=radio]').nth(1)).toBeChecked();

      await openTab(page, 'Box');
      // The same box volume now reads a lower Qtc (the pair has half the Vas) ...
      expect(Number(await field(page, 'Qtc').inputValue())).toBeLessThan(Number(standardQtc));
      await picture(page, `${shell}-4-after-box-isobaric-same-volume`);
      // ... and half the volume gives the Qtc the standard driver gave in the whole.
      await fillAndBlur(field(page, volume), String(vb / 2));
      await expect(field(page, 'Qtc')).toHaveValue(standardQtc);
      await picture(page, `${shell}-5-after-box-isobaric-half-volume`);
      if (shell === 'phone') await page.locator('.mob-tab', {hasText: 'Graph'}).click();
      await expectChartDrawn(page);
      await picture(page, `${shell}-5b-chart-isobaric`);
    });

    test('New project: Iso-Barik chosen on the count step is what the new project has', async ({appPage: page}) => {
      if (shell === 'phone') {
        await page.setViewportSize(PIXEL_9);
        await forceMobileSkin(page);
        await page.goto('/');
        await page.locator('.mob-hamburger').click();
        await page.locator('.mob-menu-item', {hasText: 'New project'}).click();
        await page.getByText(TEST_DRIVER).click();
        const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
        await next.click();
        await expect(page.locator('#np-placement')).toBeEnabled();
        await page.locator('#np-placement').selectOption('isobaric');
        await picture(page, 'phone-6-new-project-isobaric');
        await next.click();
        await page.locator('#np-box-type').selectOption({label: 'Closed'});
        await next.click();
        await next.click();
        await page.locator('.mob-np-footer').getByText('Create Project', {exact: true}).click();
        await expect(page.locator('.mob-np-overlay')).toBeHidden();
      } else {
        await page.goto('/');
        await page.locator('.tb-btn[title*="New project"]').click();
        const overlay = page.locator('.overlay.open');
        await overlay.locator('.dlist .ditem', {hasText: 'W5-1138SMF'}).first().click();
        const next = overlay.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true});
        await next.click();
        await expect(overlay.locator('input[name=placement][value=isobaric]')).toBeEnabled();
        await overlay.locator('input[name=placement][value=isobaric]').check();
        await picture(page, 'desktop-6-new-project-isobaric');
        for (let i = 0; i < 6 && await next.isVisible(); i++) await next.click();
        await overlay.locator('.modal-footer').getByRole('button', {name: 'Create', exact: true}).click();
        await expect(overlay).toBeHidden();
      }
      await openTab(page, 'Driver');
      if (shell === 'phone') await expect(page.locator('#mob-driver-placement')).toHaveValue('isobaric');
      else await expect(page.locator('input[name=og-placement][type=radio]').nth(1)).toBeChecked();
      await picture(page, `${shell}-7-new-project-driver-tab`);
    });
  });
}
