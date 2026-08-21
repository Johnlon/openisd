import { test, expect } from '../fixtures.js';
import type { Page } from '@playwright/test';

/**
 * Playwright Browser Test Suite: E/C/N Provenance Class Audit across all Driver Editor Fields
 *
 * Verifies that every input field in the Driver Editor Modal correctly receives its E/C/N
 * provenance CSS class (value-e for Entered, value-c for Calculated, value-n for Not Entered).
 */

/** Every input on the open tab. */
const editorInputs = (page: Page) =>
  page.locator('.de-body input[type="text"], .de-body input[type="number"]');

/**
 * The inputs on the open tab that carry NO provenance class, one entry per offender so a
 * failure names all of them rather than stopping at the first.
 *
 * Only VISIBLE inputs are judged: a tab that is not on screen still has its inputs in the DOM,
 * and those are not what this test is about. `:visible` is Playwright's own predicate, the same
 * one `Locator.isVisible()` uses, so the selector decides membership and the test body has
 * nothing left to branch on.
 */
async function unclassified(page: Page): Promise<string[]> {
  return page.locator('.de-body input[type="text"]:visible, .de-body input[type="number"]:visible')
    .evaluateAll(els => els
      .filter(el => {
        const target = el.closest('.value-e, .value-c, .value-n') ?? el;
        return !(target.classList.contains('value-e')
          || target.classList.contains('value-c')
          || target.classList.contains('value-n'));
      })
      .map(el => el.outerHTML.slice(0, 120)));
}

test.describe('Driver Editor E/C/N Provenance Class Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');

    // Open the Driver Editor the way a user does. Services are constructed by the composition
    // root and injected, so there is no module-level instance to import and call.
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();
    await page.locator('.edit-btn', { hasText: 'Edit' }).click();

    await page.locator('.de-body').waitFor({ state: 'visible' });
  });

  test('All input fields on Parameters tab render valid E/C/N provenance classes (value-e, value-c, or value-n)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    expect(await editorInputs(page).count(), 'Parameters tab must have fields').toBeGreaterThan(15);

    expect(await unclassified(page), 'Parameters inputs missing value-e / value-c / value-n').toEqual([]);
  });

  test('All input fields on Advanced tab render valid E/C/N provenance classes', async ({ page }) => {
    await page.getByRole('button', { name: 'Advanced parameters', exact: true }).click();

    expect(await editorInputs(page).count(), 'Advanced parameters tab must have fields').toBeGreaterThan(5);

    expect(await unclassified(page), 'Advanced parameters inputs missing value-e / value-c / value-n').toEqual([]);
  });

  test('All input fields on Dimensions tab render valid E/C/N provenance classes', async ({ page }) => {
    await page.getByRole('button', { name: 'Dimensions', exact: true }).click();

    expect(await editorInputs(page).count(), 'Dimensions tab must have fields').toBeGreaterThan(5);

    expect(await unclassified(page), 'Dimensions inputs missing value-e / value-c / value-n').toEqual([]);
  });

  test('Typing into a field transitions its class to value-e (Entered)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const input = page.locator('.de-fld:has-text("Pe") input').first();
    await input.fill('250');

    const hasEntered = await input.evaluate(el => el.closest('.value-e') !== null);
    expect(hasEntered).toBe(true);
  });

  test('Deriving a calculated field applies value-c (Calculated)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const qts = page.locator('.de-fld:has-text("Qts") input').first();
    const qes = page.locator('.de-fld:has-text("Qes") input').first();
    const qms = page.locator('.de-fld:has-text("Qms") input').first();

    await qts.fill('');
    await qes.fill('0.35');
    await qms.fill('3.50');

    const hasCalc = await qts.evaluate(el => el.closest('.value-c') !== null);
    expect(hasCalc).toBe(true);
  });

  test('Clearing an uncalculated field transitions its class to value-n (Not Entered)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const input = page.locator('.de-fld:has-text("Pe") input').first();
    await input.fill('');

    const hasNotEntered = await input.evaluate(el => el.closest('.value-n') !== null);
    expect(hasNotEntered).toBe(true);
  });
});
