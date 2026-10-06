import type {Locator, Page} from '@playwright/test';

/** Forces the mobile skin (and skips the splash) for every page load of this test. Call before
 *  `page.goto`. Deciding WHICH skin renders is `skin-selection`'s job; mobile specs assume it. */
export async function forceMobileSkin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
}

/** Opens the hamburger menu. */
export async function openMobileMenu(page: Page): Promise<void> {
  await page.locator('.mob-hamburger').click();
}

/** Opens the hamburger menu and taps one item. */
export async function tapMobileMenuItem(page: Page, item: string | RegExp): Promise<void> {
  await openMobileMenu(page);
  await page.locator('.mob-menu-item', { hasText: item }).click();
}

/** The mobile field row with the given label: a hand-built `.mob-field-row`, or a `UIField`
 *  (whose label is its own `<label>`) on a screen already moved to it. */
export function mobileFieldRow(page: Page, label: string): Locator {
  return page.locator('.mob-field-row, .ui-field')
    .filter({ has: page.locator('.mob-field-label, .ui-field-label', { hasText: label }) });
}
