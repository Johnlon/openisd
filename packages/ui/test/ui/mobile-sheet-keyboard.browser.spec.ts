/**
 * Phone What-if and Tune with the soft keyboard up (BUG_20261106_phone-whatif-tune-keyboard-hides-box):
 * the box being typed in is wholly on the visible screen, unobscured, with its neighbours; no blank
 * band sits between the sheet and the keyboard; the tab bar and footer buttons return with the keyboard.
 * Playwright cannot raise a real keyboard. Chrome on Android (resizes-visual) keeps the layout viewport at full height
 * and shrinks only the visual viewport, panning it to show the box; a scripted visualViewport stands in for that.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';

const FULL = {width: 374, height: 705};
/** The visible height with the keyboard up: 60% of 705, the keyboard taking the other 40%. */
const VISIBLE_WITH_KEYBOARD = 423;

test.use({hasTouch: true, viewport: FULL});

async function installKeyboardStandIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = new EventTarget();
    const state = {height: window.innerHeight, offsetTop: 0};
    Object.defineProperty(window, 'visualViewport', {configurable: true, value: {
      get height() { return state.height; }, get offsetTop() { return state.offsetTop; }, get scale() { return 1; },
      get width() { return window.innerWidth; }, get offsetLeft() { return 0; }, get pageTop() { return state.offsetTop; },
      addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target),
    }});
    // The keyboard goes up (height < full) or down; the browser pans to keep the focused box just above it.
    window.addEventListener('stand-in-keyboard', event => {
      const height = event instanceof CustomEvent && typeof event.detail === 'number' ? event.detail : window.innerHeight;
      state.height = height;
      const el = document.activeElement;
      const bottom = el === null ? 0 : el.getBoundingClientRect().bottom + 8;
      state.offsetTop = Math.max(0, Math.min(window.innerHeight - height, Math.round(bottom - height)));
      target.dispatchEvent(new Event('resize'));
      target.dispatchEvent(new Event('scroll'));
    });
  });
}

async function keyboard(page: Page, visibleHeight: number): Promise<void> {
  await page.evaluate(h => window.dispatchEvent(new CustomEvent('stand-in-keyboard', {detail: h})), visibleHeight);
}

async function openSheet(page: Page, mode: 'Tune' | 'What-if'): Promise<Locator> {
  await installKeyboardStandIn(page);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await expect(page.getByTestId('flash-strip')).toHaveCount(0);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.getByRole('button', {name: 'Open ' + mode}).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}

/** What covers the box at its left corners and centre, or '' when nothing does. */
async function coveredBy(box: Locator): Promise<string> {
  return box.evaluate(el => {
    const r = el.getBoundingClientRect();
    const pts = [[r.left + 1, r.top + 1], [r.left + 1, r.bottom - 1], [r.left + r.width / 2, r.top + r.height / 2]];
    for (const [x, y] of pts) {
      const hit = document.elementFromPoint(x, y);
      if (hit === null || !(el === hit || el.contains(hit))) return `${hit?.tagName}.${hit?.className} at ${Math.round(x)},${Math.round(y)}`;
    }
    return '';
  });
}

async function whollyVisible(page: Page, box: Locator): Promise<boolean> {
  const r = await box.boundingBox();
  const vv = await page.evaluate(() => ({h: window.visualViewport?.height ?? 0, top: window.visualViewport?.offsetTop ?? 0}));
  return r !== null && r.y >= vv.top && r.y + r.height <= vv.top + vv.h && r.x >= 0 && r.x + r.width <= FULL.width;
}

for (const mode of ['Tune', 'What-if'] as const) {
  test(`${mode}: the focused box is fully visible with its neighbours while the keyboard is up`, async ({page}) => {
    const sheet = await openSheet(page, mode);
    // The port area box opens the port's own fields instead of the keyboard (mobile-sheet-port spec), so it is not typed in here.
    const inputs = sheet.locator('.ui-field').filter({hasNot: page.locator('.ui-field-label', {hasText: /^Port area$/})}).locator('input[data-numinput]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (const index of [0, Math.floor(count / 2), count - 1]) {
      await keyboard(page, FULL.height);
      const input = inputs.nth(index);
      await input.scrollIntoViewIfNeeded();
      await input.tap();
      await keyboard(page, VISIBLE_WITH_KEYBOARD);
      await expect.poll(async () => (await whollyVisible(page, input)) ? await coveredBy(input) : 'outside the visible screen', {message: `box ${index} of ${count}`}).toBe('');
      for (const neighbour of [index - 1, index + 1].filter(n => n >= 0 && n < count)) {
        expect(await whollyVisible(page, inputs.nth(neighbour)), `row ${neighbour} next to ${index} visible`).toBe(true);
      }
      // No blank band: the tab bar ends at the bottom of the visible screen, the sheet sits right above it.
      // While typing the page hides the tab bar (rows get the height), so the sheet's footer ends there.
      const edge = await page.evaluate(() => ({bar: document.querySelector('.mob-sheet-foot')!.getBoundingClientRect().bottom, top: window.visualViewport!.offsetTop, h: window.visualViewport!.height}));
      expect(Math.abs(edge.bar - (edge.top + edge.h))).toBeLessThan(2);
      const scroll = await page.evaluate(() => ({x: document.documentElement.scrollWidth > window.innerWidth, y: document.documentElement.scrollHeight > window.innerHeight}));
      expect(scroll).toEqual({x: false, y: false});
    }
    await keyboard(page, FULL.height);
    await expect(sheet.locator('.mob-sheet-close')).toBeInViewport();
  });
}
