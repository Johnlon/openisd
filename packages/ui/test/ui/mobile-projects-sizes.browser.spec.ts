/** The phone Projects page and the menu's open projects fit every phone: nothing clipped, no sideways scroll. */
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, SAMPLE_PROJECT_OWPR, test} from '../fixtures.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';

for (const size of PHONE_SIZES) {
  test(`${size.name} ${size.width}x${size.height}: the menu and the Projects page fit`, async ({page}) => {
    await page.setViewportSize({width: size.width, height: size.height});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page, SAMPLE_PROJECT_OWPR, 'Sub 12.owpr');
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR, 'Tower mk2.owpr');

    await openMobileMenu(page);
    const menu = page.locator('.mob-menu');
    expect(await menu.evaluate(el => el.scrollWidth <= el.clientWidth), 'the menu scrolls sideways').toBe(true);
    for (const row of await page.locator('.mob-open-project').all()) {
      const box = await row.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
      expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(size.width);
    }
    await expect(page.locator('.mob-open-project-close').first()).toBeInViewport();

    await page.locator('.mob-menu-item', {hasText: 'Projects'}).click();
    const pane = page.locator('.mob-projects-pane');
    await expect(pane).toBeVisible();
    expect(await pane.evaluate(el => el.scrollWidth <= el.clientWidth), 'the page scrolls sideways').toBe(true);
    await expect(pane.locator('.mob-dlg-footer').getByRole('button', {name: 'Close'})).toBeInViewport();
    for (const row of await pane.locator('.mob-project-row').all()) {
      const box = await row.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
      await expect(row.locator('.mob-project-menu-btn')).toBeInViewport();
    }
  });
}
