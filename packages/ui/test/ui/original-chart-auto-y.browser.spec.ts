/**
 * The Original shell's per-chart Auto Y switch: unticked, the chart's Y axis stays where it was
 * and a box edit never rescales it; ticked again, the axis fits the curves.
 */
import {expect, openAProject, test} from '../fixtures.js';

test('Auto Y off holds the Y axis through a box volume edit; on rescales it', async ({ appPage: page }) => {
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
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(400);
  await expect(panel).toHaveAttribute('data-y-range', before!);

  await autoY.check();
  await expect(panel).not.toHaveAttribute('data-y-range', before!);
});

test('Auto Y sits in the title row and does not overlap the first frequency label', async ({ appPage: page }) => {
  await page.goto('/');
  await openAProject(page);
  const panel = page.locator('.graph-wrap .gpanel').first();
  const title = panel.locator('.gtitle');
  const autoY = title.locator('.gautoy');
  await expect(autoY).toBeVisible();
  const titleBox = await title.boundingBox();
  const autoYBox = await autoY.boundingBox();
  expect(titleBox).not.toBeNull();
  expect(autoYBox).not.toBeNull();
  expect(autoYBox!.y).toBeGreaterThanOrEqual(titleBox!.y - 2);
  expect(autoYBox!.y + autoYBox!.height).toBeLessThanOrEqual(titleBox!.y + titleBox!.height + 4);
});
