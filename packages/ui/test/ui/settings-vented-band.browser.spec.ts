/**
 * The Options dialog's vented band, end to end — the one seam the lower layers cannot prove.
 *
 * The band is an APPLICATION setting (John, 2026-09-22: "we can make the limits application
 * level limit settings"; 2026-09-24: "it is an app not proj setting" — so it lives in Options,
 * not the project tab rail). This spec checks the two things that only exist once the real
 * shell, the real repo and the real engine are wired together:
 *
 *   1. the dialog renders and edits the band with NO project open — it is not behind the
 *      project gate;
 *   2. a band the user narrows reaches a calculation that is already on screen, and the wizard
 *      readout marks the designed value instead of changing it.
 *
 * The hook's own arithmetic and its checks are covered at layer 2
 * (`test/hooks/OptionsModal-hooks.test.ts`); nothing here re-verifies them.
 */
import {expect, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

async function openOptions(page: import('playwright').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
  await page.locator('.tb-btn[title="Options"]').click();
  await expect(page.locator('.opt-modal')).toBeVisible();
}

/** The dialog's OK — applies every app setting in the draft and closes. */
async function clickOk(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="settings-apply"]').click();
  await expect(page.locator('.opt-modal')).toHaveCount(0);
}

/** Walk the wizard to step 4 with a vented box, on the first driver in the library. */
async function wizardToVentedAlignment(page: import('playwright').Page) {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Select driver for project');
  await modal.locator('.dlist .ditem').first().click();
  await modal.locator('.use-btn').click();                      // choosing the driver lands step 2
  await modal.locator('button', { hasText: 'Next' }).click();   // step 3: box type
  await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption('vented');
  await modal.locator('button', { hasText: 'Next' }).click();   // step 4: vented alignment
  await expect(modal).toContainText('Tuning frequency');
  return modal;
}

test('Options opens with no project and shows the factory band', async ({ page }) => {
  await openOptions(page);

  // No project was ever opened — the project tabs say so, the dialog edits regardless.
  await expect(page.locator('.projects-list')).toContainText('No projects open');
  await expect(page.locator('.opt-modal')).toContainText('Vented design limits');

  // DEFAULT_VENTED_DESIGN_LIMITS in the units on screen: 1 L … 1000 L, 10 Hz … 150 Hz.
  await expect(page.locator('#set-min-volume')).toHaveValue('1.00');
  await expect(page.locator('#set-max-volume')).toHaveValue('1000.00');
  await expect(page.locator('#set-min-tuning')).toHaveValue('10.00');
  await expect(page.locator('#set-max-tuning')).toHaveValue('150.00');
});

test('an inside-out band is refused, and OK stays dead until it is a band', async ({ page }) => {
  await openOptions(page);

  await fillAndBlur(page.locator('#set-min-volume'), '900');
  await fillAndBlur(page.locator('#set-max-volume'), '5');
  await expect(page.locator('[data-testid="settings-error"]'))
    .toContainText('Minimum volume must be below maximum volume');
  await expect(page.locator('[data-testid="settings-apply"]')).toBeDisabled();

  await fillAndBlur(page.locator('#set-max-volume'), '1200');
  await expect(page.locator('[data-testid="settings-error"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="settings-apply"]')).toBeEnabled();
});

test('the wizard readout is unmarked under the factory band', async ({ page }) => {
  await page.goto('/');
  const modal = await wizardToVentedAlignment(page);

  // An ordinary driver designs an ordinary box: inside 1 L … 1000 L and 10 Hz … 150 Hz, so
  // nothing is marked. This is what makes the next test's marks mean something.
  await expect(modal.locator('[data-testid="np-vented-volume-warning"]')).toHaveCount(0);
  await expect(modal.locator('[data-testid="np-vented-tuning-warning"]')).toHaveCount(0);
});

test('a band the user narrows marks the wizard readout — the value itself is untouched', async ({ page }) => {
  await openOptions(page);

  // A band no real design fits: 1 L … 2 L, 1 Hz … 2 Hz.
  await fillAndBlur(page.locator('#set-min-volume'), '1');
  await fillAndBlur(page.locator('#set-max-volume'), '2');
  await fillAndBlur(page.locator('#set-min-tuning'), '1');
  await fillAndBlur(page.locator('#set-max-tuning'), '2');
  await clickOk(page);

  const modal = await wizardToVentedAlignment(page);

  // Both designed values are called out, and each sentence names the band it failed and says
  // the number is WinISD's own rather than a bug.
  const volume = modal.locator('[data-testid="np-vented-volume-warning"]');
  await expect(volume).toContainText('outside the plausible 1 L – 2 L band set in Settings');
  await expect(volume).toContainText('WinISD gives the same answer');
  await expect(modal.locator('[data-testid="np-vented-tuning-warning"]'))
    .toContainText('outside the plausible 1 Hz – 2 Hz band set in Settings');

  // The designed numbers are NEVER changed by a mark — the readout still shows a real box.
  const readout = modal.locator('.readout-box');
  await expect(readout).not.toContainText('Box volume: 0.0 l');
  await expect(readout).not.toContainText('Tuning frequency: 0.0 Hz');
});

test('Reset to defaults puts the factory band back and clears the marks', async ({ page }) => {
  await openOptions(page);

  await fillAndBlur(page.locator('#set-max-volume'), '2');
  await clickOk(page);

  // The dialog reopens showing the narrowed band; the fieldset's reset is draft-only until OK.
  await page.locator('.tb-btn[title="Options"]').click();
  await expect(page.locator('#set-max-volume')).toHaveValue('2.00');
  await page.locator('[data-testid="settings-reset"]').click();
  await expect(page.locator('#set-max-volume')).toHaveValue('1000.00');
  await expect(page.locator('[data-testid="settings-reset"]')).toBeDisabled();
  await clickOk(page);

  const modal = await wizardToVentedAlignment(page);
  await expect(modal.locator('[data-testid="np-vented-volume-warning"]')).toHaveCount(0);
});
