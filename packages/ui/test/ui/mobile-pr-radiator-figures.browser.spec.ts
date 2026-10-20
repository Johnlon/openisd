/**
 * The phone's Passive Radiator tab shows the radiator's own Mms and Cms as editable rows, and a
 * cleared target tuning (Fp) is calculated, never blank, with no message naming internal keys
 * (bugs/BUG_20261017_pr-fp-cleared-turns-red-and-names-hidden-mms.md).
 *
 * Set SHOT_DIR and SHOT_NAME to save a screenshot of the tab.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {fillAndCommit} from '../fixtures/numField.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

test.use({viewport: PIXEL_9});

const shotDir = process.env['SHOT_DIR'];
const shotName = process.env['SHOT_NAME'] ?? 'shot';

async function saveShot(page: Page): Promise<void> {
  if (shotDir !== undefined) await page.screenshot({path: `${shotDir}/phone-pr-${shotName}.png`});
}

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await expect(page.getByText(/Project imported/)).toBeHidden();
  await page.locator('#mob-box-type').selectOption('box-passive-radiator');
});

test('the radiator Mms and Cms are rows the user can see and enter', async ({page}) => {
  await mobileFieldRow(page, 'Fpr (with added mass)').scrollIntoViewIfNeeded();
  await saveShot(page);
  const mms = mobileFieldRow(page, 'Mms').locator('input').first();
  await expect(mms).toBeVisible();
  await fillAndCommit(mms, '45');
  await expect(mms).toHaveValue(/^45/);
  await expect(mobileFieldRow(page, 'Cms').locator('input').first()).toBeVisible();
});

test('a cleared Fp is calculated, never blank, and no message shows a field key', async ({page}) => {
  const fp = mobileFieldRow(page, 'Target tuning freq (Fp)').locator('input').first();
  await fillAndCommit(fp, '25');
  await fillAndCommit(fp, '');
  await expect(fp).toHaveValue(/\d/);
  await expect(page.locator('body')).not.toContainText(/_(kg|hz|m_per_N)\b/);
});
