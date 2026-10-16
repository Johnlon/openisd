/**
 * A new build reaches an open app (T243). The suite's build has no service worker, so a scripted host
 * stands in: a waiting build is delivered and the app is brought back into view.
 *  - nothing unsaved: the app switches by itself and reloads;
 *  - unsaved edits: "New version available" with Reload / Not now, in both skins;
 *  - About: Force refresh with the running build beside it and the note; one press reloads, projects stay.
 */
import type {Page} from '@playwright/test';
import {dirtyFocusedDesign, expect, focusedProjectName, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {deliverWaitingBuild} from '../fixtures/updateHost.js';

interface Skin {
  readonly name: string;
  readonly open: (page: Page) => Promise<void>;
  readonly openAbout: (page: Page) => Promise<void>;
  readonly ready: string;
  /** The smallest touch target the skin must give (px). */
  readonly touchMin: number;
}

const SKINS: Skin[] = [
  {
    name: 'original', ready: '.original-root', touchMin: 0,
    open: async page => { await page.goto('/'); await openAProject(page); },
    openAbout: async page => {
      await page.locator('.tb-btn.has-menu[title="Info"]').click();
      await page.locator('.dropdown-menu .menu-item', {hasText: 'About OpenISD'}).click();
    },
  },
  {
    name: 'mobile', ready: '.mob-tabbar', touchMin: 44,
    open: async page => { await forceMobileSkin(page); await page.setViewportSize({width: 390, height: 844}); await page.goto('/'); await openAMobileProject(page); },
    openAbout: async page => { await tapMobileMenuItem(page, 'About OpenISD'); },
  },
];

for (const skin of SKINS) {
  test.describe(`${skin.name} skin`, () => {
    test('a clean app switches to the waiting build by itself and reloads', async ({page}) => {
      await skin.open(page);
      const reloaded = page.waitForEvent('load');
      await deliverWaitingBuild(page);
      expect(await reloaded).toBe(page);
    });

    test('unsaved edits: the app offers, Not now holds, a newer build offers again', async ({page}) => {
      await skin.open(page);
      await dirtyFocusedDesign(page);
      await deliverWaitingBuild(page);
      const strip = page.getByTestId('update-strip');
      await expect(strip).toBeVisible();
      await expect(strip).toContainText('New version available');
      for (const id of ['update-reload', 'update-later']) {
        const box = await strip.getByTestId(id).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(skin.touchMin);
      }
      await strip.getByTestId('update-later').click();
      await expect(strip).toHaveCount(0);
      await deliverWaitingBuild(page);
      await expect(strip).toBeVisible();
      const scroll = await page.evaluate(() => ({w: document.documentElement.scrollWidth, iw: window.innerWidth, h: document.documentElement.scrollHeight, ih: window.innerHeight}));
      expect(scroll.w).toBeLessThanOrEqual(scroll.iw);
      expect(scroll.h).toBeLessThanOrEqual(scroll.ih);
    });

    test('Reload asks about the unsaved edits; Keep does nothing, Reload reloads', async ({page}) => {
      await skin.open(page);
      await dirtyFocusedDesign(page);
      await deliverWaitingBuild(page);
      await page.getByTestId('update-reload').click();
      const ask = page.locator('.confirm-modal').filter({hasText: 'Discard changes?'});
      await expect(ask).toBeVisible();
      await ask.getByRole('button', {name: 'Keep'}).click();
      await expect(page.getByTestId('update-strip')).toBeVisible();
      await page.getByTestId('update-reload').click();
      const reloaded = page.waitForEvent('load');
      await ask.getByRole('button', {name: 'Reload'}).click();
      await reloaded;
    });

    test('About: Force refresh with its note, one press reloads and the projects stay', async ({page}) => {
      await skin.open(page);
      const name = await focusedProjectName(page);
      await skin.openAbout(page);
      const button = page.getByTestId('force-refresh');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Force refresh');
      await expect(page.locator('.sp-refresh-note')).toHaveText('Loads the newest version. Your projects stay.');
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(skin.touchMin);
      const reloaded = page.waitForEvent('load');
      await button.click();
      await reloaded;
      await page.locator(skin.ready).waitFor({state: 'visible'});
      expect(await focusedProjectName(page)).toBe(name);
    });
  });
}
