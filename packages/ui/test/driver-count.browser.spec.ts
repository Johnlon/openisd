import { test, expect } from './fixtures.js';

// The count above the driver list must always mean ONE thing: how many rows are listed right
// now. It used to mean the size of the whole pool, because init() writes the pool total into
// `statusMsg` and the template renders `statusMsg || filteredFiles.length` — so the fallback
// that carries the real count was unreachable. Worse, choosing a driver clears `statusMsg`,
// after which the same number silently started tracking the filter instead. One number,
// two meanings, depending on what the user had done earlier.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: 'original' } }));
  });
  await page.goto('/');
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
});

test('the count matches the number of rows listed, and follows a filter', async ({ page }) => {
  const rows = page.locator('.dlist .ditem:not(.my-ditem)');
  const status = page.locator('.statusrow .status');

  // Narrow hard with the search box so the list is small enough to count exactly — the
  // unfiltered list is capped at DISPLAY_LIMIT rows, which is a different number again.
  await page.locator('.filter').fill('as168-9-470');
  await expect(rows).not.toHaveCount(0);

  const listed = await rows.count();
  await expect(status, 'the count does not report the number of rows actually listed')
    .toHaveText(`${listed} drivers`);
});

test('the count drops when the Favorites filter narrows the list', async ({ page }) => {
  const rows = page.locator('.dlist .ditem:not(.my-ditem)');
  const status = page.locator('.statusrow .status');

  await rows.first().locator('.fav-btn').click();
  await page.locator('.fav-filter').click();

  await expect(rows).toHaveCount(1);
  await expect(status, 'the count ignored the Favorites filter and still reports the whole pool')
    .toHaveText('1 drivers');
});
