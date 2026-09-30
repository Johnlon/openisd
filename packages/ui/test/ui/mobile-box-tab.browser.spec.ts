/**
 * The mobile Box tab. The FIELD WIRING itself (what a box-type change or a volume edit means)
 * is proven once, in `packages/ui/test/hooks/boxFields.test.ts`'s `createSelectedBox`/
 * `createBoxVolume` suites — the same functions this tab calls. These specs prove the UI is
 * correctly WIRED to that shared logic, not that the logic itself is correct.
 *
 * The sample fixture (`SAMPLE_PROJECT_OWPR`) opens as a VENTED box with no T/S params entered —
 * its own default, unrelated to this tab. Tests that care which box type is active select it
 * explicitly rather than assuming sealed.
 */
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, test} from '../fixtures.js';

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
  // Bug (John, 2026-09-29): there is no tab literally named "Enclosure" — the hint must name the
  // tab bar's own dynamic label ("Vented" here) instead of a hardcoded string.
  await expect(page.locator('.mob-hint', { hasText: '"Vented" tab' })).toBeVisible();
});

test('the Choose alignment sheet picks an alignment and writes its volume on Accept', async ({ page }) => {
  await page.locator('#mob-box-type').selectOption('sealed');
  await expect(page.locator('.mob-btn', { hasText: 'Choose alignment' })).toBeVisible();

  await page.locator('.mob-btn', { hasText: 'Choose alignment' }).click();
  await expect(page.locator('.mob-align-sheet')).toBeVisible();

  const volumeInput = page.locator('.mob-align-sheet .mob-field-value input');
  await volumeInput.fill('20');
  await expect(page.locator('.mob-align-readout')).toContainText('EBP');

  await page.locator('.mob-align-footer .mob-btn-primary', { hasText: 'Accept' }).click();
  await expect(page.locator('.mob-align-sheet')).toHaveCount(0);

  const volumeField = page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first();
  await expect(volumeField).toHaveValue(/20/);
});

test('the vented Choose alignment sheet picks an alignment and writes volume + tuning on Accept', async ({ page }) => {
  // The default sample project has no T/S params, so ventedDesign() has nothing to compute from
  // (recalculate() would silently no-op) — needs COMPLETE_DRIVER_PROJECT_OWPR's real Fs/Qes/Vas,
  // same as the box-type-switch-defaults spec below.
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('#mob-box-type').selectOption('vented');
  await expect(page.locator('.mob-btn', { hasText: 'Choose alignment' })).toBeVisible();

  await page.locator('.mob-btn', { hasText: 'Choose alignment' }).click();
  await expect(page.locator('.mob-align-sheet')).toBeVisible();

  // Vented has no volume/tuning reverse lookup (VentedEngine has no closestAlignment), so the
  // sheet's Volume + Tuning freq are read-only readouts driven by the alignment <select>, unlike
  // sealed's directly-editable field.
  await page.locator('.mob-align-sheet .mob-select').selectOption('bb4');
  await expect(page.locator('.mob-align-sheet .mob-field-label', { hasText: 'Tuning freq' })).toBeVisible();
  await expect(page.locator('.mob-align-readout')).toContainText('EBP');

  await page.locator('.mob-align-footer .mob-btn-primary', { hasText: 'Accept' }).click();
  await expect(page.locator('.mob-align-sheet')).toHaveCount(0);

  const volumeField = page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first();
  await expect(volumeField).not.toHaveValue('0.00');
  await expect(volumeField).not.toHaveValue('');
});

test('Cancel discards the alignment sheet\'s draft without touching the volume field', async ({ page }) => {
  await page.locator('#mob-box-type').selectOption('sealed');
  const volumeField = page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first();
  await volumeField.fill('15');
  await volumeField.blur();

  await page.locator('.mob-btn', { hasText: 'Choose alignment' }).click();
  const sheetVolume = page.locator('.mob-align-sheet .mob-field-value input');
  await sheetVolume.fill('99');
  await page.locator('.mob-align-footer .mob-btn', { hasText: 'Cancel' }).click();

  await expect(page.locator('.mob-align-sheet')).toHaveCount(0);
  await expect(volumeField).toHaveValue(/15/);
});

// Bug (John, live on his phone, 2026-09-29): switching from sealed to vented left volume=0,
// cascading into every chart sweep failing (no finite group delay / max SPL, no vent length
// solution). Fixed in the domain: `OpenISDBox.applyStartingValues`, run by `boxType.set()`.
// This spec proves the seam from the box-type select to that method.
//
// COMPLETE_DRIVER_PROJECT_OWPR (not the beforeEach's default sample project, which has no T/S
// params — the guard this fix needs would never fire) opens on vented with its own volume
// already set, so switching to SEALED is what exercises the never-used-type path.
test('switching to a never-used box type defaults its volume instead of showing 0', async ({ page }) => {
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);

  await page.locator('#mob-box-type').selectOption('sealed');
  const volumeInput = page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first();
  await expect(volumeInput).not.toHaveValue('0.00');
  await expect(volumeInput).not.toHaveValue('');
});

test('the Box losses sheet edits Ql/Qa, and Qp only for a vented box', async ({ page }) => {
  await expect(page.locator('.mob-field-label', { hasText: 'Port Qp' })).toHaveCount(0);
  await page.locator('.mob-btn', { hasText: 'Box losses' }).click();
  await expect(page.locator('.mob-field-label', { hasText: 'Leakage Ql' })).toBeVisible();
  await expect(page.locator('.mob-field-label', { hasText: 'Absorption Qa' })).toBeVisible();
  await expect(page.locator('.mob-field-label', { hasText: 'Port Qp' })).toBeVisible();

  const qlInput = page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: 'Leakage Ql' }) }).locator('input');
  await qlInput.fill('12');
  await qlInput.blur();
  await expect(qlInput).toHaveValue(/12/);

  await page.locator('.mob-align-footer .mob-btn', { hasText: 'OK' }).click();
  await expect(page.locator('.mob-align-sheet')).toHaveCount(0);

  await page.locator('#mob-box-type').selectOption('sealed');
  await page.locator('.mob-btn', { hasText: 'Box losses' }).click();
  await expect(page.locator('.mob-field-label', { hasText: 'Port Qp' })).toHaveCount(0);
});
