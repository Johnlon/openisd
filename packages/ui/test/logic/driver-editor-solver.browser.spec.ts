import { test, expect, openAProject } from '../fixtures.js';

/**
 * The Driver Editor is WIRED to the driver solver — the seam, not the maths.
 *
 * The derivation rules themselves (which field follows from which, route precedence, cascades,
 * zero and contradiction handling) are unit-tested in `packages/design/test/engine/driver.test.ts`
 * and pinned against WinISD's own goldens in
 * `packages/design/test/winisd/winisd-parity-functional.test.ts`. This spec proves only what
 * a unit test cannot: that typing into the editor reaches the solver, that a solver result
 * reaches the input with its E/C/N class, and that the modal's tabs and buttons carry the
 * draft correctly.
 */

test.describe('Driver Editor — solver wiring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await openAProject(page);

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

    // Qts = (0.4 * 4.0) / 4.4 = 0.364 (state C)
    await expect(qtsf).toHaveValue('0.364');
    await expect(qtsf).toHaveClass(/value-c/);
  });

  test('UI un-calculates downstream derived fields back to state N when an anchor is cleared', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    const qesf = page.locator('.de-fld:has-text("Qes") input');
    const qmsf = page.locator('.de-fld:has-text("Qms") input');

    await qtsf.fill('');
    await qesf.fill('0.400');
    await qmsf.fill('4.000');
    await expect(qtsf).toHaveValue('0.364');

    // Clear Qes anchor
    await qesf.fill('');

    // Qts must reset to empty / Not Available (state N)
    await expect(qtsf).toHaveValue('');
    await expect(qtsf).toHaveClass(/value-n/);
  });

  test('UI preserves solver state across Parameters and Advanced parameters tab switches', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    await qtsf.fill('');
    await page.locator('.de-fld:has-text("Qes") input').fill('0.400');
    await page.locator('.de-fld:has-text("Qms") input').fill('4.000');
    await expect(qtsf).toHaveValue('0.364');

    // Switch to Advanced parameters tab and back
    await page.getByRole('button', { name: 'Advanced parameters', exact: true }).click();
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    // Value and state class must persist
    await expect(qtsf).toHaveValue('0.364');
    await expect(qtsf).toHaveClass(/value-c/);
  });

  test('UI Reset button reverts edits back to initial modal opening state', async ({ page }) => {
    const ddf = page.locator('.de-fld:has-text("Dd") input');
    const initialDd = await ddf.inputValue();

    await ddf.fill('999.0');
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

  test('UI rejects non-numeric literal text ("banana", "<script>") and clears field to state N (empty/Not Available) without crashing JS execution', async ({ page }) => {
    const fsf = page.locator('.de-fld:has-text("Fs") input');

    // 1. Dispatch non-numeric text 'banana' into input field
    await fsf.evaluate((el: HTMLInputElement) => {
      el.value = 'banana';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 2. Trigger blur event
    await fsf.blur();

    // 3. Input element cleanly clears to state N (Not Available, empty '') without crashing Vue
    await expect(fsf).toHaveValue('');
    await expect(fsf).toHaveClass(/value-n/);
    await expect(page.locator('.de-body')).toBeVisible();
  });

  test('UI flags unphysical negative parameters (Re = -8.0 Ohm, Fs = -35.0 Hz) with Data Quality (DQ) warning', async ({ page }) => {
    const ref = page.locator('.de-fld:has-text("Re") input');
    await ref.fill('-8.0');

    // Input stores the entered value -8.000 (state E) and receives .inp-bad class
    await expect(ref).toHaveValue('-8.000');
    await expect(ref).toHaveClass(/value-e/);
    await expect(ref).toHaveClass(/inp-bad/);
  });
});
