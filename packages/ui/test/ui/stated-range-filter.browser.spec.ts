import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

// The stated range filter (QO416, John 5 Nov 2026): From and To boxes beside Fs. A driver matches when the range
// its maker states covers what is typed. A checkbox says whether drivers that state no range stay in the list.

const FROM = 'input.pnum[title*="reach down" i]';
const TO = 'input.pnum[title*="reach up" i]';
const KEEP = '.range-keep input[type=checkbox]';
const ROWS = '.dlist .ditem';

async function openLibrary(page: Page): Promise<void> {
  await page.goto('/');
  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
}

async function listed(page: Page): Promise<number> {
  return page.locator(ROWS).count();
}

test('the boxes narrow the list; unticking the checkbox narrows it further; clearing restores it', async ({ page }) => {
  await openLibrary(page);
  await expect(page.locator(KEEP)).toBeChecked();
  const before = await page.locator('.status').innerText();

  await page.locator(FROM).fill('40');
  await page.locator(TO).fill('2000');
  await expect(page.locator('.filters-on-pill', { hasText: 'Range 40–2000 Hz' })).toBeVisible();
  await expect(page.locator('.status')).not.toHaveText(before);
  const withUnstated = await listed(page);

  await page.locator(KEEP).uncheck();
  await expect(page.locator('.filters-on-pill', { hasText: 'Range 40–2000 Hz, stated only' })).toBeVisible();
  await expect.poll(() => listed(page)).toBeLessThan(withUnstated);
  expect(await listed(page)).toBeGreaterThan(0);

  await page.locator('.filters-clear').click();
  await expect(page.locator(KEEP)).toBeChecked();
  await expect(page.locator('.status')).toHaveText(before);
});

test('a real driver stating 30 to 4000 Hz is in when its range covers the boxes and out when it stops short', async ({ page }) => {
  await openLibrary(page);
  await page.locator('input.filter').fill('Dayton Audio E150HE-44');
  await expect(page.locator(ROWS)).toHaveCount(1);
  await page.locator(FROM).fill('30');
  await page.locator(TO).fill('4000');
  await expect(page.locator(ROWS)).toHaveCount(1);
  await page.locator(FROM).fill('29');
  await expect(page.locator(ROWS)).toHaveCount(0);
});

for (const [name, size] of [['desktop', { width: 1280, height: 800 }], ['small window', { width: 800, height: 600 }]] as const) {
  test(`the filter row is not clipped and adds no sideways scrolling: ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openLibrary(page);
    for (const sel of [FROM, TO, KEEP]) {
      await expect(page.locator(sel)).toBeVisible();
      const box = await page.locator(sel).boundingBox();
      expect(box === null ? -1 : box.x + box.width).toBeLessThanOrEqual(size.width);
    }
    const overflow = await page.locator('.driver-library').evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('phone: the boxes and the checkbox fold under Filters and stay inside the screen', async ({ page }) => {
  const width = 374;
  await page.setViewportSize({ width, height: 705 });
  await forceMobileSkin(page);
  await page.goto('/');
  await page.getByText('New project').click();
  const body = page.locator('.mob-np-body');
  await expect(body.locator(FROM)).toHaveCount(0);
  await body.locator('.dl-filters-toggle').click();
  await body.locator(FROM).fill('40');
  await body.locator(TO).fill('2000');
  await body.locator(KEEP).uncheck();
  await expect(body.locator('.dl-filters-toggle')).toContainText('1');
  const box = await body.locator(KEEP).boundingBox();
  expect(box === null ? -1 : box.x + box.width).toBeLessThanOrEqual(width);
  const overflow = await body.evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
