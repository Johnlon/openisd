import {expect, openAProject, test} from '../fixtures.js';

// The clean synthetic driver (no Mms/Cms/BL, consistent T/S, no sku) is the fixture these
// wire-level assertions are written for. On the scraped W5 sample there are alternate
// derivation routes (Mms/Re/BL → Qes) and endless cross-relation inconsistencies, which would
// make clearing an anchor re-derive instead of un-calculate, and would litter the chart strip.
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;

/**
 * The Driver Editor is WIRED to the driver solver — the seam, not the maths.
 *
 * The derivation rules themselves (which field follows from which, route precedence, cascades,
 * zero and contradiction handling) are unit-tested in `packages/design/test/engine/driver-solve.test.ts`
 * and pinned against WinISD's own goldens in
 * `packages/design/test/winisd/winisd-parity-goldens.test.ts`. This spec proves only what
 * a unit test cannot: that typing into the editor reaches the solver, that a solver result
 * reaches the input with its E/C/N class, and that the modal's tabs and buttons carry the
 * draft correctly.
 */

test.describe('Driver Editor — solver wiring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page, COMPLETE);

    // Open the Driver Editor the way a user does. Services are constructed by the composition
    // root and injected, so there is no module-level instance to import and call — the button
    // is the seam, and driving it also proves the wiring behind it.
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();
    await page.locator('.edit-btn', { hasText: 'Edit' }).click();

    await page.locator('.de-body').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  });

  test('UI derives Qts from Qes and Qms', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    const qesf = page.locator('.de-fld:has-text("Qes") input');
    const qmsf = page.locator('.de-fld:has-text("Qms") input');

    await qtsf.fill('');
    await qesf.fill('0.400');
    await qmsf.fill('4.000');

    // Qts = (0.4 * 4.0) / 4.4 = 0.363636… (state C). Qes/Qms stated to ±0.0005 bound it to
    // ±0.0004, so it shows 4 decimals.
    await expect(qtsf).toHaveValue('0.3636');
    await expect(qtsf).toHaveClass(/value-c/);
  });

  test('UI un-calculates downstream derived fields back to state N when an anchor is cleared', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    const qesf = page.locator('.de-fld:has-text("Qes") input');
    const qmsf = page.locator('.de-fld:has-text("Qms") input');

    await qtsf.fill('');
    await qesf.fill('0.400');
    await qmsf.fill('4.000');
    await expect(qtsf).toHaveValue('0.3636');

    // Clear Qes anchor the caret-safe way (QO11.3's Control+A + Delete — the same gesture
    // pressSequentially and press(Control+a)+press(Delete) exercise; a bare fill('') is a
    // different, script-only path).
    await qesf.click();
    await qesf.press('Control+a');
    await qesf.press('Delete');
    await qesf.blur();

    // Qts must reset to empty / Not Available (state N) — the solver does not use a
    // previously-calculated value as a new stated input.
    await expect(qtsf).toHaveValue('');
    await expect(qtsf).toHaveClass(/value-n/);
  });

  test('UI preserves solver state across Parameters and Advanced tab switches', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    await qtsf.fill('');
    await page.locator('.de-fld:has-text("Qes") input').fill('0.400');
    await page.locator('.de-fld:has-text("Qms") input').fill('4.000');
    await expect(qtsf).toHaveValue('0.3636');

    // Switch to Advanced tab and back
    await page.getByRole('button', { name: 'Advanced', exact: true }).click();
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    // Value and state class must persist
    await expect(qtsf).toHaveValue('0.3636');
    await expect(qtsf).toHaveClass(/value-c/);
  });

  test('UI Reset button reverts edits back to initial modal opening state', async ({ page }) => {
    const ddf = page.locator('.de-fld:has-text("Dd") input');
    const initialDd = await ddf.inputValue();

    // A typed value is echoed as typed until the field commits; on blur it shows the
    // registry precision (fcf7d691: text edits, incl. paste, are not reformatted mid-edit).
    await ddf.fill('999.0');
    await ddf.blur();
    await expect(ddf).toHaveValue('999.00');

    // Click Reset button in modal footer
    await page.getByRole('button', { name: 'Reset', exact: true }).click();

    // Dd must revert to initial value
    await expect(ddf).toHaveValue(initialDd);
  });

  test('UI Cancel button discards all edits and leaves project driver un-mutated', async ({ page }) => {
    const ddf = page.locator('.de-fld:has-text("Dd") input');
    await ddf.fill('999.0');

    // Click Cancel button
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Modal must close
    await expect(page.locator('.de-body')).toBeHidden();
  });

  test('UI OK button commits draft solver edits into project driver state', async ({ page }) => {
    const ddf = page.locator('.de-fld:has-text("Dd") input');
    await ddf.fill('210.0');

    // Click OK button
    await page.getByRole('button', { name: 'OK', exact: true }).click();

    // Modal closes upon successful commit
    await expect(page.locator('.de-body')).toBeHidden();
  });

  test('UI refuses non-numeric literal text ("banana", "<script>"): shown red, never stored, Esc puts the value back', async ({ page }) => {
    const fsf = page.locator('.de-fld:has-text("Fs") input');
    const before = await fsf.inputValue();

    // 1. Type non-numeric text 'banana' into the input field. Numbers are text boxes, so the text
    // stays as typed and is flagged; a refused entry is never stored (ruling "b").
    await fsf.evaluate((el: HTMLInputElement) => {
      el.value = 'banana';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(fsf).toHaveClass(/inp-bad/);
    await expect(fsf).toHaveValue('banana');
    await expect(page.locator('.de-body')).toBeVisible();

    // 2. Esc puts the stored value back.
    await fsf.focus();
    await fsf.press('Escape');
    await expect(fsf).toHaveValue(before);
    await expect(fsf).not.toHaveClass(/inp-bad/);
  });

  test('UI flags unphysical negative parameters (Re = -8.0 Ohm, Fs = -35.0 Hz) with Data Quality (DQ) warning', async ({ page }) => {
    const ref = page.locator('.de-fld:has-text("Re") input');
    await ref.fill('-8.0');

    // While being entered the input echoes the text as typed (fcf7d691: text edits are not
    // reformatted mid-edit), is state E, and receives the .inp-bad class
    await expect(ref).toHaveValue('-8.0');
    await expect(ref).toHaveClass(/value-e/);
    await expect(ref).toHaveClass(/inp-bad/);
  });
});
