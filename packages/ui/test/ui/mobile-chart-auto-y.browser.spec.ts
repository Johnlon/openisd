/**
 * The mobile Graph page has no Auto Y switch while Tune is closed. John, 2026-10-05: "the Auto Y
 * of charts is pointless on mobile because there is no Tune feature (yet!)". It shows while the
 * Tune sheet is open (mobile-tune-sheet.browser.spec.ts); the desktop switch is covered by
 * original-chart-auto-y.browser.spec.ts.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test('the mobile Graph page draws charts without an Auto Y switch while Tune is closed', async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  const panel = page.locator('.mob-chart-cell .gpanel').first();
  await expect(panel).not.toHaveAttribute('data-y-range', ''); // the first sweep has landed
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(0);
});
