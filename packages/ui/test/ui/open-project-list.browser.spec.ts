/**
 * The desktop Open project dialog: each saved project shows its name, then a grey line with its
 * driver, box type and box volume (John, 2026-10-05: "can the Open project action show the
 * driver name, and volume and type?").
 */
import {duplicateFocusedProject, expect, openAProject, setFocusedBoxType, setFocusedBoxVolume, test} from '../fixtures.js';

test('each saved project shows its driver, box type and volume under its name', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxType(page, 'vented');
  await setFocusedBoxVolume(page, 0.012);
  await page.locator('.tb-btn[title^="Save - "]').click();
  await duplicateFocusedProject(page, 'Second');
  await setFocusedBoxType(page, 'sealed');
  await setFocusedBoxVolume(page, 0.02);
  await page.locator('.tb-btn[title^="Save - "]').click();

  await page.getByTitle('Open project', {exact: true}).click();
  const rows = page.locator('.open-project-dialog .stored-project-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.locator('.stored-project-name')).toHaveText(['Second', 'sample-project']);
  await expect(rows.locator('.stored-project-summary')).toHaveText([
    'Tang Band W5-1138SMF · Closed · 20.0 L',
    'Tang Band W5-1138SMF · Vented · 12.0 L',
  ]);
  // John, 2026-10-05: never US style. "5 Oct 2026, 23:32", whatever the browser locale.
  for (const modified of await rows.locator('.stored-project-modified').allTextContents()) {
    expect(modified).toMatch(/^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}, \d{2}:\d{2}$/);
  }
});
