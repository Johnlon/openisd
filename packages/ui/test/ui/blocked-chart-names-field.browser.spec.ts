/**
 * A chart that cannot be drawn names the field that causes it under its reason, instead of "Fix the listed
 * inputs" with nothing listed (John, 19 Nov 2026, QO955.c3/c4: "if a chart cannot be drawn then the chart should
 * show the reason message, and the related fields also, this is particularly important on the mobile where we
 * can't see the chart and fields at the same time"; he chose "chart shows the reason AND each field causing it
 * shows it too (desktop and phone)"). Desktop says "Fix: Vent length"; the phone adds the tab, "(Box tab)".
 *
 * Set SHOT_DIR to save a screenshot of each panel.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {fillAndCommit, PageOps, setNumField} from '../fixtures/numField.js';
import type {Locator, Page} from '@playwright/test';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const shotDir = process.env['SHOT_DIR'];

/** The blocked chart's panel. */
function panel(page: Page): Locator {
  return page.locator('.gmsg', {has: page.getByText(/Can.t plot/)}).first();
}

/** The panel's closing line, once the panel is shown and carries no "listed"; saves a picture when asked. */
async function fixLine(page: Page, shot: string): Promise<Locator> {
  const p = panel(page);
  await expect(p).toBeVisible();
  await expect(p).not.toContainText(/listed/);
  if (shotDir !== undefined) await page.screenshot({path: `${shotDir}/${shot}.png`});
  return p.locator('.gmsg-foot');
}

test.describe('Original skin', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('a vented tuning the port cannot reach names Vent length', async ({page}) => {
    await new PageOps(page).setNum('#og-fb-target', '200');
    await expect(await fixLine(page, 'desktop-vented')).toHaveText('Fix: Vent length');
  });

  test('an ABC rear tuning the port cannot reach names Vent length', async ({page}) => {
    await page.locator('#og-box-type').selectOption('abc');
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    await setNumField(page, 'Tuning freq (Frc)', '2000', page.locator('.tab-section.active'));
    await expect(await fixLine(page, 'desktop-abc-rear')).toHaveText('Fix: Vent length');
  });

  test('an ABC front tuning the port cannot reach names Vent length', async ({page}) => {
    await page.locator('#og-box-type').selectOption('abc');
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    await setNumField(page, 'Tuning freq (Ffc)', '900', page.locator('.tab-section.active'));
    await expect(await fixLine(page, 'desktop-abc-front')).toHaveText('Fix: Vent length');
  });
});

test.describe('Mobile skin', () => {
  test.use({viewport: PIXEL_9});

  test.beforeEach(async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('a vented tuning the port cannot reach names Vent length and the Box tab', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('vented');
    await fillAndCommit(mobileFieldRow(page, 'Fb').locator('input'), '200');
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await expect(await fixLine(page, 'phone-vented')).toHaveText('Fix: Vent length (Box tab)');
  });

  test('an ABC rear tuning the port cannot reach names Vent length and the Box tab', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('abc');
    await fillAndCommit(page.locator('.ui-field', {hasText: 'Frc'}).locator('input'), '2000');
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await expect(await fixLine(page, 'phone-abc-rear')).toHaveText('Fix: Vent length (Box tab)');
  });

  test('an ABC front tuning the port cannot reach names Vent length and the Box tab', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('abc');
    await fillAndCommit(page.locator('.ui-field', {hasText: 'Ffc'}).locator('input'), '900');
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await expect(await fixLine(page, 'phone-abc-front')).toHaveText('Fix: Vent length (Box tab)');
  });
});
