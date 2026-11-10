import {openAMobileProject} from '../fixtures.js';
import {phoneTab} from './viewOpenNavigation.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for the browser-owned views that the page can show part of (T787, batch 7). The OS file dialog
 * and the OS keyboard are not drawn in the page; what is measured is the app around them.
 */

const P = WalkSkin.Phone;

/** The phone window as Android leaves it while the keyboard is up: the same width, 300 px shorter. */
const KEYBOARD_UP_HEIGHT = 405;

/** Menu, Open a file: the browser is asked for a file (the chooser event fires), then the menu is shown again to measure. */
const nativeFiles: OpenStep = {root: '.mob-menu-overlay', open: async page => {
  await page.addInitScript(() => { Reflect.deleteProperty(globalThis, 'showOpenFilePicker'); });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.mob-menu-item', {hasText: 'Open a file'}).click();
  await chooser;
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-overlay').waitFor({state: 'visible'});
}};

/** A number field on the Box page is tapped while the window is as short as it is with the keyboard up. */
const nativeKeyboard: OpenStep = {root: 'body', open: async page => {
  await phoneTab(page, 'Box');
  await page.setViewportSize({width: 374, height: KEYBOARD_UP_HEIGHT});
  const field = page.locator('.mob-content .ui-field input[data-numinput]:visible').first();
  await field.click();
  await field.waitFor({state: 'visible'});
}};

export const BROWSER_OWNED_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [P, 'native-files', nativeFiles],
  [P, 'native-keyboard', nativeKeyboard],
];
