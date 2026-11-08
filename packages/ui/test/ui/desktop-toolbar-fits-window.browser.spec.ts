import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';

/**
 * The desktop skin's toolbar (BUG_20261108_desktop-skin-clips-toolbar-at-phone-width): at 374 px
 * (a phone that chose "Switch to desktop view", or a narrow window) and at 1024 px every toolbar
 * button sits wholly inside the window and the page does not scroll sideways.
 */
for (const [width, height] of [[374, 705], [1024, 768]] as const) {
  test(`desktop skin at ${width}x${height}: every toolbar button is inside the window`, async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, skinOverride: 'original'}}));
    });
    await page.setViewportSize({width, height});
    await page.goto('/');
    await page.locator('.original-root .toolbar').waitFor();
    const cut = await page.locator('.original-root .toolbar').evaluate(bar => {
      const view = bar.ownerDocument.defaultView;
      const frame = bar.getBoundingClientRect();
      return [...bar.querySelectorAll('button, .tb-btn, select, input')]
        .filter(el => el.checkVisibility() && el.getBoundingClientRect().width > 0)
        .map(el => ({name: el.getAttribute('aria-label') ?? el.getAttribute('title') ?? el.className, box: el.getBoundingClientRect()}))
        .filter(({box}) => box.left < -0.5 || box.right > (view?.innerWidth ?? 0) + 0.5 || box.right > frame.right + 0.5 || box.bottom > frame.bottom + 0.5)
        .map(({name, box}) => `${name.slice(0, 40)} ${Math.round(box.left)}..${Math.round(box.right)}`);
    });
    expect(cut).toEqual([]);
    expect(await page.locator('.original-root .toolbar').evaluate(bar => bar.scrollWidth <= bar.clientWidth + 1), 'toolbar does not scroll sideways').toBe(true);
  });
}

/** Every visible button, menu item and link that pokes outside the window, named with its box. */
async function cutControls(page: Page, root: string): Promise<string[]> {
  return page.evaluate(selector => {
    const width = window.innerWidth;
    return [...document.querySelectorAll(selector)].flatMap(r => [...r.querySelectorAll('button, [role="menuitem"], a[href], select')])
      .filter(el => el.checkVisibility() && el.getBoundingClientRect().width > 0)
      .map(el => ({name: (el.textContent ?? '').trim().slice(0, 40) || el.getAttribute('aria-label') || el.className, box: el.getBoundingClientRect()}))
      .filter(({box}) => box.left < -0.5 || box.right > width + 0.5)
      .map(({name, box}) => `${name} ${Math.round(box.left)}..${Math.round(box.right)}`);
  }, root);
}

/**
 * BUG_20261108_desktop-skin-menus-and-drawer-cut-at-phone-width: with a project open, the Save As / Export
 * menu items, the project drawer actions (Export all, Bin), the Advanced tab and the Options Environment
 * group all sit inside the window.
 */
for (const [width, height] of [[374, 705], [1024, 768]] as const) {
  test(`desktop skin at ${width}x${height}: menu items, drawer actions and Options stay inside the window`, async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, skinOverride: 'original'}}));
    });
    await page.setViewportSize({width, height});
    await page.goto('/');
    await openAProject(page);
    await page.locator('#btnExportMenu').click();
    await page.locator('.export-menu-list').waitFor();
    expect(await cutControls(page, '.export-menu-list'), 'Save As menu').toEqual([]);
    await page.locator('#btnExportMenu').click();
    await expect(page.locator('.original-project-list')).toBeVisible();
    expect(await cutControls(page, '.original-project-list'), 'project drawer').toEqual([]);
    expect(await page.locator('.original-project-list').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'drawer does not scroll sideways').toBe(true);
    await page.locator('.tb-btn[title^="Options"]').click();
    await page.locator('.opt-modal').waitFor();
    expect(await cutControls(page, '.opt-modal'), 'Options dialog').toEqual([]);
  });
}

for (const [width, height] of [[374, 705], [1024, 768]] as const) {
  test(`desktop skin at ${width}x${height}: the empty-graph links are inside the window`, async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, skinOverride: 'original'}}));
    });
    await page.setViewportSize({width, height});
    await page.goto('/');
    await page.locator('.graph-empty-actions').waitFor();
    expect(await cutControls(page, '.graph-empty-actions')).toEqual([]);
  });
}
