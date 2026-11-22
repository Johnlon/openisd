import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, openAProject, openDriverEditor, setFocusedBoxType, test} from '../fixtures.js';
import type {BoxTypeName} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {auditScreen} from '../fixtures/screenSizeAudit.js';
import type {AuditMode} from '../fixtures/screenSizeAudit.js';
import {MAY_SCROLL_SIZES, MUST_FIT_SIZES} from '../fixtures/screenSizes.js';
import type {ScreenSize, SizeSkin} from '../fixtures/screenSizes.js';
import type {Page} from '@playwright/test';

/**
 * Screen sizes (docs/spec/SPEC_UI.md UI-5, sizes proposed in QO471). At each size in MUST_FIT_SIZES the
 * main screens show everything with no page scrollbar; at each size in MAY_SCROLL_SIZES they may scroll but
 * nothing overlaps, is cut, is out of reach or collapses to a strip. Screens are opened as a user does.
 */

const PROJECTS: readonly BoxTypeName[] = ['vented', 'box-passive-radiator'];

function modeFor(group: 'must-fit' | 'may-scroll', skin: SizeSkin): AuditMode {
  // A phone page scrolls down as a matter of course; a desktop page must not when it must fit.
  return group === 'may-scroll' ? {kind: 'may-scroll'} : {kind: 'must-fit', vertical: skin === 'desktop'};
}

async function audit(page: Page, label: string, mode: AuditMode): Promise<string[]> {
  return (await page.evaluate(auditScreen, mode)).map(fault => `${label}: ${fault}`);
}

async function startDesktop(page: Page, size: ScreenSize, box: BoxTypeName): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await setFocusedBoxType(page, box);
}

async function startPhone(page: Page, size: ScreenSize, box: BoxTypeName): Promise<void> {
  await page.setViewportSize(size);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
  await page.locator('#mob-box-type').selectOption(box);
}

/** The screens a size is walked through. */
type ScreenKind = BoxTypeName | 'options' | 'driver-editor';

/** A fault found by this gate and not yet fixed: its test expects the fault (test.fail) and turns red when the app is fixed; delete the entry then. */
interface KnownFault {readonly group: 'must-fit' | 'may-scroll'; readonly skin: SizeSkin; readonly size: string; readonly screens: readonly ScreenKind[]; readonly bug: string}
const KNOWN: readonly KnownFault[] = [
  {group: 'must-fit', skin: 'desktop', size: '1536x864 screen (dpr 1.25)', screens: ['options'], bug: 'BUG_20261108_desktop-options-dialog-taller-than-short-window'},
  {group: 'must-fit', skin: 'desktop', size: '1366x768 screen', screens: ['options'], bug: 'BUG_20261108_desktop-options-dialog-taller-than-short-window'},
  {group: 'may-scroll', skin: 'desktop', size: '800x600', screens: ['vented', 'box-passive-radiator'], bug: 'BUG_20261108_desktop-800x600-driver-tab-buttons-overlap-fields'},
  {group: 'may-scroll', skin: 'desktop', size: '800x600', screens: ['driver-editor'], bug: 'BUG_20261108_desktop-800x600-driver-editor-footer-overlaps-fields'},
  {group: 'may-scroll', skin: 'desktop', size: 'text zoom 200% (640x360 window)', screens: ['vented', 'box-passive-radiator', 'options', 'driver-editor'], bug: 'BUG_20261108_desktop-640x360-save-revert-cut-off-and-unreachable'},
];

/** How a user opens the Options dialog in each skin. */
const OPEN_OPTIONS: Readonly<Record<SizeSkin, (page: Page) => Promise<void>>> = {
  desktop: async page => {
    await page.locator('.tb-btn[title="Options"]').click();
    await page.locator('.opt-modal').waitFor();
  },
  phone: async page => {
    await page.locator('.mob-hamburger').click();
    await page.locator('.mob-menu-item', {hasText: 'Options'}).click();
    await page.locator('.mob-dlg[aria-label="Options"]').waitFor();
  },
};

/** How a user opens the Driver Editor in each skin. */
const OPEN_DRIVER_EDITOR: Readonly<Record<SizeSkin, (page: Page) => Promise<void>>> = {
  desktop: openDriverEditor,
  phone: async page => {
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    await page.getByText('Edit', {exact: true}).click();
    await page.locator('.de-body').waitFor();
  },
};

const TAB_SELECTOR: Readonly<Record<SizeSkin, string>> = {desktop: '.project-nav li', phone: '.mob-tab'};

const GROUPS = [
  {group: 'must-fit', sizes: MUST_FIT_SIZES},
  {group: 'may-scroll', sizes: MAY_SCROLL_SIZES},
] as const;

for (const {group, sizes} of GROUPS) {
  for (const skin of ['desktop', 'phone'] as const) {
    // A phone has a finger; a desktop window has a mouse, which keeps a short wide window on the desktop skin.
    test.describe(`${group} ${skin}`, () => {
    test.use({hasTouch: skin === 'phone'});
    for (const size of sizes[skin]) {
      const mode = modeFor(group, skin);
      /** A screen with a recorded fault expects it; the bug file is named in the title. */
      const known = (screen: ScreenKind): string => {
        const k = KNOWN.find(f => f.group === group && f.skin === skin && f.size === size.name && f.screens.includes(screen));
        return k === undefined ? '' : ` (${k.bug})`;
      };
      const expectFault = (screen: ScreenKind): void => { if (known(screen) !== '') test.fail(); };
      const start = (page: Page, box: BoxTypeName) => skin === 'desktop' ? startDesktop(page, size, box) : startPhone(page, size, box);

      for (const box of PROJECTS) {
        test(`${group} ${skin} ${size.name}: ${box} project, every tab${known(box)}`, async ({page}) => {
          expectFault(box);
          await start(page, box);
          const tabs = page.locator(TAB_SELECTOR[skin]);
          const names = (await tabs.allInnerTexts()).map(t => t.trim()).filter(t => t !== '');
          const faults: string[] = [];
          for (const name of names) {
            await tabs.filter({hasText: new RegExp(`^${name}$`)}).click();
            faults.push(...await audit(page, name, mode));
          }
          expect(faults).toEqual([]);
        });
      }

      test(`${group} ${skin} ${size.name}: Options dialog${known('options')}`, async ({page}) => {
        expectFault('options');
        await start(page, 'vented');
        await OPEN_OPTIONS[skin](page);
        expect(await audit(page, 'Options', mode)).toEqual([]);
      });

      test(`${group} ${skin} ${size.name}: Driver Editor${known('driver-editor')}`, async ({page}) => {
        expectFault('driver-editor');
        await start(page, 'vented');
        await OPEN_DRIVER_EDITOR[skin](page);
        expect(await audit(page, 'Driver Editor', mode)).toEqual([]);
      });
    }
    });
  }
}
