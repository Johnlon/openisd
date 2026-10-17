import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, setFocusedBoxType} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';
import {FIXTURE_DATE} from '../fixtures/sampleProject.js';

/**
 * Every screen the visual baselines cover. A screen is a name, a skin and the steps that bring it up;
 * its baseline is `baselines/<skin>-<name>.png`. A task that changes a screen on purpose updates that
 * screen's baseline in the same commit (docs/design/VISUAL_BASELINES.md).
 */

/** A skin and the window it is shot in. */
export class VisualSkin {
  static readonly MOBILE = new VisualSkin('mobile', {width: 390, height: 844});
  static readonly DESKTOP = new VisualSkin('desktop', {width: 1880, height: 1000});
  static readonly ALL: readonly VisualSkin[] = Object.freeze([VisualSkin.MOBILE, VisualSkin.DESKTOP]);
  private constructor(readonly name: string, readonly viewport: {width: number; height: number}) {}

  /** Opens the app in this skin, on its empty state, on FIXTURE_DATE (timers still run; only the date and time are fixed). */
  async start(page: Page): Promise<void> {
    await page.clock.setFixedTime(FIXTURE_DATE);
    await page.setViewportSize(this.viewport);
    if (this === VisualSkin.MOBILE) await forceMobileSkin(page);
    else await page.addInitScript(() => {
      localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true}}));
    });
    await page.goto('/');
  }

  /** Opens the sample project in this skin. */
  async openProject(page: Page): Promise<void> {
    if (this === VisualSkin.MOBILE) await openAMobileProject(page);
    else await openAProject(page);
    // The "Project imported" message floats over the screen for a few seconds, fading as it goes: a picture
    // taken while it shows holds it at whatever opacity the load gave it. The picture is of the screen.
    await expect(page.getByText(/Project imported/)).toBeHidden();
  }
}

export type BoxTypeName = 'sealed' | 'vented' | 'box-passive-radiator' | 'bandpass4' | 'bandpass6' | 'abc';
export const BOX_TYPES: readonly BoxTypeName[] = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'];

export interface Screen {
  /** Lower-case words and hyphens; the baseline file name after the skin. */
  readonly name: string;
  readonly skin: VisualSkin;
  /** Brings the screen up, from a fresh page. */
  open(page: Page): Promise<void>;
}

function screen(skin: VisualSkin, name: string, open: (page: Page) => Promise<void>): Screen {
  return {name, skin, open: async page => { await skin.start(page); await open(page); }};
}

const DESKTOP_TABS = ['Box', 'Driver', 'Signal', 'Filters', 'Advanced', 'Project'] as const;
const MOBILE_TABS = ['Box', 'Driver', 'Signal', 'Filters', 'Graph'] as const;

/** The wizard, advanced to `step` (1-5) with `type` chosen on step 3, in either skin. */
async function wizardAt(page: Page, skin: VisualSkin, type: BoxTypeName, step: number): Promise<void> {
  if (skin === VisualSkin.MOBILE) await page.getByText('New project').first().click();
  else await page.locator('.tb-btn[title*="New project"]').click();
  const root = skin === VisualSkin.MOBILE ? page.locator('.mob-np-body') : page.locator('.overlay.open .modal-body');
  await root.locator('.dlist .ditem').first().click();
  const footer = skin === VisualSkin.MOBILE ? page.locator('.mob-np-footer') : page.locator('.overlay.open .modal-footer');
  const next = footer.getByText('Next', {exact: true});
  await next.click();
  if (step >= 3) {
    await next.click();
    await page.locator('#np-box-type').selectOption(type);
  }
  for (let at = 4; at <= step; at++) await next.click();
}

function screens(): readonly Screen[] {
  const all: Screen[] = [];
  for (const skin of VisualSkin.ALL) {
    all.push(screen(skin, 'empty', async () => undefined));
    for (const type of BOX_TYPES) {
      const lastStep = type === 'sealed' || type === 'vented' ? 5 : 4;
      for (let step = 1; step <= lastStep; step++) {
        if (step <= 2 && type !== 'sealed') continue;
        all.push(screen(skin, `wizard-${type}-step${step}`, page => wizardAt(page, skin, type, step)));
      }
    }
  }
  for (const tab of DESKTOP_TABS) {
    all.push(screen(VisualSkin.DESKTOP, `tab-${tab.toLowerCase()}`, async page => {
      await VisualSkin.DESKTOP.openProject(page);
      await page.locator('.project-nav li', {hasText: tab}).click();
    }));
  }
  for (const tab of MOBILE_TABS) {
    all.push(screen(VisualSkin.MOBILE, `tab-${tab.toLowerCase()}`, async page => {
      await VisualSkin.MOBILE.openProject(page);
      await page.locator('.mob-tab', {hasText: tab}).click();
    }));
  }
  all.push(screen(VisualSkin.MOBILE, 'tab-enclosure', async page => {
    await VisualSkin.MOBILE.openProject(page);
    await setFocusedBoxType(page, 'vented');
    await page.locator('.mob-tab').nth(3).click();
  }));
  all.push(screen(VisualSkin.MOBILE, 'tab-advanced', async page => {
    await VisualSkin.MOBILE.openProject(page);
    await openMobileMenu(page);
    await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
  }));
  all.push(screen(VisualSkin.MOBILE, 'menu', async page => {
    await VisualSkin.MOBILE.openProject(page);
    await openMobileMenu(page);
  }));
  for (const type of BOX_TYPES) {
    all.push(screen(VisualSkin.DESKTOP, `box-${type}`, async page => {
      await VisualSkin.DESKTOP.openProject(page);
      await setFocusedBoxType(page, type);
    }));
  }
  return all;
}

export const SCREENS: readonly Screen[] = screens();
