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

  // bugs/BUG_20261007_4th-order-bandpass-merges-per-chamber-losses.md; WinISD probe e7c754c
  for (const [type, ports] of [['bandpass4', 1], ['bandpass6', 2], ['abc', 2]] as const) {
    test(`${type}: each chamber set has the one Qicl, and ${ports} Port Qp row(s)`, async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await page.locator('select#og-box-type').selectOption(type);
      await page.locator('.link-btn', { hasText: 'Advanced' }).first().click();
      const box = page.locator('.overlay.open');
      await expect(box.locator('.section-header')).toHaveText(['Rear chamber', 'Front chamber']);
      await expect(box.locator('.field', { hasText: 'Port Qp' })).toHaveCount(ports);
      const qicl = box.locator('.field', { hasText: 'Interchamber Qicl' }).locator('input');
      await expect(qicl).toHaveCount(2);
      await fillAndBlur(qicl.nth(1), '42');
      await expect(qicl.nth(0)).toHaveValue(/^42(\.0+)?$/);
      await expect(qicl.nth(1)).toHaveValue(/^42(\.0+)?$/);
      await box.locator('#og-box-losses-reset').click();
      await expect(qicl.nth(0)).toHaveValue(/^100(\.0+)?$/);
    });
  }

  // bugs/BUG_20261006_box-losses-popup-blank-for-6th-and-abc.md
  for (const type of ['bandpass6', 'abc'] as const) {
    test(`${type}: the popup shows a Rear and a Front chamber set; edits and Reset reach both`, async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await page.locator('select#og-box-type').selectOption(type);
      await page.locator('.link-btn', { hasText: 'Advanced' }).first().click();
      const box = page.locator('.overlay.open');
      await expect(box.locator('.section-header')).toHaveText(['Rear chamber', 'Front chamber']);
      const ql = box.locator('.field', { hasText: 'Leakage Ql' }).locator('input');
      await expect(ql).toHaveCount(2);
      await expect(ql.nth(0)).toHaveValue(/^10(\.0+)?$/);
      await fillAndBlur(ql.nth(1), '7');
      await expect(ql.nth(1)).toHaveValue(/^7(\.0+)?$/);
      await expect(ql.nth(0)).toHaveValue(/^10(\.0+)?$/);
      await box.locator('#og-box-losses-reset').click();
      await expect(ql.nth(1)).toHaveValue(/^10(\.0+)?$/);
    });
  }
});
