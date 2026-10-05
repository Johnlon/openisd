/**
 * The mobile Graph page's per-chart Auto Y switch: unticked, the chart's Y axis stays where it
 * was and a box edit never rescales it; ticked again, the axis fits the curves.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test('Auto Y off holds the Y axis through a box volume edit; on rescales it', async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  const graphTab = page.locator('.mob-tab', { hasText: 'Graph' });
  const panel = page.locator('.mob-chart-cell .gpanel').first();
  const autoY = panel.getByRole('checkbox', { name: 'Auto Y' });
  await graphTab.click();
  await expect(autoY).toBeChecked();
  await expect(panel).not.toHaveAttribute('data-y-range', ''); // the first sweep has landed
  const before = await panel.getAttribute('data-y-range');

  await autoY.uncheck();
  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  const volume = page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: 'Volume' }) }).locator('input').first();
  await volume.fill('0.5');
  await volume.press('Enter');
  await graphTab.click();
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(400);
  await expect(panel).toHaveAttribute('data-y-range', before!);

  await autoY.check();
  await expect(panel).not.toHaveAttribute('data-y-range', before!);
});
