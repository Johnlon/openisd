import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';

// ui-todo.md "Favorites" — a star toggle on every row, and a Favorites button in the slot
// the All Sources dropdown vacated, behaving as an on/off filter over the same list exactly
// as the type chips do.
//
// WinISD picker only (DriverBrowser.vue), per the agreed scope.

async function openPicker(page: Page): Promise<void> {
  await page.goto('/');
  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
}

const POOL_ROWS = '.dlist .ditem:not(.my-ditem)';

test('every driver row carries a star toggle', async ({ page }) => {
  await openPicker(page);
  const rows = page.locator(POOL_ROWS);
  const n = await rows.count();
  expect(n, 'no driver rows rendered — the pool is empty, so this spec proves nothing').toBeGreaterThan(2);
  for (let i = 0; i < Math.min(n, 5); i++) {
    await expect(rows.nth(i).locator('.fav-btn'), `row ${i} has no star toggle`).toHaveCount(1);
  }
});

test('starring a driver marks it, and the mark survives closing and reopening the picker', async ({ page }) => {
  await openPicker(page);
  const row = page.locator(POOL_ROWS).first();
  const name = (await row.locator('b').textContent())?.trim();
  expect(name, 'the first row has no name to identify it by').toBeTruthy();

  const star = row.locator('.fav-btn');
  await expect(star, 'the star started out already on').not.toHaveClass(/on/);
  await star.click();
  await expect(star, 'clicking the star did not mark the driver').toHaveClass(/on/);

  // Reopen from scratch — a favourite that lives only in memory is not a favourite.
  await page.reload();
  await page.locator('[title*="librar" i]').first().click();
  const sameRow = page.locator(POOL_ROWS).filter({ hasText: name! }).first();
  await expect(sameRow.locator('.fav-btn'), 'the star did not survive a reload')
    .toHaveClass(/on/);
});

// The star has to answer the click under the pointer that made it. Hover painted an unstarred
// star (#e8a317) all but the same amber as a starred one (#f0a500), so the toggle looked dead
// until the mouse moved away (John, 2026-09-24). Colour alone cannot carry this: the state is
// the GLYPH — hollow ☆ off, filled ★ on — which reads under any hover tint.
test('starring changes the star under the pointer, with no mouse-out', async ({ page }) => {
  await openPicker(page);
  const star = page.locator(POOL_ROWS).first().locator('.fav-btn');

  await star.hover();
  await expect(star, 'an unstarred star is not the hollow glyph').toHaveText('☆');

  await star.click();   // the pointer stays on the star
  await expect(star, 'the click did not star the driver at all').toHaveClass(/on/);
  await expect(star, 'the starred star still reads as hollow under the pointer').toHaveText('★');

  await star.click();
  await expect(star, 'un-starring under the pointer left it filled').toHaveText('☆');
});

test('the star is readable at a glance — 16px in the list, 32px in the summary', async ({ page }) => {
  await openPicker(page);
  const rowStar = page.locator(POOL_ROWS).first().locator('.fav-btn');
  expect(await rowStar.evaluate(el => parseFloat(getComputedStyle(el).fontSize)),
    'the list star is smaller than the agreed 16px').toBeGreaterThanOrEqual(16);

  await page.locator(POOL_ROWS).first().click();
  const prevStar = page.locator('.prev-nav .fav-btn');
  await expect(prevStar, 'the summary has no star').toHaveCount(1);
  expect(await prevStar.evaluate(el => parseFloat(getComputedStyle(el).fontSize)),
    'the summary star is smaller than the agreed 32px').toBeGreaterThanOrEqual(32);
});

test('the Favorites button filters to starred drivers only, and off again', async ({ page }) => {
  await openPicker(page);
  const rows = page.locator(POOL_ROWS);
  const before = await rows.count();

  const first = rows.first();
  const firstName = (await first.locator('b').textContent())?.trim();
  await first.locator('.fav-btn').click();

  const favFilter = page.locator('.fav-filter');
  await expect(favFilter, 'no Favorites filter button rendered').toHaveCount(1);

  await favFilter.click();
  await expect(favFilter, 'the Favorites filter did not mark itself active').toHaveClass(/active/);
  await expect(rows, 'the Favorites filter did not narrow the list to the one starred driver')
    .toHaveCount(1);
  await expect(rows.first().locator('b')).toHaveText(firstName!);

  await favFilter.click();
  await expect(favFilter, 'the Favorites filter stayed active after a second press')
    .not.toHaveClass(/active/);
  await expect(rows, 'pressing Favorites again did not restore the whole list')
    .toHaveCount(before);
});

test('un-starring a driver removes it from the favourites-only list', async ({ page }) => {
  await openPicker(page);
  const rows = page.locator(POOL_ROWS);
  await rows.first().locator('.fav-btn').click();
  await rows.nth(1).locator('.fav-btn').click();

  await page.locator('.fav-filter').click();
  await expect(rows, 'two starred drivers should both be listed').toHaveCount(2);

  await rows.first().locator('.fav-btn').click();
  await expect(rows, 'un-starring did not drop the driver out of the filtered list')
    .toHaveCount(1);
});
