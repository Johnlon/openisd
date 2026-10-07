import {expect, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
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

  // bugs/BUG_20261005_no-common-ui-field-component.md: a loss can never be blank. The emptied box
  // is refused (kept as typed, red, with the ⚠); nothing is stored, and Esc restores the stored value.
  test('an emptied Ql is refused with a ⚠, never stored as 0; Esc restores it', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('.link-btn', { hasText: 'Advanced' }).first().click();
    const row = page.locator('.overlay.open .ui-field', { hasText: 'Leakage Ql' });
    const ql = row.locator('input');
    await fillAndBlur(ql, '7');
    await ql.fill('');
    await expect(ql).toHaveValue('');
    await expect(row.locator('.ui-field-dq-btn')).toBeVisible();
    await ql.press('Escape');
    await expect(ql).toHaveValue(/^7(\.0+)?$/);
  });

  // bugs/BUG_20261007_advanced-link-opens-every-chamber-losses.md: each chamber panel's Advanced->
  // opens that chamber's losses only (WinISD probe e7c754c).
  for (const [type, rearPorts] of [['bandpass4', 0], ['bandpass6', 1], ['abc', 1]] as const) {
    const openFor = async (page: Page, chamber: 'Rear' | 'Front') => {
      await page.locator('.box-fields-col', { has: page.locator('.section-header', { hasText: `${chamber} chamber` }) })
        .locator('.link-btn', { hasText: 'Advanced' }).click();
      return page.locator('.overlay.open');
    };
    test(`${type}: the rear link shows only the Rear chamber set, the front link only the Front set`, async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await page.locator('select#og-box-type').selectOption(type);
      const rear = await openFor(page, 'Rear');
      await expect(rear.locator('.section-header')).toHaveText(['Rear chamber']);
      await expect(rear.locator('.ui-field', { hasText: 'Port Qp' })).toHaveCount(rearPorts);
      await expect(rear.locator('.ui-field', { hasText: 'Interchamber Qicl' })).toHaveCount(1);
      await rear.locator('.ok-btn', { hasText: /^OK$/ }).click();
      const front = await openFor(page, 'Front');
      await expect(front.locator('.section-header')).toHaveText(['Front chamber']);
      await expect(front.locator('.ui-field', { hasText: 'Port Qp' })).toHaveCount(1);
      await expect(front.locator('.ui-field', { hasText: 'Interchamber Qicl' })).toHaveCount(1);
    });
    test(`${type}: Reset puts only the open chamber back; the Qicl is one value for both`, async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await page.locator('select#og-box-type').selectOption(type);
      const q = (box: Locator, label: string) => box.locator('.ui-field', { hasText: label }).locator('input');
      let box = await openFor(page, 'Front');
      await fillAndBlur(q(box, 'Leakage Ql'), '7');
      await fillAndBlur(q(box, 'Interchamber Qicl'), '42');
      await box.locator('.ok-btn', { hasText: /^OK$/ }).click();
      box = await openFor(page, 'Rear');
      await expect(q(box, 'Leakage Ql')).toHaveValue(/^10(\.0+)?$/);
      await expect(q(box, 'Interchamber Qicl')).toHaveValue(/^42(\.0+)?$/);
      await fillAndBlur(q(box, 'Leakage Ql'), '8');
      await box.locator('#og-box-losses-reset').click();
      await expect(q(box, 'Leakage Ql')).toHaveValue(/^10(\.0+)?$/);
      await expect(q(box, 'Interchamber Qicl')).toHaveValue(/^100(\.0+)?$/);
      await box.locator('.ok-btn', { hasText: /^OK$/ }).click();
      box = await openFor(page, 'Front');
      await expect(q(box, 'Leakage Ql')).toHaveValue(/^7(\.0+)?$/);
    });
  }
});
