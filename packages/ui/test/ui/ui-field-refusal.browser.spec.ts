/**
 * A refused entry in a UIField (ruling "b", bugs/BUG_20261005_no-common-ui-field-component.md):
 * a typed value the field cannot hold stays in the box, red, with a ⚠ that says what is wrong
 * and what to enter. Nothing is stored. Leaving the box keeps it; Esc puts the stored value back
 * and does not close the dialog.
 */
import {expect, openAProject, test} from '../fixtures.js';
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
});

test('typing 0 into a positive field is refused, explained, kept on leaving, and Esc restores', async ({ page }) => {
  const qts = page.locator('.ui-field[data-field-key="Qts"]');
  const box = qts.locator('input');
  const stored = await box.inputValue();
  expect(Number(stored)).toBeGreaterThan(0);

  await box.fill('0');
  await expect(box).toHaveClass(/inp-bad/);
  await expect(qts.locator('.ui-field-note')).toHaveText(/Qts must be greater than 0 — enter a value above 0, up to \d/);

  // Leaving keeps the refused entry and its reason; the driver still holds the stored value.
  await box.press('Tab');
  await expect(box).toHaveValue('0');
  await expect(qts.locator('.ui-field-note')).toBeVisible();

  await box.focus();
  await box.press('Escape');
  await expect(box).toHaveValue(stored);
  await expect(box).not.toHaveClass(/inp-bad/);
  await expect(qts.locator('.ui-field-note')).toHaveCount(0);
  await expect(page.locator('.de-modal'), 'Esc on a refused entry must not close the editor').toBeVisible();
});
