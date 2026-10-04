/**
 * The mobile Passive Radiator tab. The FIELD WIRING itself (PR readouts) is proven once, in
 * `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s `createPassiveRadiatorActions` suite and the
 * domain's own tests. These specs prove the UI is correctly WIRED to that shared logic.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobilePrTab', () => {
  test('a passive-radiator box shows PR fields and Select PR opens the browser', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();
    await expect(page.locator('.mob-panel-head').first()).toHaveText('Passive radiator');
    await expect(mobileFieldRow(page, 'Vas')).toBeVisible();
    await expect(mobileFieldRow(page, 'Fpr (with added mass)')).toBeVisible();

    await page.getByText('Select passive radiator', { exact: true }).click();
    await expect(page.getByText('Passive radiator library')).toBeVisible();
    await page.locator('.modal .x').click();
    await expect(page.getByText('Passive radiator library')).toHaveCount(0);
  });
});
