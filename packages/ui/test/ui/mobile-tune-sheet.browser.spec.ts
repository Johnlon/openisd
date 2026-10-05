/**
 * The mobile Tune sheet: the pull-tab under the charts opens it, a stepper press changes the
 * design live, Cancel puts the value back, Done keeps it. While it is open the chart's Auto Y box
 * shows (John, 2026-10-05).
 */
import {curvesSplSum, expect, focusedBoxVolume, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test('the mobile Tune sheet steps the box volume live; Cancel restores it and Done keeps it', async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  const panel = page.locator('.mob-chart-cell .gpanel').first();
  await expect(panel).not.toHaveAttribute('data-y-range', '');
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(0);

  const volume = await focusedBoxVolume(page);
  const spl = await curvesSplSum(page);

  await page.getByRole('button', { name: 'Open Tune' }).click();
  const sheet = page.locator('.mob-tune-sheet');
  await expect(sheet).toBeVisible();
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(1);

  const row = sheet.locator('.mob-tune-row', { has: page.locator('.mob-tune-label', { hasText: 'Box volume' }) });
  await row.getByTitle('Increase').click();
  await expect.poll(() => focusedBoxVolume(page)).toBeGreaterThan(volume);
  await expect.poll(() => curvesSplSum(page)).not.toBe(spl);

  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => focusedBoxVolume(page)).toBe(volume);

  await page.getByRole('button', { name: 'Open Tune' }).click();
  await row.getByTitle('Increase').click();
  await expect.poll(() => focusedBoxVolume(page)).toBeGreaterThan(volume);
  await page.locator('.mob-tune-sheet').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.mob-tune-sheet')).toHaveCount(0);
  expect(await focusedBoxVolume(page)).toBeGreaterThan(volume);
});
