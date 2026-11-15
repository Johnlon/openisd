import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, setFocusedBoxType} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';
import {FIXTURE_DATE} from '../fixtures/sampleProject.js';
import {COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {openTargets, WalkSkin} from '../fixtures/viewOpen.js';
import {BASE_SCREEN, CANNOT_BE_SHOWN, SAME_VIEW, WAITING_FOR_FIX} from './pictureSet.js';
import {ViewKind} from '../fixtures/viewIndex.js';

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

  /** Opens the app in this skin, on its empty state, with the clock started at FIXTURE_DATE and running.
   *  The clock runs, never stands still: Vue skips a handler attached at or after an event's Date.now() stamp,
   *  so with a frozen clock a parent's `@click.stop` never runs and a click meant for a menu reaches the
   *  document and closes it (the phone's Save As / Export menu never opened).
   *  `waitUntil` 'domcontentloaded' for a test that holds a font: the page's load event waits for fonts it uses. */
  async start(page: Page, waitUntil: 'load' | 'domcontentloaded' = 'load'): Promise<void> {
    await page.clock.install({time: FIXTURE_DATE});
    await page.clock.resume();
    await page.setViewportSize(this.viewport);
    // The browser answers "how much does this site use, of how much it allows" from the disk it runs on: the screen is
    // taken with a fixed answer, as the Drive stand-in gives Google's.
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'estimate', {configurable: true, value: async () => ({usage: 1_258_291, quota: 2_469_606_195})});
    });
    if (this === VisualSkin.MOBILE) await forceMobileSkin(page);
    else await page.addInitScript(() => {
      localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true}}));
    });
    await page.goto('/', {waitUntil});
  }

  /** Opens a project file in this skin; the sample project unless another is named. */
  async openProject(page: Page, file?: string): Promise<void> {
    if (this === VisualSkin.MOBILE) await openAMobileProject(page, file);
    else await openAProject(page, file);
    // The "Project imported" message floats over the screen for a few seconds, fading as it goes: a picture
    // taken while it shows holds it at whatever opacity the load gave it. The picture is of the screen.
    await expect(page.getByText(/Project imported/)).toBeHidden();
  }
}

export type BoxTypeName = 'sealed' | 'vented' | 'box-passive-radiator' | 'bandpass4' | 'bandpass6' | 'abc';
export const BOX_TYPES: readonly BoxTypeName[] = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'];

export type ScreenKind = 'page' | 'base' | 'popup';

export interface Screen {
  /** Lower-case words and hyphens; the baseline file name after the skin. */
  readonly name: string;
  /** `page`: a screen of the app itself (empty, wizard step, tab, box type); `base`: the project the popups open from; `popup`: a dialog, sheet, menu or note over it. */
  readonly kind: ScreenKind;
  readonly skin: VisualSkin;
  /** Brings the screen up, from a fresh page. */
  open(page: Page): Promise<void>;
  /** CSS selectors of parts the machine decides, masked in the picture (the build stamp is always masked). */
  readonly mask: readonly string[];
  /** The console errors the screen's own fault writes (a fault view); any other console error fails it. */
  readonly ownConsoleErrors: readonly RegExp[];
}

function screen(skin: VisualSkin, name: string, open: (page: Page) => Promise<void>, mask: readonly string[] = [],
  ownConsoleErrors: readonly RegExp[] = [], kind: ScreenKind = 'page'): Screen {
  return {name, kind, skin, mask, ownConsoleErrors, open: async page => { await skin.start(page); await open(page); }};
}

/**
 * Parts of a dialog the build decides, masked on every dialog screen (a selector that matches nothing masks nothing):
 * - the phone About's "Build · <date>" line: the build's own date, which differs with every build.
 * The storage quota line is not masked: `VisualSkin.start` fixes the browser's answer. The "saved in this browser at
 * http://localhost:<port>/" line is not masked: the suite and the re-take both serve on port 4300 (OPENISD_TEST_PORT).
 */
const MACHINE_DECIDED_PARTS: readonly string[] = ['[data-testid="about-version-line"]'];

const DESKTOP_TABS = ['Box', 'Driver', 'Signal', 'Filters', 'Advanced', 'Project'] as const;
const MOBILE_TABS = ['Box', 'Driver', 'Signal', 'Filters', 'Graph'] as const;

