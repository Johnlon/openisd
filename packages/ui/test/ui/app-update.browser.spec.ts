/**
 * A new build reaches an open app (T243). The suite's build has no service worker, so a scripted host
 * stands in: a waiting build is delivered and the app is brought back into view.
 *  - nothing unsaved: the app switches by itself and reloads;
 *  - unsaved edits: "New version available" with Reload / Not now, in both skins; a reload keeps the edits,
 *    still unsaved, and asks only for what it really loses (the store refused the session, an open driver editor);
 *  - About: Force refresh with the running build beside it and the note; one press reloads, projects stay.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Page} from '@playwright/test';
import {dirtyFocusedDesign, expect, focusedIsModified, openAMobileProject, openAProject, openDriverEditor, openTab, setFocusedBoxVolume, shownBoxVolume, shownProjectName, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {deliverWaitingBuild, refuseSessionWrites} from '../fixtures/updateHost.js';

const BUILD_INFO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'build-info.json');

/** The suite build's stamp, as scripts/version-info.mjs wrote it before the build ("v20261016T2241Z" → "20261016T2241Z"). */
function runningStamp(): string {
  const parsed: unknown = JSON.parse(readFileSync(BUILD_INFO, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || typeof parsed.version !== 'string') {
    throw new Error(`build-info.json has no string "version": ${JSON.stringify(parsed)}`);
  }
  return parsed.version.replace(/^v/, '');
}

/** Opens the driver editor and types a new Fs into it, without pressing OK. */
async function editDriverFs(page: Page, phone: boolean, fs: string): Promise<void> {
  if (phone) {
    await openTab(page, 'Driver');
    await page.getByText('Edit', {exact: true}).click();
    await page.locator('.de-body').waitFor({state: 'visible'});
  } else {
    await openDriverEditor(page);
  }
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
  await fillAndBlur(page.locator('.de-body .de-fld', {has: page.locator('label:text-is("Fs")')}).first().locator('input').first(), fs);
}

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

    // T829, John 2026-11-15: "pulling a new version says you lose unsaved but that's not true". Every edit is
    // written to the stored open-project session as it is made, so a reload brings it back, still unsaved.
    // The question that said otherwise is gone; it is asked only for what a reload really loses (below).
    test('unsaved edits: Reload reloads at once without a question, and the edit is back, still unsaved', async ({page}) => {
      await skin.open(page);
      await dirtyFocusedDesign(page);
      await deliverWaitingBuild(page);
      const reloaded = page.waitForEvent('load');
      await page.getByTestId('update-reload').click();
      await reloaded;
      await page.locator(skin.ready).waitFor({state: 'visible'});
      await expect(page.locator('.confirm-modal')).toHaveCount(0);
      expect(await shownBoxVolume(page)).toBeCloseTo(55.5, 3);
      expect(await focusedIsModified(page)).toBe(true);
    });

    test('unsaved edits: Force refresh reloads at once without a question, and the edit is back, still unsaved', async ({page}) => {
      await skin.open(page);
      await dirtyFocusedDesign(page);
      await skin.openAbout(page);
      const reloaded = page.waitForEvent('load');
      await page.getByTestId('force-refresh').click();
      await reloaded;
      await page.locator(skin.ready).waitFor({state: 'visible'});
      await expect(page.locator('.confirm-modal')).toHaveCount(0);
      expect(await shownBoxVolume(page)).toBeCloseTo(55.5, 3);
      expect(await focusedIsModified(page)).toBe(true);
    });

    test('the store refuses the session: Reload asks, says the changes were not kept, Keep does nothing, Reload loses them', async ({page}) => {
      await skin.open(page);
      await setFocusedBoxVolume(page, 0.0333);
      await refuseSessionWrites(page);
      await setFocusedBoxVolume(page, 0.0888);
      await deliverWaitingBuild(page);
      await page.getByTestId('update-reload').click();
      const ask = page.locator('.confirm-modal').filter({hasText: 'Discard changes?'});
      await expect(ask).toContainText("Some of your unsaved changes could not be kept in this browser's storage, so reloading loses them.");
      await ask.getByRole('button', {name: 'Keep'}).click();
      await expect(page.getByTestId('update-strip')).toBeVisible();
      await page.getByTestId('update-reload').click();
      const reloaded = page.waitForEvent('load');
      await ask.getByRole('button', {name: 'Reload'}).click();
      await reloaded;
      await page.locator(skin.ready).waitFor({state: 'visible'});
      // The store held the first edit and refused the second.
      expect(await shownBoxVolume(page)).toBeCloseTo(33.3, 3);
    });

    test('a driver editor with values not applied: a waiting build is offered, not switched to unasked, and asks nothing once the editor is closed', async ({page}) => {
      await skin.open(page);
      await editDriverFs(page, skin.name === 'mobile', '33');
      let reloadedUnasked = false;
      page.once('load', () => { reloadedUnasked = true; });
      await deliverWaitingBuild(page);
      await expect(page.getByTestId('update-strip')).toBeVisible();
      expect(reloadedUnasked).toBe(false);
      await page.locator('.de-footer button', {hasText: 'Cancel'}).click();
      await page.locator('.de-body').waitFor({state: 'hidden'});
      const reloaded = page.waitForEvent('load');
      await page.getByTestId('update-reload').click();
      await reloaded;
      await expect(page.locator('.confirm-modal')).toHaveCount(0);
    });

    test('About: Force refresh with its note, one press reloads and the projects stay', async ({page}) => {
      await skin.open(page);
      const name = await shownProjectName(page);
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
      expect(await shownProjectName(page)).toBe(name);
    });

    // John, 16 Oct 2026: "I never asked for the about to show a list of releases, I asked for a force latest".
    test('About on a release build shows its number and stamp and Force refresh, and no list of builds', async ({page}) => {
      const stamp = runningStamp();
      // The hosted list names this build as release 7.0.952, beside an older release and a snapshot.
      await page.route('**/v/index.json', route => route.fulfill({json: [
        {stamp, kind: 'release', tag: `v${stamp}`, version: '7.0.952', url: 'https://example.test/r', published: stamp, subject: 'x', latest: true},
        {stamp: '20260101T0102Z', kind: 'release', tag: 'v20260101T0102Z', version: '7.0.900', url: 'https://example.test/o', published: '20260101T0102Z', subject: 'x', latest: false},
        {stamp: '20260102T0102Z', kind: 'snap', tag: 'snap-20260102T0102Z', version: '', url: 'https://example.test/s', published: '20260102T0102Z', subject: 'x', latest: false},
      ]}));
      await skin.open(page);
      await skin.openAbout(page);
      const about = page.locator('.sp-versions');
      await expect(page.getByTestId('running-heading')).toContainText('7.0.952');
      await expect(page.getByTestId('running-stamp')).toHaveText(stamp);
      await expect(page.getByTestId('force-refresh')).toBeVisible();
      await expect(about.locator('li, a')).toHaveCount(0);
      await expect(about).not.toContainText('7.0.900');
      await expect(about).not.toContainText(/Snapshot|All releases/);
    });
  });
}

test.describe('original skin: a What-if is an experiment a reload does not keep', () => {
  test('a waiting build is offered, and Reload says the What-if values are lost; Keep leaves them', async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
    await page.locator('.edit-btn', {hasText: 'What-if'}).click();
    const fs = page.locator('.what-if-panel .what-if-fld').filter({has: page.locator('label', {hasText: /^Fs$/})}).locator('input').first();
    await fillAndBlur(fs, '77');
    await deliverWaitingBuild(page);
    await page.getByTestId('update-reload').click();
    const ask = page.locator('.confirm-modal').filter({hasText: 'Discard changes?'});
    await expect(ask).toContainText('The values you are trying in What-if are only an experiment, so reloading loses them.');
    await ask.getByRole('button', {name: 'Keep'}).click();
    await expect(fs).toHaveValue('77.00');
  });
});
