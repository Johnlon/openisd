import {expect, test} from '../fixtures.js';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const WDR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'drivers', 'myprobes', 'per_field_and_misc', 's-re.wdr');

test('BUG: opening a .wdr with no project starts the wizard, not a default sealed project', async ({ page }) => {
  // No project open is this test's precondition. The clear also takes the shared fixture's
  // splash seed with it, so put that back — the splash is an overlay across the whole app and
  // is not what this test is about (`splash.browser.spec.ts` covers it).
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true } }));
  });
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();

  await page.locator('.original-root input[type=file]').setInputFiles({
    name: 's-re.wdr', mimeType: 'text/plain', buffer: readFileSync(WDR),
  });

  // A driver file is not a project — the wizard opens with the driver pre-selected on step 1
  // (Q3 ruling) instead of a ready-made sealed project.
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Select driver for project');
  // The driver is pre-selected (Q3): step 1 shows it in the banner above the library, and Next
  // is already offered (Q2).
  await expect(modal.locator('.selected-driver-banner')).toBeVisible();
  await expect(modal.locator('.dlist')).toBeVisible();

  // Complete the wizard: vented box has an alignment step, C4 default (docs/plans/archive/FIX_WIZARD_VENTED.md); the .wdr
  // driver must be the project's driver.
  await modal.locator('button', { hasText: 'Next' }).click();   // step 2
  await modal.locator('button', { hasText: 'Next' }).click();   // step 3
  await modal.locator('select').selectOption('vented');
  await modal.locator('button', { hasText: 'Next' }).click();   // step 4: vented alignment
  await modal.locator('button', { hasText: 'Next' }).click();   // step 5: name
  await modal.locator('input[type="text"]').fill('s-re project');
  await modal.locator('button', { hasText: 'Create' }).click();

  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.driver-id-row input').first()).toHaveValue(/\S/);
});
