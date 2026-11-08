/**
 * Phone skin, 374x705: every visible field label is on ONE line (at most 1.6 line-heights tall).
 * BUG_20261108_phone-field-labels-wrap (OPEN, needs John's ruling): each test is an expected fault (test.fail);
 * when the bug is fixed they turn red and the test.fail lines are deleted. Walks the Vented tab, Advanced, Options and the What-if sheet.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

test.use({viewport: {width: 374, height: 705}});

/** Text of every visible label taller than 1.6 line-heights. */
async function wrappedLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const wrapped: string[] = [];
    for (const label of document.querySelectorAll('.ui-field-label, .mob-field-label')) {
      const box = label.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const style = getComputedStyle(label);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      if (box.height > lineHeight * 1.6) wrapped.push(`${label.textContent?.trim()} (${Math.round(box.height)}px, line ${Math.round(lineHeight)}px)`);
    }
    return wrapped;
  });
}

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test('Box tab (vents) labels are one line', async ({page}) => {
  test.fail();
  await page.locator('.mob-tab').filter({hasText: /^Box$/}).click();
  await expect(page.getByText('Number of Vents')).toBeVisible();
  expect(await wrappedLabels(page)).toEqual([]);
});

test('Advanced labels are one line', async ({page}) => {
  test.fail();
  await tapMobileMenuItem(page, 'Advanced');
  await expect(page.getByText('Relative humidity')).toBeVisible();
  expect(await wrappedLabels(page)).toEqual([]);
});

test('Options labels are one line', async ({page}) => {
  test.fail();
  await tapMobileMenuItem(page, 'Options');
  await expect(page.getByText('Min box volume').first()).toBeVisible();
  expect(await wrappedLabels(page)).toEqual([]);
});

test('What-if sheet labels are one line', async ({page}) => {
  test.fail();
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.getByRole('button', {name: 'Open What-if'}).click();
  await expect(page.locator('.mob-sheet')).toBeVisible();
  expect(await wrappedLabels(page)).toEqual([]);
});
