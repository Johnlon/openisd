/**
 * T733: a banner on the phone skin (the cloud-sync hint) never sits over a control. Found by the AI
 * review of test.openisd.app v20261108T0610Z: "the banner covers the bottom tab bar" and "the menu
 * button cannot be clicked after the first project is created".
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {enableCloudSync, stubGoogleApis} from './fixtures/cloudSyncStubs.js';

const TEST_DRIVER = 'Tang Band W5-1138SMF';

async function showSyncHint(page: Page): Promise<void> {
  await enableCloudSync(page);
  await stubGoogleApis(page);
  await page.addInitScript(() => {
    localStorage.setItem('openisd_cloud_ui', JSON.stringify({launches: 1, hintDismissed: false, conflictsSeen: 0}));
  });
  await forceMobileSkin(page);
  await page.setViewportSize({width: PIXEL_9.width, height: PIXEL_9.height});
  await page.goto('/');
}

/** True when the element at the control's centre is the control itself (or inside it). */
async function isOnTop(control: Locator): Promise<boolean> {
  return control.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && el.contains(hit);
  });
}

test('with the sync banner shown, every bottom tab is fully visible and on top', async ({page}) => {
  await showSyncHint(page);
  await openAMobileProject(page);
  await expect(page.locator('.mob-hint-banner')).toBeVisible();
  await expect(page.locator('.mob-tabbar button')).toHaveCount(5);
  const m = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.mob-tabbar button'));
    const banner = document.querySelector('.mob-hint-banner')!.getBoundingClientRect();
    const bar = document.querySelector('.mob-tabbar')!.getBoundingClientRect();
    return {
      allOnTop: tabs.every(el => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit !== null && el.contains(hit);
      }),
      lowestTabEdge: Math.max(...tabs.map(el => el.getBoundingClientRect().bottom)),
      bannerBottom: banner.bottom,
      barTop: bar.top,
    };
  });
  expect(m.allOnTop).toBe(true);
  expect(m.lowestTabEdge).toBeLessThanOrEqual(PIXEL_9.height);
  expect(m.bannerBottom).toBeLessThanOrEqual(m.barTop + 0.5);
});

test('after the first project is made with the wizard, the menu button is on top and opens the menu', async ({page}) => {
  await showSyncHint(page);
  await page.getByText('New project').click();
  await page.getByText(TEST_DRIVER).click();
  const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
  await next.click();
  await next.click();
  await page.locator('#np-box-type').selectOption({label: 'Vented'});
  await next.click();
  await next.click();
  await page.locator('.mob-np-footer').getByText('Create Project', {exact: true}).click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();
  const menu = page.getByRole('button', {name: 'Menu', exact: true});
  const tabs = page.locator('.mob-tabbar button');
  for (let i = 0; i < 5; i++) {
    await tabs.nth(i).click();
    expect(await isOnTop(menu)).toBe(true);
  }
  await menu.click();
  await expect(page.locator('.mob-menu-item').first()).toBeVisible();
});
