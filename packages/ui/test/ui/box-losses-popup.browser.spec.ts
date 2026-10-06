import {expect, openAProject, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

/** The Box losses popup (leakage Ql, absorption Qa) opened from the Box tab. */

test.describe('Box losses popup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test('the Box losses popup opens from the Box tab Advanced link and closes with OK', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('.link-btn', { hasText: 'Advanced' }).click();
    await expect(page.locator('.overlay.open')).toContainText('Box losses');
    await expect(page.locator('.overlay.open')).toContainText('Leakage Ql');
    await page.locator('.overlay.open .ok-btn', { hasText: /^OK$/ }).click();
    await expect(page.locator('.overlay.open')).toHaveCount(0);
  });

  // bugs/BUG_20261005_no-common-ui-field-component.md: the losses popup gets a Reset button.
  test('Reset puts Ql, Qa and Qp back to WinISD\'s defaults', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('.link-btn', { hasText: 'Advanced' }).first().click();
    const box = page.locator('.overlay.open');
    const q = (label: string) => box.locator('.field', { hasText: label }).locator('input');
    await fillAndBlur(q('Leakage Ql'), '7');
    await fillAndBlur(q('Absorption Qa'), '20');
    await fillAndBlur(q('Port Qp'), '50');
    await box.locator('#og-box-losses-reset').click();
    await expect(q('Leakage Ql')).toHaveValue(/^10(\.0+)?$/);
    await expect(q('Absorption Qa')).toHaveValue(/^100(\.0+)?$/);
    await expect(q('Port Qp')).toHaveValue(/^100(\.0+)?$/);
  });
});
