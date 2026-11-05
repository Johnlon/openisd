import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {CDPSession, Page} from '@playwright/test';

/**
 * A phone turned sideways shows the normal upright phone page through a window (QO418): the 480 px
 * column keeps its upright height (the window width), the document scrolls, and the grey either
 * side of the column is a drag surface. Upright phones and desktop windows have no document scroll.
 * Touch here is EMULATED (CDP Input.dispatchTouchEvent), not a real phone.
 */
test.use({hasTouch: true, isMobile: true});

const SIDEWAYS = [{width: 705, height: 374}, {width: 850, height: 390}];
const UPRIGHT = [{width: 374, height: 705}, {width: 320, height: 640}];

async function touchDrag(cdp: CDPSession, x: number, y0: number, y1: number): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y: y0}]});
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: y0 + ((y1 - y0) * i) / steps}]});
  }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}
const docScroll = (page: Page) => page.evaluate(() => Math.round(document.scrollingElement!.scrollTop));
const docRange = (page: Page) => page.evaluate(() => document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight);
const contentScroll = (page: Page) => page.evaluate(() => Math.round(document.querySelector('.mob-content')!.scrollTop));

async function openBox(page: Page, size: {width: number; height: number}): Promise<void> {
  await forceMobileSkin(page);
  await page.setViewportSize(size);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Box'}).tap();
}

for (const size of SIDEWAYS) {
  test.describe(`sideways ${size.width}x${size.height}`, () => {
    test.beforeEach(async ({page}) => { await openBox(page, size); });

    for (const side of ['left', 'right'] as const) {
      test(`dragging the ${side} grey scrolls the page`, async ({page}) => {
        const col = await page.locator('.app-root-mobile').boundingBox();
        const x = {left: col!.x / 2, right: (col!.x + col!.width + size.width) / 2}[side];
        expect(await docRange(page)).toBeGreaterThan(size.width - size.height - 2);
        const cdp = await page.context().newCDPSession(page);
        await touchDrag(cdp, x, 300, 100);
        await expect.poll(() => docScroll(page), {message: `document scroll after drag at x=${x}`}).toBeGreaterThan(50);
      });
    }

    test('the shell is the upright height and the tab bar is reachable at the page bottom', async ({page}) => {
      expect(await page.locator('.mobile-root').evaluate(el => el.getBoundingClientRect().height)).toBe(size.width);
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
      const bar = await page.locator('.mob-tabbar').boundingBox();
      expect(bar!.y + bar!.height).toBeLessThanOrEqual(size.height + 1);
      expect(bar!.y).toBeGreaterThanOrEqual(0);
    });

    test('dragging inside the column still scrolls the page; the column stays put sideways', async ({page}) => {
      const col = await page.locator('.app-root-mobile').boundingBox();
      const cdp = await page.context().newCDPSession(page);
      await touchDrag(cdp, col!.x + col!.width / 2, 300, 100);
      await expect.poll(async () => (await docScroll(page)) + (await contentScroll(page))).toBeGreaterThan(50);
      expect((await page.locator('.app-root-mobile').boundingBox())!.x).toBe(col!.x);
    });

    test('the driver editor can be read and closed', async ({page}) => {
      await page.locator('.mob-tab', {hasText: 'Driver'}).tap();
      await page.getByText('Edit', {exact: true}).tap();
      const modal = page.locator('.de-modal');
      await expect(modal).toBeVisible();
      const box = await modal.boundingBox();
      const col = await page.locator('.app-root-mobile').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(col!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(col!.x + col!.width + 1);
      await page.getByRole('button', {name: 'Cancel'}).scrollIntoViewIfNeeded();
      await page.getByRole('button', {name: 'Cancel'}).tap();
      await expect(modal).toBeHidden();
    });

    test('the Tune sheet can be opened and closed', async ({page}) => {
      await page.locator('.mob-tab', {hasText: 'Graph'}).tap();
      await page.getByRole('button', {name: 'Open Tune'}).scrollIntoViewIfNeeded();
      await page.getByRole('button', {name: 'Open Tune'}).tap();
      const sheet = page.locator('.mob-sheet');
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', {name: 'Close'}).scrollIntoViewIfNeeded();
      await sheet.getByRole('button', {name: 'Close'}).tap();
      await expect(sheet).toBeHidden();
    });
  });
}

test('rotating with an edited field open keeps the value', async ({page}) => {
  await openBox(page, UPRIGHT[0]);
  const input = page.locator('.mob-content input[type=text], .mob-content input:not([type])').first();
  await input.tap();
  await input.fill('123');
  await page.setViewportSize(SIDEWAYS[0]);
  await expect(page.locator('.mobile-root')).toHaveCSS('height', `${SIDEWAYS[0].width}px`);
  await expect(input).toHaveValue('123');
  await page.setViewportSize(UPRIGHT[0]);
  await expect(input).toHaveValue('123');
});

for (const size of [...UPRIGHT, {width: 1280, height: 720}]) {
  test(`${size.width}x${size.height}: no document scroll, shell height is the window's`, async ({page}) => {
    await openBox(page, size);
    expect(await docRange(page)).toBeLessThanOrEqual(1);
    expect(await page.locator('.mobile-root').evaluate(el => el.getBoundingClientRect().height)).toBe(size.height);
  });
}
