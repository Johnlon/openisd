/**
 * T870: on the phone a refused number entry (class inp-bad) is drawn with the same red border as on
 * desktop, not the plain grey border of an accepted box. The test acts as a user: type a value the box
 * refuses, leave the box, then read the border the browser draws.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

async function borderColour(box: Locator): Promise<string> {
  return box.evaluate(el => getComputedStyle(el).borderTopColor);
}

/** The colour the app's own red (--bad) draws as: what a refused box has on desktop. */
async function redOfTheApp(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--bad)';
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
}

async function refuse(page: Page, box: Locator, value: string): Promise<void> {
  await box.click();
  await box.fill(value);
  await box.blur();
  await expect(box).toHaveClass(/inp-bad/);
}

test.beforeEach(async ({appPage: page}) => {
  await forceMobileSkin(page);
  await page.setViewportSize({width: PIXEL_9.width, height: PIXEL_9.height});
  await page.goto('/');
  await openAMobileProject(page);
});

test('Box screen: a refused box has a red border, an accepted one does not', async ({appPage: page}) => {
  const box = mobileFieldRow(page, 'Vb').locator('input').first();
  await box.click();
  await box.fill('50');
  await box.blur();
  await expect(box).not.toHaveClass(/inp-bad/);
  const accepted = await borderColour(box);
  await refuse(page, box, '-5');
  const refused = await borderColour(box);
  expect(accepted).not.toBe(refused);
  expect(refused).toBe(await redOfTheApp(page));
});

test('Driver Editor: a refused Qts box has a red border', async ({appPage: page}) => {
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByText('Edit', {exact: true}).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  const box = page.locator('.de-fld[data-field-key="Qts"] input').first();
  await refuse(page, box, '0');
  expect(await borderColour(box)).toBe(await redOfTheApp(page));
});
