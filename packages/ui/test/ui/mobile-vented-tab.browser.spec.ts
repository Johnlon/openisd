/**
 * The mobile Vented tab (the tab bar's label for a vented box; the panel itself is headed "Vents").
 * The FIELD WIRING itself (the vent-group Helmholtz relation) is proven once, in
 * `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s `createVentReadouts` suite and the
 * domain's own tests — the same factories this tab calls. These specs prove the UI is correctly
 * WIRED to that shared logic, not that the logic itself is correct.
 *
 * The sample fixture (`SAMPLE_PROJECT_OWPR`) opens as a VENTED box, which is what puts this tab in
 * the bar to begin with.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Vented' }).click();
});

test.describe('MobileVentedTab', () => {
  test('shows the vent config and readouts', async ({ page }) => {
    // The tab bar's label is the box type's own name ("Vented" — enclosureNavLabel falls back to
    // boxLabel for anything that isn't sealed/PR); the panel's own section header says "Vents".
    await expect(page.locator('.mob-panel-head').first()).toHaveText('Vents');
    await expect(page.getByText('Number of Vents')).toBeVisible();
    await expect(page.getByText('Shape')).toBeVisible();
    await expect(mobileFieldRow(page, 'Vent diameter')).toBeVisible();
    await expect(mobileFieldRow(page, '1st port resonance')).toBeVisible();
  });

  test('editing the vent diameter writes through to the field', async ({ page }) => {
    const diameterInput = mobileFieldRow(page, 'Vent diameter').locator('input');
    await diameterInput.fill('6');
    await diameterInput.blur();
    await expect(diameterInput).toHaveValue(/6/);
  });

  // Bug (John, live on his phone, 2026-10-01): clearing an entered Target Tuning Freq left both
  // it and Vent length stuck as read-only blanks — the template only ever rendered an input for
  // the 'E' state, so once a clear drove both to 'N' there was no way back in without reloading
  // the project. Mirrors the desktop repro in original-tuning-target.browser.spec.ts.
  //
  // John's own follow-up ("clear ... should probably default to ... an alignment") is the actual
  // fix where the driver resolves: `clearVentField` now calls `Box.resetVentedAlignment()`, so
  // the pair comes back alive with a real QB3 design rather than merely blank-but-typeable.
  test('clearing Target Tuning Freq re-derives a QB3 design, not a dead blank', async ({ page }) => {
    const fbInput = mobileFieldRow(page, 'Target Tuning Freq').locator('input');
    await fbInput.fill('40');
    await fbInput.blur();
    await expect(fbInput).toHaveValue(/40/);

    await fbInput.fill('');
    await fbInput.blur();
    // Still a live input, not a dead readonly span (the regression made this locator find
    // nothing) — AND non-empty: the default alignment re-derived a real tuning, not a dead blank.
    const fbAfterClear = mobileFieldRow(page, 'Target Tuning Freq').locator('input');
    await expect(fbAfterClear).toBeVisible();
    const fb = Number(await fbAfterClear.inputValue());
    expect(fb).toBeGreaterThan(0);
    expect(fb, 'a different design, not the stale 40 surviving the clear').not.toBeCloseTo(40, 1);

    // Vent length is the pair's now-calculated side — a real length, not the '—' impossible mark.
    await expect(mobileFieldRow(page, 'Vent length').locator('.mob-readonly')).not.toHaveText('—');
  });

  // John, 2026-10-01: the port velocity limit sits on the vent section in both layouts.
  test('the port velocity limit shows 17 m/s and takes an edit', async ({ page }) => {
    const input = page.locator('#mob-vent-velocity-limit');
    await expect(input).toHaveValue(/^17(\.0+)?$/);
    await input.fill('25');
    await input.blur();
    await expect(input).toHaveValue(/^25(\.0+)?$/);
  });
});
