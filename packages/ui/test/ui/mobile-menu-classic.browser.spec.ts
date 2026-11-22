import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, SAMPLE_PROJECT_OWPR, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';

/**
 * Screens 16-18 (PHONE_CLASSIC_BUILD_SPEC §4, mock box-combined-live.html?ov=menu, &saveas, &opened):
 * the ☰ drawer has grey 28 px section bands, Save As / Export opens its five choices in place and the
 * menu closes on a choice, and a file opened from disk shows among the open projects.
 */
for (const size of PHONE_SIZES) {
  test.describe(`☰ menu at ${size.width}×${size.height}`, () => {
    test.beforeEach(async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page, SAMPLE_PROJECT_OWPR, 'Sub 12.owpr');
      await openMobileMenu(page);
    });

    test('screen 16: the section headings are grey 28 px bands', async ({page}) => {
      const heads = page.locator('.mob-menu-section-head');
      await expect(heads).toHaveCount(3);
      for (const h of await heads.evaluateAll(els => els.map(e => {
        const s = getComputedStyle(e);
        return {height: e.getBoundingClientRect().height, bg: s.backgroundColor, upper: s.textTransform};
      }))) {
        expect(Math.abs(h.height - 28)).toBeLessThanOrEqual(0.5);
        expect(h.bg).toBe('rgb(236, 236, 236)');
        expect(h.upper).toBe('uppercase');
      }
    });

    test('screen 16: the menu fits, nothing cut, no sideways scroll', async ({page}) => {
      const r = await page.locator('.mob-menu').evaluate(menu => {
        const box = menu.getBoundingClientRect();
        const items = [...menu.querySelectorAll<HTMLElement>('.mob-menu-item, .mob-open-project-name')];
        return {
          sideways: menu.scrollWidth > menu.clientWidth,
          cut: items.filter(e => e.scrollWidth > e.clientWidth + 1).length,
          outside: items.filter(e => { const b = e.getBoundingClientRect(); return b.left < box.left - 0.5 || b.right > box.right + 0.5; }).length,
        };
      });
      expect(r).toEqual({sideways: false, cut: 0, outside: 0});
    });

    test('screen 17: Save As / Export opens five choices in place, with an arrow', async ({page}) => {
      const trigger = page.locator('.mob-menu-export .export-menu-trigger');
      await expect(trigger).toHaveCSS('justify-content', 'space-between');
      expect(await trigger.evaluate(e => getComputedStyle(e, '::after').content)).toBe('"▾"');
      await trigger.click();
      await expect(page.locator('.export-menu-list button')).toHaveCount(5);
      expect(await trigger.evaluate(e => getComputedStyle(e, '::after').content)).toBe('"▴"');
      const sub = await page.locator('.export-menu-list button').first().boundingBox();
      const main = await trigger.boundingBox();
      expect((sub?.x ?? 0) + 0.5).toBeGreaterThanOrEqual(main?.x ?? 0);
      const pad = await page.locator('.export-menu-list button').first().evaluate(e => parseFloat(getComputedStyle(e).paddingLeft));
      expect(pad).toBe(26);
    });

    test('screen 17: choosing one closes the menu', async ({page}) => {
      await page.locator('.mob-menu-export .export-menu-trigger').click();
      await Promise.all([
        page.waitForEvent('download'),
        page.locator('.export-menu-list button', {hasText: 'Save As WinISD project (.wpr)'}).click(),
      ]);
      await expect(page.locator('.mob-menu')).toHaveCount(0);
    });

    test('screen 18: a file opened from disk shows among the open projects', async ({page}) => {
      await page.locator('.mob-menu-overlay').click({position: {x: size.width - 4, y: 300}});
      await expect(page.locator('.mob-menu')).toHaveCount(0);
      await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR, 'Tower mk2.owpr');
      await openMobileMenu(page);
      await expect(page.locator('.mob-open-project')).toHaveCount(2);
      await expect(page.locator('.mob-open-project.focused .mob-open-project-name-text')).toContainText('Tower mk2');
    });
  });
}
