/**
 * The mobile Passive Radiator tab. The FIELD WIRING itself (PR readouts) is proven once, in
 * `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s `createPassiveRadiatorActions` suite and the
 * domain's own tests. These specs prove the UI is correctly WIRED to that shared logic.
 */
import {expect, focusedPassiveRadiatorSpec, openAMobileProject, test} from '../fixtures.js';
import {fillAndCommit} from '../fixtures/numField.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobilePrTab', () => {
  test('a passive-radiator box shows passive radiator fields and Select passive radiator opens the browser', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();
    await expect(page.locator('.mob-panel-head').first()).toHaveText('Passive radiator');
    await expect(mobileFieldRow(page, 'Vas')).toBeVisible();
    await expect(mobileFieldRow(page, 'Fpr (with added mass)')).toBeVisible();

    await page.getByText('Select passive radiator', { exact: true }).click();
    await expect(page.getByText('Passive radiator library')).toBeVisible();
    await page.locator('.modal .x').click();
    await expect(page.getByText('Passive radiator library')).toHaveCount(0);
  });

  // John, 2026-10-05: every PR field is editable on the page, so the page has no Edit button.
  test('the PR page has no Edit button and edits every passive radiator field in place', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();

    await expect(page.locator('.mob-pr-actions button', { hasText: /^Edit$/ })).toHaveCount(0);

    const input = (label: string) => mobileFieldRow(page, label).locator('input').first();
    await page.locator('#mob-pr-name').fill('Bench PR 12');
    await fillAndCommit(input('Vas'), '7.5');
    await fillAndCommit(input('Qms'), '12.25');
    await fillAndCommit(mobileFieldRow(page, 'Fpr').filter({ hasNotText: 'with added mass' }).locator('input').first(), '21.5');
    await fillAndCommit(input('Sd'), '300');
    await fillAndCommit(input('Xmax'), '12');
    await page.locator('#mob-pr-count').selectOption('2');

    const stored = await focusedPassiveRadiatorSpec(page);
    expect(stored.name).toBe('Bench PR 12');
    expect(stored.vas_m3).toBeCloseTo(0.0075, 6);   // litres on screen
    expect(stored.qms).toBeCloseTo(12.25, 3);
    expect(stored.fs_hz).toBeCloseTo(21.5, 3);
    expect(stored.sd_m2).toBeCloseTo(0.03, 6);      // cm² on screen
    expect(stored.xmax_m).toBeCloseTo(0.012, 6);    // mm on screen
    expect(stored.count).toBe(2);
  });

  // John, 2026-10-05: "Save PR to library needs to ask for a name confirmation dialog." The
  // name typed there names the library copy only; the project's radiator keeps its own name.
  test('Save to library asks for a name, prefilled, and saves a copy under the typed name', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();

    await page.locator('#mob-pr-name').fill('Bench PR');
    await page.getByRole('button', { name: 'Save to library' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save passive radiator to library' });
    const name = dialog.locator('input');
    await expect(name).toHaveValue('Bench PR');
    await name.fill('Library Bench PR');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.locator('#mob-pr-name')).toHaveValue('Bench PR');
    await page.getByText('Select passive radiator', { exact: true }).click();
    await expect(page.locator('.pr-lib-item .pr-lib-name', { hasText: 'Library Bench PR' })).toBeVisible();
  });
});
