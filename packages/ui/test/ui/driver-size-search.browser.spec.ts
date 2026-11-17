/**
 * Search by size (issue 516, John 14 Nov 2026): a size chip row filters the driver library by the
 * class worked out from Sd. The class is for searching only, so wherever a row shows it, it says
 * "from Sd" and never reads as the maker's nominal size. Both skins.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const DERIVED_5 = '≈ 5 in (from Sd)';

/** The test catalogue holds 16 drivers; three have an Sd that gives the 5 in class. */
async function expectOnlySize5Listed(page: Page): Promise<void> {
  const rows = page.locator('.dlist .ditem:not(.my-ditem)');
  await expect(rows.first()).toBeVisible();
  await expect(rows).toHaveCount(3);
  for (const label of await rows.locator('.dsize').allTextContents()) expect(label).toBe(DERIVED_5);
  await expect(rows.locator('.dsize')).toHaveCount(await rows.count());
}

test('desktop: the 5 in size chip narrows the library to drivers whose Sd gives that class', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  const all = await page.locator('.dlist .ditem:not(.my-ditem)').count();
  await page.locator('.size-row .zchip', {hasText: /^5$/}).click();
  await expectOnlySize5Listed(page);
  expect(await page.locator('.dlist .ditem:not(.my-ditem)').count()).toBeLessThan(all);
  await expect(page.locator('.filters-on-pill', {hasText: 'from Sd'})).toBeVisible();
  await page.locator('.filters-on .filters-clear').click();
  await expect(page.locator('.size-row .zchip.active')).toHaveCount(0);
});

test('phone: the 5 in size chip, inside Filters, narrows the library and the rows say from Sd', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByText('Select driver').click();
  await page.locator('.dl-filters-toggle').click();
  await page.locator('.size-row .zchip', {hasText: /^5$/}).click();
  await expectOnlySize5Listed(page);
  await expect(page.locator('.dl-filters-toggle')).toContainText('(1)');
});

/** Rule 2 of field-layout.md: nothing is clipped. With a size chosen the filters take more room, so the list
 *  gives way (shrinks and scrolls) and the footer buttons stay whole inside the dialog and the viewport. */
async function expectFooterWholeAndListShowsARow(page: Page, dialog: string): Promise<void> {
  const frame = await page.locator(dialog).boundingBox();
  const viewport = page.viewportSize();
  expect(frame).not.toBeNull();
  expect(viewport).not.toBeNull();
  const buttons = page.locator('.driver-library .browser-footer button');
  expect(await buttons.count()).toBeGreaterThanOrEqual(2);
  for (const name of ['Add new Driver', 'Load File…']) {
    const box = await page.locator('.driver-library .browser-footer button', {hasText: name}).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x, `${name} left`).toBeGreaterThanOrEqual(frame!.x);
    expect(box!.y, `${name} top`).toBeGreaterThanOrEqual(frame!.y);
    expect(box!.x + box!.width, `${name} right`).toBeLessThanOrEqual(frame!.x + frame!.width + 0.5);
    expect(box!.y + box!.height, `${name} bottom in dialog`).toBeLessThanOrEqual(frame!.y + frame!.height + 0.5);
    expect(box!.y + box!.height, `${name} bottom in viewport`).toBeLessThanOrEqual(viewport!.height);
  }
  const row = await page.locator('.dlist .ditem:not(.my-ditem)').first().boundingBox();
  const list = await page.locator('.dlist').boundingBox();
  expect(row).not.toBeNull();
  expect(list).not.toBeNull();
  expect(row!.height).toBeGreaterThan(0);
  expect(row!.y + row!.height, 'first row inside the list').toBeLessThanOrEqual(list!.y + list!.height + 0.5);
}

for (const size of [{width: 1880, height: 1000}, {width: 1280, height: 720}]) {
  test(`desktop ${size.width}x${size.height}: with a size chosen the footer buttons stay inside the dialog and the list keeps a row`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await openAProject(page);
    await page.locator('[title*="librar" i]').first().click();
    await page.locator('.size-row .zchip', {hasText: /^5$/}).click();
    await expect(page.locator('.dlist .ditem:not(.my-ditem)')).toHaveCount(3);
    await expectFooterWholeAndListShowsARow(page, '.overlay.on .wb-modal');
  });
}

/** The dialog's short-screen behaviour belongs to this feature: the filters give way (and scroll inside themselves)
 *  so the list always shows a row or its empty state, and the footer stays in view, on any phone size. */
const PHONES = [{width: 360, height: 640}, {width: 374, height: 705}, {width: 390, height: 844}, {width: 412, height: 600}];

async function openPhoneLibraryWithSize(page: Page, size: {width: number; height: number}, chip: string): Promise<void> {
  await page.setViewportSize(size);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByText('Select driver').click();
  await page.locator('.dl-filters-toggle').click();
  await page.locator('.size-row .zchip', {hasText: new RegExp(`^${chip}$`)}).click();
}

for (const size of PHONES) {
  test(`phone ${size.width}x${size.height}: filters open with a size chosen, the footer buttons stay in view and the list keeps a row`, async ({page}) => {
    await openPhoneLibraryWithSize(page, size, '5');
    await expect(page.locator('.dlist .ditem:not(.my-ditem)')).toHaveCount(3);
    await expectFooterWholeAndListShowsARow(page, '.overlay.on .wb-modal');
  });

  test(`phone ${size.width}x${size.height}: a size nothing matches shows the empty list with Clear filters in view`, async ({page}) => {
    await openPhoneLibraryWithSize(page, size, '21');
    await expect(page.locator('.dlist')).toContainText('No drivers match');
    await expect(page.locator('.dlist .filters-clear')).toBeInViewport({ratio: 1});
    const footer = await page.locator('.driver-library .browser-footer button', {hasText: 'Load File…'}).boundingBox();
    expect(footer).not.toBeNull();
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(size.height);
  });
}
