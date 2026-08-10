/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/driver-editor/spec.md?html
 */
import { test, expect } from '@playwright/test';

/**
 * Playwright Browser Test Suite: E/C/N Provenance Class Audit across all Driver Editor Fields
 *
 * Verifies that every input field in the Driver Editor Modal correctly receives its E/C/N
 * provenance CSS class (st-e for Entered, st-c for Calculated, st-n for Not Entered).
 */

test.describe('Driver Editor E/C/N Provenance Class Audit', () => {
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

  test('All input fields on Parameters tab render valid E/C/N provenance classes (st-e, st-c, or st-n)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const inputs = page.locator('.de-body input[type="text"], .de-body input[type="number"]');
    const count = await inputs.count();
    expect(count, 'Parameters tab must have fields').toBeGreaterThan(15);

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (!(await input.isVisible())) continue;

      const hasClass = await input.evaluate(el => {
        const target = el.closest('.st-e, .st-c, .st-n') || el;
        return target.classList.contains('st-e') || target.classList.contains('st-c') || target.classList.contains('st-n');
      });
      expect(hasClass, `Input index ${i} must have st-e, st-c, or st-n class`).toBe(true);
    }
  });

  test('All input fields on Advanced tab render valid E/C/N provenance classes', async ({ page }) => {
    await page.getByRole('button', { name: 'Advanced parameters', exact: true }).click();

    const inputs = page.locator('.de-body input[type="text"], .de-body input[type="number"]');
    const count = await inputs.count();
    expect(count, 'Advanced parameters tab must have fields').toBeGreaterThan(5);

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (!(await input.isVisible())) continue;

      const hasClass = await input.evaluate(el => {
        const target = el.closest('.st-e, .st-c, .st-n') || el;
        return target.classList.contains('st-e') || target.classList.contains('st-c') || target.classList.contains('st-n');
      });
      expect(hasClass, `Advanced input index ${i} must have st-e, st-c, or st-n class`).toBe(true);
    }
  });

  test('All input fields on Dimensions tab render valid E/C/N provenance classes', async ({ page }) => {
    await page.getByRole('button', { name: 'Dimensions', exact: true }).click();

    const inputs = page.locator('.de-body input[type="text"], .de-body input[type="number"]');
    const count = await inputs.count();
    expect(count, 'Dimensions tab must have fields').toBeGreaterThan(5);

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (!(await input.isVisible())) continue;

      const hasClass = await input.evaluate(el => {
        const target = el.closest('.st-e, .st-c, .st-n') || el;
        return target.classList.contains('st-e') || target.classList.contains('st-c') || target.classList.contains('st-n');
      });
      expect(hasClass, `Dimensions input index ${i} must have st-e, st-c, or st-n class`).toBe(true);
    }
  });

  test('Typing into a field transitions its class to st-e (Entered)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const input = page.locator('.de-fld:has-text("Pe") input').first();
    await input.fill('250');

    const hasEntered = await input.evaluate(el => el.closest('.st-e') !== null);
    expect(hasEntered).toBe(true);
  });

  test('Deriving a calculated field applies st-c (Calculated)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const qts = page.locator('.de-fld:has-text("Qts") input').first();
    const qes = page.locator('.de-fld:has-text("Qes") input').first();
    const qms = page.locator('.de-fld:has-text("Qms") input').first();

    await qts.fill('');
    await qes.fill('0.35');
    await qms.fill('3.50');

    const hasCalc = await qts.evaluate(el => el.closest('.st-c') !== null);
    expect(hasCalc).toBe(true);
  });

  test('Clearing an uncalculated field transitions its class to st-n (Not Entered)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const input = page.locator('.de-fld:has-text("Pe") input').first();
    await input.fill('');

    const hasNotEntered = await input.evaluate(el => el.closest('.st-n') !== null);
    expect(hasNotEntered).toBe(true);
  });
});
