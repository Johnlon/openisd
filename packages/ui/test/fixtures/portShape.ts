import type {Page} from '@playwright/test';

/** Presses every port shape button of the active desktop tab that does not already show `shape`, as a user does. */
export async function setPortShapes(page: Page, shape: 'round' | 'slotted'): Promise<void> {
  for (const toggle of await page.locator('.tab-section.active button.port-shape-toggle').all()) {
    if ((await toggle.innerText()).trim().toLowerCase() !== shape) await toggle.click();
  }
}
