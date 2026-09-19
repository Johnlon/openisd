import {expect, test} from '../fixtures.js';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const WDR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'drivers', 'myprobes', 'per_field_and_misc', 's-re.wdr');

test('BUG: opening a .wdr with no project starts the wizard, not a default sealed project', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();

  await page.locator('.original-root input[type=file]').setInputFiles({
    name: 's-re.wdr', mimeType: 'text/plain', buffer: readFileSync(WDR),
  });

  // A driver file is not a project — the wizard opens instead of a ready-made sealed project.
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Project name');

  // Complete the wizard with a box type + volume; the .wdr driver must be the project's driver.
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption('vented');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click();

  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.driver-id-row input').first()).toHaveValue(/\S/);
});
