/**
 * The mobile Box tab. The FIELD WIRING itself (what a box-type change or a volume edit means)
 * is proven once, in `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s `createSelectedBox`/
 * `createBoxVolume` suites — the same functions this tab calls. These specs prove the UI is
 * correctly WIRED to that shared logic, not that the logic itself is correct.
 *
 * The sample fixture (`SAMPLE_PROJECT_OWPR`) opens as a VENTED box with no T/S params entered —
 * its own default, unrelated to this tab. Tests that care which box type is active select it
 * explicitly rather than assuming sealed.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
});

test('the Box tab shows the box-type select, the enclosure diagram, and a volume field', async ({ page }) => {
  await expect(page.locator('#mob-box-type')).toBeVisible();
  await expect(page.locator('.mob-diagram')).toBeVisible();
  await expect(page.locator('.mob-field-label', { hasText: 'Volume' })).toBeVisible();
});

test('editing the volume writes the value through to the field', async ({ page }) => {
  const volumeInput = page.locator('.mob-field-entered .mob-field-value input').first();
  await volumeInput.fill('40');
  await volumeInput.blur();
  await expect(volumeInput).toHaveValue(/40/);
});

test('the Qtc row shows only for a sealed box', async ({ page }) => {
  await page.locator('#mob-box-type').selectOption('sealed');
  await expect(page.locator('.mob-field-label', { hasText: 'Qtc' })).toBeVisible();
  await expect(page.locator('.mob-field-label', { hasText: 'Fsc' })).toBeVisible();

  await page.locator('#mob-box-type').selectOption('vented');
  await expect(page.locator('.mob-field-label', { hasText: 'Qtc' })).toHaveCount(0);
  await expect(page.locator('.mob-hint', { hasText: 'Vents and enclosure' })).toBeVisible();
});
