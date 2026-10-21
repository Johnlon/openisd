import {expect, openAMobileProject, SAMPLE_PROJECT_OWPR, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

/**
 * T541: the phone ☰ menu rows as the accepted mock (QO267 box-combined-live.html?ov=menu): rows
 * 31 px high with 15 px text, sub-items 14 px indented 26 px, a rule under the last row of a group.
 */
test.describe('☰ menu rows at 374×705', () => {
  test.beforeEach(async ({page}) => {
    await page.setViewportSize(PIXEL_9);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page, SAMPLE_PROJECT_OWPR, 'Sub 12.owpr');
    await openMobileMenu(page);
  });

  test('every row is 31 px high with 15 px text and 16 px side padding', async ({page}) => {
    const rows = await page.locator('.mob-menu-section > .mob-menu-item:not(.mob-menu-export), .mob-menu-export .export-menu-trigger').evaluateAll(els => els.map(e => {
      const s = getComputedStyle(e);
      return {text: (e.textContent ?? '').trim(), h: e.getBoundingClientRect().height, font: s.fontSize, left: s.paddingLeft, right: s.paddingRight};
    }));
    expect(rows.length).toBeGreaterThan(8);
    for (const r of rows) {
      expect(r, r.text).toMatchObject({h: 31, font: '15px', left: '16px', right: '16px'});
    }
  });

  test('Save As / Export choices are 14 px, 31 px high, indented 26 px', async ({page}) => {
    await page.locator('.mob-menu-export .export-menu-trigger').click();
    const subs = await page.locator('.export-menu-list button').evaluateAll(els => els.map(e => {
      const s = getComputedStyle(e);
      return {h: e.getBoundingClientRect().height, font: s.fontSize, left: s.paddingLeft};
    }));
    expect(subs).toHaveLength(5);
    for (const s of subs) expect(s).toEqual({h: 31, font: '14px', left: '26px'});
  });

  test('a rule line sits under Open a file, Save As / Export and Revert, and under no other row', async ({page}) => {
    const ruled = async () => page.locator('.mob-menu-section .mob-menu-item, .mob-menu-section .export-menu-trigger, .mob-menu-section .export-menu-list button').evaluateAll(
      els => els.filter(e => parseFloat(getComputedStyle(e).borderBottomWidth) === 1 && getComputedStyle(e).borderBottomColor !== 'rgba(0, 0, 0, 0)')
        .map(e => (e.textContent ?? '').trim()));
    expect(await ruled()).toEqual(['Open a file', 'Save As / Export', 'Revert unsaved changes']);
    await page.locator('.mob-menu-export .export-menu-trigger').click();
    const last = await page.locator('.export-menu-list button').last().innerText();
    expect(await ruled()).toEqual(['Open a file', last.trim(), 'Revert unsaved changes']);
  });

  test('nothing is clipped and there is no sideways scroll', async ({page}) => {
    const r = await page.locator('.mob-menu').evaluate(m => ({sideways: m.scrollWidth > m.clientWidth, page: document.documentElement.scrollWidth > innerWidth}));
    expect(r).toEqual({sideways: false, page: false});
    const last = page.locator('.mob-menu-item').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
  });
});
