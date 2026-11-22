import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';

/** The popup every export ends with: what was exported and its file name, one OK button. Reads the
 *  screen as a user does, then answers it. */
export async function expectExportedPopup(page: Page, title: string, message: RegExp): Promise<void> {
  const popup = page.locator('.confirm-modal');
  await expect(popup).toBeVisible();
  await expect(popup.locator('h2')).toHaveText(title);
  await expect(popup.locator('p')).toHaveText(message);
  await expect(popup.getByRole('button')).toHaveText(['OK']);
  await popup.getByRole('button', {name: 'OK'}).click();
  await expect(popup).toBeHidden();
}
