import { test, expect } from '@playwright/test';

/**
 * Playwright Browser Test Suite: Driver Field Provenance Inspector & Equation Inspector
 *
 * Verifies interactive field provenance highlighting and the non-modal equation inspector overlay.
 */

test.describe('Driver Field Provenance Inspector & Equation Inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');

    // Open Driver Editor Modal on project driver
    await page.evaluate(async () => {
      const spec = '/src/composables/useDriverSelection.ts';
      const mod = await import(/* @vite-ignore */ spec);
      mod.editProjectDriver();
    });

    await page.locator('.de-body').waitFor({ state: 'visible' });
  });

  test('Inspect Provenance checkbox is present in Driver Editor header', async ({ page }) => {
    const chk = page.getByRole('checkbox', { name: 'Inspect Provenance' });
    await expect(chk).toBeVisible();
  });

  test('Toggling Inspect Provenance on and clicking Qts highlights feeding fields and pops up non-modal Equation Inspector', async ({ page }) => {
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
    await expect(pathCards.nth(1)).toContainText('Qes = (2π × Fs × Mms × Re) / BL²');
  });

  test('Closing Equation Inspector via ✕ button dismisses the non-modal overlay while keeping Driver Editor open', async ({ page }) => {
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
});
