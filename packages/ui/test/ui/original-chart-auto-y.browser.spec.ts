/**
 * The Original shell's per-chart Auto Y switch: unticked, the chart's Y axis stays where it was
 * and a box edit never rescales it; ticked again, the axis fits the curves.
 */
import {expect, openAProject, test} from '../fixtures.js';

test('Auto Y off holds the Y axis through a box volume edit; on rescales it', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  const panel = page.locator('.graph-wrap .gpanel').first();
  const autoY = panel.getByRole('checkbox', { name: 'Auto Y' });
  const volume = page.locator('.box-layout .field', { hasText: 'Volume' }).locator('input').first();
  await expect(autoY).toBeChecked();
  await expect(panel).not.toHaveAttribute('data-y-range', ''); // the first sweep has landed
  const before = await panel.getAttribute('data-y-range');

  await autoY.uncheck();
  await volume.fill('0.5');
  await volume.press('Enter');
  await page.waitForTimeout(400);
  await expect(panel).toHaveAttribute('data-y-range', before!);

  await autoY.check();
  await expect(panel).not.toHaveAttribute('data-y-range', before!);
});
