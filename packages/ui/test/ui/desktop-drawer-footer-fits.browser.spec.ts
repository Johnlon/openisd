import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';

/**
 * BUG_20261108_desktop-drawer-footer-buttons-cut-at-phone-width: in a 374 px window the desktop skin's
 * project drawer shows every button (New, Import, Export all, Bin) whole: inside the drawer and the window.
 */
async function startDesktopSkinAtPhoneWidth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, skinOverride: 'original'}}));
  });
  await page.setViewportSize({width: 374, height: 705});
  await page.goto('/');
}

/** Every drawer button whose box is not inside the drawer's box and the window. */
async function buttonsOutsideDrawer(page: Page): Promise<string[]> {
  const drawer = page.locator('.quad-projects-wrap');
  await expect(drawer).toBeVisible();
  return drawer.evaluate(wrap => {
    const w = wrap.getBoundingClientRect();
    return [...wrap.querySelectorAll('button')]
      .filter(b => b.checkVisibility() && b.getBoundingClientRect().width > 0)
      .map(b => ({name: (b.textContent ?? '').trim() || b.className, r: b.getBoundingClientRect()}))
      .filter(({r}) => r.top < w.top - 0.5 || r.bottom > w.bottom + 0.5 || r.left < w.left - 0.5 || r.right > w.right + 0.5
        || r.bottom > window.innerHeight + 0.5 || r.right > window.innerWidth + 0.5)
      .map(({name, r}) => `${name} x ${Math.round(r.left)}..${Math.round(r.right)} y ${Math.round(r.top)}..${Math.round(r.bottom)} (drawer y ${Math.round(w.top)}..${Math.round(w.bottom)}, x ${Math.round(w.left)}..${Math.round(w.right)})`);
  });
}

test('desktop skin at 374x705, no project: drawer buttons are inside the drawer and window', async ({page}) => {
  await startDesktopSkinAtPhoneWidth(page);
  await page.locator('.graph-empty-actions').waitFor();
  expect(await buttonsOutsideDrawer(page)).toEqual([]);
});

test('desktop skin at 374x705, with a project: drawer buttons are inside the drawer and window', async ({page}) => {
  await startDesktopSkinAtPhoneWidth(page);
  await openAProject(page);
  expect(await buttonsOutsideDrawer(page)).toEqual([]);
});
