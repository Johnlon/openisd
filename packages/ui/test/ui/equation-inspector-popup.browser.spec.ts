import {driverEditorField, expect, openAProject, openDriverEditor, test} from '../fixtures.js';

/**
 * The equation inspector (EquationInspectorModal.vue): with "Inspect Provenance" on, clicking a
 * Driver Editor field opens a non-modal card naming the formula(s) that derive it and the fields
 * that feed it. The card never covers the editor it explains.
 */

interface Rect { x: number; y: number; width: number; height: number }

/** True when two bounding boxes share any area — they overlap on BOTH axes at once. */
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

test.describe('Equation inspector popup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test('Inspect Provenance checkbox is present in Driver Editor header', async ({ page }) => {
    await openDriverEditor(page);
    const chk = page.getByRole('checkbox', { name: 'Inspect Provenance' });
    await expect(chk).toBeVisible();
  });

  test('Toggling Inspect Provenance on and clicking Qts highlights feeding fields and pops up non-modal Equation Inspector', async ({ page }) => {
    await openDriverEditor(page);
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();

    // Click Qts field
    const qtsFld = page.locator('.de-fld:has-text("Qts") input').first();
    await qtsFld.click();

    // Verify Equation Inspector non-modal card pops up
    const inspector = page.locator('.eq-inspector-card');
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('Provenance: Qts');
    await expect(inspector).toContainText('Qts = (Qes × Qms) / (Qes + Qms)');
    await expect(inspector).toContainText('Participating fields:');
    await expect(inspector).toContainText('Qes');
    await expect(inspector).toContainText('Qms');
  });

  test('Inspecting a multi-formula field (Qes) displays multiple derivation paths and distinct color swatches', async ({ page }) => {
    await openDriverEditor(page);
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();

    // Click Qes field
    const qesFld = page.locator('.de-fld:has-text("Qes") input').first();
    await qesFld.click();

    const inspector = page.locator('.eq-inspector-card');
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('Provenance: Qes');

    const pathCards = inspector.locator('.eq-path-card');
    const pathCount = await pathCards.count();
    expect(pathCount).toBeGreaterThanOrEqual(2);

    await expect(pathCards.nth(0)).toContainText('Qes = (Qts × Qms) / (Qms - Qts)');
    await expect(pathCards.nth(1)).toContainText('Qes = (2π × Fs_hz × Mms_kg × Re_ohm) / BL²');
  });

  test('Closing Equation Inspector via ✕ button dismisses the non-modal overlay while keeping Driver Editor open', async ({ page }) => {
    await openDriverEditor(page);
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();

    const qtsFld = page.locator('.de-fld:has-text("Qts") input').first();
    await qtsFld.click();

    const inspector = page.locator('.eq-inspector-card');
    await expect(inspector).toBeVisible();

    await inspector.locator('.eq-x').click();
    await expect(inspector).toBeHidden();

    // Driver Editor stays open
    await expect(page.locator('.de-body')).toBeVisible();
  });

  test('the popup never overlaps the editor, even on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 900 }); // 850px modal, ~225px free per side
    await openDriverEditor(page);
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();
    await driverEditorField(page, 'Fs').locator('label').click();

    const card = page.locator('.eq-inspector-card');
    await expect(card).toBeVisible();
    const modalBox = await page.locator('.de-modal').boundingBox();
    const cardBox = await card.boundingBox();
    expect(overlaps(cardBox!, modalBox!), `popup ${JSON.stringify(cardBox)} overlaps modal ${JSON.stringify(modalBox)}`)
      .toBe(false);
  });

  test('the popup is visible on screen at a normal window height', async ({ page }) => {
    // bugs/archive/BUG_20260817_equation_inspector_popup_overlaps_the_editor.md — the "below the modal"
    // fallback picked a vertical band without checking the popup's own height fit in it, so at an
    // ordinary (not maximized) window height the popup rendered past the bottom of the viewport —
    // present in the DOM, entirely invisible.
    await openDriverEditor(page);
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();
    await driverEditorField(page, 'Fs').locator('label').click();
    const vh = await page.evaluate(() => window.innerHeight);
    const box = await page.locator('.eq-inspector-card').boundingBox();
    expect(box!.y, 'popup top is above the viewport').toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, `popup bottom (${box!.y + box!.height}) exceeds the window height (${vh})`)
      .toBeLessThanOrEqual(vh + 1);
  });

  test('the popup shows no "Live:" substitution line', async ({ page }) => {
    await openDriverEditor(page);
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();
    await driverEditorField(page, 'Fs').locator('label').click();
    await expect(page.locator('.eq-inspector-card')).toBeVisible();
    await expect(page.locator('.eq-inspector-card').getByText('Live:')).toHaveCount(0);
  });
});
