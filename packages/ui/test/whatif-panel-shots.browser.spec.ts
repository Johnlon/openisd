/**
 * Layout-review screenshots for the two non-modal What-If panels. Saved to docs/winisd/ per
 * the "save every screenshot" rule — a shot that is only looked at is one that has to be
 * retaken.
 *
 * The "before_width" pair is captured by re-injecting the PREVIOUS `width: 100%` rule over the
 * live panel, so the width change is compared like-for-like in one run. It restores the old
 * WIDTH only, not the whole pre-change panel: the working tree is shared with other live
 * sessions and branches/worktrees are not permitted here, so checking the old source back out
 * to photograph it is not available.
 */
import { test } from './fixtures.js';
import type { Page } from '@playwright/test';

const SHOTS = 'docs/winisd';

async function original(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.original-root').waitFor({ state: 'visible' });
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Tune' }).click();
  const tune = page.locator('.tune-panel');
  await tune.waitFor({ state: 'visible' });
  return tune;
}

test('shots: Original Tune what-if panel', async ({ page }) => {
  const tune = await original(page);

  await tune.screenshot({ path: `${SHOTS}/view_1_driver_tune_whatif_after.png` });

  // The Q trio short of two usable members — every one of the three flagged together.
  const fld = (label: string) =>
    page.locator('.tune-panel .tune-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
  for (const q of ['Qms', 'Qes']) {
    const i = fld(q);
    await i.click();
    await i.press('Control+a');
    await i.press('Delete');
    await i.blur();
  }
  await tune.screenshot({ path: `${SHOTS}/view_1_driver_tune_whatif_qtrio_alert.png` });
});

test('shots: Original Tune what-if panel — previous field width', async ({ page }) => {
  const tune = await original(page);
  await page.addStyleTag({ content: '.tune-unit input, .tune-roval { width: 100% !important }' });
  await tune.screenshot({ path: `${SHOTS}/view_1_driver_tune_whatif_before_width.png` });
});

test('shots: Classic inline what-if panel', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('classic');
  await page.locator('.cl-whatif').click();
  const dep = page.locator('.dep');
  await dep.waitFor({ state: 'visible' });
  await dep.screenshot({ path: `${SHOTS}/view_1_driver_classic_whatif_after.png` });

  await page.addStyleTag({ content: '.dep .row input { width: 96px !important; flex: 0 0 96px !important }' });
  await dep.screenshot({ path: `${SHOTS}/view_1_driver_classic_whatif_before_width.png` });
});
