import {expect, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';

/**
 * Driver editor — a value shows the decimals it is known to (John, 2026-10-02):
 *  - an entered value keeps every decimal it was typed with ("0.0754" in η₀ showed "0.08");
 *  - a calculated value shows the decimals its entered inputs' half-widths support.
 * Never fewer than the field's own registry precision.
 */

async function openParameters(page: Page) {
  await page.goto('/', { timeout: 15000 });
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await page.locator('.de-body').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
}

/** Type `value` key by key and commit with Tab. `fill()` sends no keydown, which NumInput reads
 *  as a spinner step and rounds to the field's decimals — a person typing never does that. */
async function typeAndCommit(input: Locator, value: string) {
  await input.fill('');
  await input.pressSequentially(value);
  await input.press('Tab');
}

function inputFor(page: Page, label: string) {
  return page.locator('.de-body .de-fld', { has: page.locator(`label:text-is("${label}")`) })
    .first().locator('input').first();
}

test('η₀ typed as 0.0754 shows 0.0754 after commit', async ({ page }) => {
  await openParameters(page);
  const no = inputFor(page, 'η₀');
  await typeAndCommit(no, '0.0754');
  await expect(no).toHaveValue('0.0754');
});

test('an entered value typed to more decimals than the field shows keeps them', async ({ page }) => {
  await openParameters(page);
  const qes = inputFor(page, 'Qes');
  await typeAndCommit(qes, '0.45123');
  await expect(qes).toHaveValue('0.45123');
});

test('Qts calculated from 5-decimal Qes and Qms shows the decimals they support', async ({ page }) => {
  await openParameters(page);
  await fillAndBlur(inputFor(page, 'Qts'), '');
  await typeAndCommit(inputFor(page, 'Qes'), '0.45123');
  await typeAndCommit(inputFor(page, 'Qms'), '3.20000');
  // ±0.000005 on each bounds Qts to about ±0.0000039: known to 6 decimals.
  await expect(inputFor(page, 'Qts')).toHaveValue(/^0\.39\d{4}$/);
});
