import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Locator} from '@playwright/test';

/**
 * Every screen that shows entered (green), calculated (blue) and not-entered (black) values has
 * the legend for them as one thin row at its bottom (John, 2026-10-14).
 */

async function expectOneThinRow(legend: Locator): Promise<void> {
  await expect(legend).toBeVisible();
  await expect(legend.getByText('Entered', {exact: true})).toBeVisible();
  await expect(legend.getByText('Calculated', {exact: true})).toBeVisible();
  await expect(legend.getByText('Not entered', {exact: true})).toBeVisible();
  await expect(legend.locator('.prov-legend-item')).toHaveCount(3);
  const items = await Promise.all((await legend.locator('.prov-legend-item').all()).map(i => i.boundingBox()));
  for (const b of items) expect(b!.y).toBeCloseTo(items[0]!.y, 0);
  expect((await legend.boundingBox())!.height).toBeLessThan(30);
}

test('the desktop project screen has the legend as one thin row at its bottom', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const legend = page.locator('.original-root > .prov-legend');
  await expectOneThinRow(legend);
  const bottom = (await legend.boundingBox())!;
  const main = (await page.locator('.original-root > .main').boundingBox())!;
  expect(bottom.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
});

test('the Learn panel has the legend as one thin row at its bottom', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.locator('.edit-btn', {hasText: 'Learn'}).click();
  await expect(page.locator('.what-if-panel')).toBeVisible();
  await expectOneThinRow(page.locator('.what-if-panel > .prov-legend'));
});

test('the phone Box, Signal and Enclosure tabs have the legend between their content and the tab bar', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  for (const tab of ['Box', 'Signal']) {
    await page.locator('.mob-tab', {hasText: tab}).click();
    const legend = page.locator('.mobile-root > .prov-legend');
    await expectOneThinRow(legend);
    const l = (await legend.boundingBox())!;
    const bar = (await page.locator('.mob-tabbar').boundingBox())!;
    expect(l.y + l.height).toBeLessThanOrEqual(bar.y + 1);
  }
});
