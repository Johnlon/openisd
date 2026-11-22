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
  const chart = (await panel.locator('.gtitle').innerText()).replace(/Data[\s\S]*$/, '').trim();
  const dataButton = panel.getByRole('button', { name: 'Data' });
  await expect(autoY).toBeChecked();
  await expect(panel).not.toHaveAttribute('data-y-range', ''); // the first sweep has landed
  const before = await panel.getAttribute('data-y-range');

  await dataButton.click();
  const dialog = page.getByRole('dialog', { name: `${chart} data` });
  await expect(dialog).toBeVisible();
  const dataBefore = await dialog.locator('tbody').innerText();
  await dialog.getByRole('button', { name: 'Close' }).click();

  await autoY.uncheck();
  await volume.fill('0.5');
  await volume.press('Enter');

  await dataButton.click();
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.locator('tbody').innerText()).not.toBe(dataBefore);
  await dialog.getByRole('button', { name: 'Close' }).click();
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