/** The wizard, advanced to `step` (1-5) with `type` chosen on step 3, in either skin. */
async function wizardAt(page: Page, skin: VisualSkin, type: BoxTypeName, step: number): Promise<void> {
  if (skin === VisualSkin.MOBILE) await page.getByText('New project').first().click();
  else await page.locator('.tb-btn[title*="New project"]').click();
  const root = skin === VisualSkin.MOBILE ? page.locator('.mob-np-body') : page.locator('.overlay.open .modal-body');
  // Step 1 is the driver list as the wizard opens it; from step 2 a driver is chosen and each Next moves one step on.
  if (step >= 2) await root.locator('.dlist .ditem').first().click();
  const footer = skin === VisualSkin.MOBILE ? page.locator('.mob-np-footer') : page.locator('.overlay.open .modal-footer');
  const next = footer.getByText(skin === VisualSkin.MOBILE ? 'Next ▸' : 'Next', {exact: true});
  if (step >= 2) await next.click();
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
    // The screen every popup opens from: a popup picture equal to it never opened (architecture/visual-baselines-distinct.test.ts).
    all.push(screen(skin, BASE_SCREEN, async page => { await skin.openProject(page, COMPLETE_DRIVER_PROJECT_OWPR); }, [], [], 'base'));
    for (const type of BOX_TYPES) {
      // Step 5 of a passive-radiator project needs a radiator chosen first, which this walk does not do.
      const lastStep = type === 'box-passive-radiator' ? 4 : 5;
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
    // The vents are on the Box page now: the screen is the page scrolled to its vent sections.
    await page.locator('.mob-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
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
  for (const {view, skin, plan} of openTargets()) {
    if (!POPUP_KINDS.has(view.kind)) continue;
    const visualSkin = skin === WalkSkin.Phone ? VisualSkin.MOBILE : VisualSkin.DESKTOP;
    const name = dialogName(view.id.replace(/^desktop\//, ''));
    // A view pictured under another name, or one a browser picture cannot show (pictureSet.ts), has no screen of its own.
    const key = `${visualSkin.name}-${name}`;
    if (SAME_VIEW.has(key) || CANNOT_BE_SHOWN.has(key) || WAITING_FOR_FIX.has(key)) continue;
    all.push(screen(visualSkin, name, async page => {
      // The flash views are the "Project imported" strip itself: the project is opened without waiting for the strip to go.
      if (FLASH_VIEWS.has(view.id)) {
        if (visualSkin === VisualSkin.MOBILE) await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
        else await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      } else await visualSkin.openProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await plan.open(page);
      const message = SCROLL_TO_MESSAGE.get(view.id);
      if (message !== undefined) await page.locator(message).first().scrollIntoViewIfNeeded();
      if (FLASH_VIEWS.has(view.id)) {
        const now = await page.evaluate(() => Date.now());
        await page.clock.pauseAt(now + 10);
        return;
      }
      // A step that imports a file leaves its "… imported" strip fading over the screen: the picture waits it out.
      await expect(page.locator(FADING_STRIP)).toHaveCount(0, {timeout: 15_000});
    }, [...MACHINE_DECIDED_PARTS, ...(VIEW_MASKS.get(view.id) ?? [])], plan.ownConsoleErrors, 'popup'));
  }
  return all;
}

/**
 * Every popup of the view index (fixtures/viewIndex.ts) in each skin it has an open step for
 * (fixtures/viewOpen.ts: the same real-UI steps the layout walk uses), each from the complete-driver project:
 * dialogs and each tab of a tabbed dialog, sheets, menus, help, field notes, warning and error popups, inline
 * expansions and the driver browsers. Pages, tabs and wizard steps are pictured above; a view with no open step
 * has its NoOpenReason there.
 */
const POPUP_KINDS: ReadonlySet<ViewKind> = new Set([
  ViewKind.Dialog, ViewKind.Sheet, ViewKind.Menu, ViewKind.Help, ViewKind.FieldNote, ViewKind.WarningPopup,
  ViewKind.ErrorPopup, ViewKind.InlineExpansion, ViewKind.Browser,
]);

/**
 * Popups with no stable picture, left out until the cause is fixed (bugs/BUG_20261115_visual-baselines-cover-no-dialogs.md).
 * The layout walk still opens and measures each of them.
 */
/** The strip that says what an action did and fades a few seconds later (desktop `.flash`, phone `flash-strip`). */
const FADING_STRIP = '.flash:visible, [data-testid="flash-strip"]:visible';

/**
 * Views whose message sits below the popup's first screen on the phone: the picture scrolls it into view, as a user does to read it.
 * (Not done in the open step: the layout walk measures the unscrolled popup, and a sticky header over scrolled rows would read as an overlap.)
 */
const SCROLL_TO_MESSAGE: ReadonlyMap<string, string> = new Map([
  ['phone/wizard-passive-radiator-pick-error', '.np-pr-error'],
  ['phone/tuning-unreachable-warning', '.mob-chint-warn'],
  ['shared/driver-editor-incomplete-warning', '.de-incomplete'],
  ['about-version', '.sp-versions'],
]);

/** A strip that goes by itself: `Logging.flash` shows it for 2 s on a JS timer, so the picture pauses the page's clock the moment it shows. */
const FLASH_VIEWS: ReadonlySet<string> = new Set(['shared/flash-message', 'phone/flash-strip']);

/**
 * Parts only some views have that belong to the build, masked there (not on every popup):
 * - the diagnostics fault report's stack: its first frames name the build's hashed bundle (`main-<hash>.js`), which changes with every build;
 * - the start-up failure's "A file of the app did not load: <address>", the same bundle's address;
 * - the About version section's heading and stamp: "OpenISD 7.0.952 · <date>" and the stamp are the running build's own.
 */
const VIEW_MASKS: ReadonlyMap<string, readonly string[]> = new Map([
  ['diagnostic-repairs', ['.dg-msg + pre.dg-stack']],
  ['desktop/diagnostic-repairs', ['.dg-msg + pre.dg-stack']],
  ['about-version', ['[data-testid="running-heading"]', '[data-testid="running-stamp"]']],
  ['startup-failure', ['#boot-failed .why']],
  ['desktop/startup-failure', ['#boot-failed .why']],
]);

/** A view id as a baseline name: `driver/editor/general` → `dialog-driver-editor-general`. */
function dialogName(id: string): string {
  return 'dialog-' + id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const SCREENS: readonly Screen[] = screens();

/**
 * The screens of the app itself, which the whole-screen contracts walk (`unit-label-underline`, `field-visual-contract`): they measure the page's own
 * field surface and, for the units, compare it with a frozen reference taken per screen (`approvedJoinedPaint.json`, never refreshed from the app under test).
 * A popup is not one: its page is only the backdrop, and its fields are measured by the view walk and `field-layout-rules`, which open every popup.
 */
export const PAGE_SCREENS: readonly Screen[] = SCREENS.filter(s => s.kind === 'page');
