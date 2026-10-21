/**
 * The phone's app dialogs, built to their accepted mocks (PHONE_CLASSIC_BUILD_SPEC rows 20-24, 30, 37, 38):
 * Options (three tabs), About (version line and change log), Cloud sync, Differences (folding cards),
 * Diagnostics, the cloud sync badge, the storage and backups lists and the store gate. Every dialog is
 * measured at every phone size: nothing is cut, nothing scrolls sideways, the buttons stay on screen.
 * Flash / toast (row 33) is not here: it needs App.vue and MobileShell.vue, which this task may not touch.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Locator, Page} from '@playwright/test';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES, PIXEL_9} from '../fixtures/phoneSizes.js';
import {enableCloudSync, stubGoogleApis} from './fixtures/cloudSyncStubs.js';

const ROW_PX = 40;
const BAND_PX = 28;
const HEADER_PX = 48;
const TAB_PX = 40;
const FOOTER_BUTTON_PX = 44;
const TOL = 0.5;
const BUILD_INFO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'build-info.json');

function runningStamp(): string {
  const parsed: unknown = JSON.parse(readFileSync(BUILD_INFO, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || typeof parsed.version !== 'string') {
    throw new Error(`build-info.json has no string "version": ${JSON.stringify(parsed)}`);
  }
  return parsed.version.replace(/^v/, '');
}

async function startOnPhone(page: Page, size: {width: number; height: number}): Promise<void> {
  await page.setViewportSize(size);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
}

/** The dialog fills the screen and nothing in it is cut, wider than the screen, or off its bottom. */
async function expectFits(page: Page, dialog: Locator): Promise<void> {
  const report = await dialog.evaluate((root: HTMLElement) => {
    const view = {w: window.innerWidth, h: window.innerHeight};
    const box = root.getBoundingClientRect();
    const footer = root.querySelector<HTMLElement>('.mob-dlg-footer')?.getBoundingClientRect();
    const controls = [...root.querySelectorAll<HTMLElement>('label, input, button, select')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
    return {
      view,
      box: {left: box.left, top: box.top, right: box.right, bottom: box.bottom},
      footerBottom: footer?.bottom ?? NaN,
      pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cut: controls.filter(e => e.scrollWidth > e.clientWidth + 1 && e.tagName !== 'INPUT').map(e => `${e.tagName}:${(e.textContent ?? '').trim().slice(0, 30)}`),
      sideways: controls.filter(e => { const r = e.getBoundingClientRect(); return r.left < -0.5 || r.right > view.w + 0.5; })
        .map(e => `${e.tagName}:${e.getAttribute('aria-label') ?? (e.textContent ?? '').trim().slice(0, 30)}`),
      bodyScrollsSideways: (root.querySelector<HTMLElement>('.mob-dlg-body')?.scrollWidth ?? 0) > (root.querySelector<HTMLElement>('.mob-dlg-body')?.clientWidth ?? 0) + 1,
    };
  });
  expect(report.box.left, 'dialog left edge').toBeLessThanOrEqual(TOL);
  expect(report.box.right, 'dialog right edge').toBeGreaterThanOrEqual(report.view.w - TOL);
  expect(report.box.bottom, 'dialog bottom').toBeGreaterThanOrEqual(report.view.h - TOL);
  expect(report.footerBottom, 'footer buttons stay on screen').toBeLessThanOrEqual(report.view.h + TOL);
  expect(report.pageScrolls, 'no horizontal page scroll').toBe(false);
  expect(report.bodyScrollsSideways, 'dialog body does not scroll sideways').toBe(false);
  expect(report.cut, 'no label or button is cut').toEqual([]);
  expect(report.sideways, 'no control outside the screen sideways').toEqual([]);
}

async function heights(loc: Locator): Promise<number[]> {
  return loc.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
}

/** Every value box in the dialog's field rows starts at one x, its text a 14 px gutter in, its chip inside it. */
async function expectValueBoxesAligned(dialog: Locator): Promise<void> {
  const rows = dialog.locator('.mob-ui-field');
  expect(await rows.count(), 'the page has field rows').toBeGreaterThan(0);
  for (const h of await heights(rows)) expect(Math.abs(h - ROW_PX), `row height ${h}`).toBeLessThanOrEqual(TOL);
  const boxes = await rows.evaluateAll(els => els.flatMap(row => {
    const input = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value .mob-readonly');
    if (!input) return [];
    const box = input.getBoundingClientRect();
    const chip = row.querySelector<HTMLElement>('.ui-field-unit')?.getBoundingClientRect();
    return [{left: box.left, gutter: parseFloat(getComputedStyle(input).paddingLeft), chipInside: chip === undefined || chip.width === 0 || (chip.left >= box.left && chip.right <= box.right + 0.5)}];
  }));
  for (const b of boxes) {
    expect(Math.abs(b.left - boxes[0].left), 'value boxes share one left edge').toBeLessThanOrEqual(TOL);
    expect(b.gutter, 'text gutter').toBe(14);
    expect(b.chipInside, 'unit chip inside its box').toBe(true);
  }
}

async function expectBands(dialog: Locator, titles: readonly string[]): Promise<void> {
  const bands = dialog.locator('.mob-band');
  await expect(bands.locator('.mob-band-title')).toHaveText([...titles]);
  for (const h of await heights(bands)) expect(Math.abs(h - BAND_PX), `band height ${h}`).toBeLessThanOrEqual(TOL);
  await expect(bands.locator('.mob-band-help')).toHaveCount(titles.length);
}

async function expectFooter(dialog: Locator, buttons: readonly string[]): Promise<void> {
  const footer = dialog.locator('.mob-dlg-footer button');
  await expect(footer).toHaveText([...buttons]);
  for (const h of await heights(footer)) expect(Math.abs(h - FOOTER_BUTTON_PX), `footer button height ${h}`).toBeLessThanOrEqual(TOL);
}

async function expectHeader(dialog: Locator, title: string): Promise<void> {
  await expect(dialog.locator('.mob-dlg-title')).toHaveText(title);
  const [h] = await heights(dialog.locator('.mob-dlg-head'));
  expect(Math.abs(h - HEADER_PX), `header height ${h}`).toBeLessThanOrEqual(TOL);
  await expect(dialog.locator('.mob-dlg-close')).toBeVisible();
}

for (const size of PHONE_SIZES) {
  test.describe(`B11 Options at ${size.width}×${size.height}`, () => {
    test.beforeEach(async ({page}) => {
      await startOnPhone(page, size);
      await tapMobileMenuItem(page, 'Options');
    });

    test('General: header, three tabs, five bands, classic rows, Defaults / OK / Cancel', async ({page}) => {
      const dialog = page.locator('.mob-dlg[aria-label="Options"]');
      await expect(dialog).toBeVisible();
      await expectHeader(dialog, 'Options');

      const tabs = dialog.locator('.opt-phone-tabs button');
      await expect(tabs).toHaveText(['General', 'Plot Window', 'Your data']);
      const tabBoxes = await tabs.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return {w: r.width, h: r.height}; }));
      for (const t of tabBoxes) {
        expect(Math.abs(t.h - TAB_PX), 'tab height').toBeLessThanOrEqual(TOL);
        expect(Math.abs(t.w - tabBoxes[0].w), 'tabs are equal').toBeLessThanOrEqual(1);
      }

      await expectBands(dialog, ['User', 'Environment', 'Vented design limits', 'WinISD differences', 'Units']);
      for (const label of ['Username', 'Temperature', 'Relative humidity', 'Air pressure', 'Sound velocity', 'Air density', 'Min box volume', 'Min tuning', 'Max box volume', 'Max tuning']) {
        await expect(dialog.locator('label', {hasText: label}).first(), label).toBeVisible();
      }
      await dialog.locator('.mob-dlg-body').evaluate(el => { el.scrollTop = 0; });
      await expectValueBoxesAligned(dialog);
      await expect(dialog.getByText('Show WinISD difference markers (≠W)')).toBeAttached();
      await expect(dialog.getByRole('button', {name: 'Reset to Metric (l, mm, …)'})).toBeAttached();
      await expectFooter(dialog, ['Defaults', 'OK', 'Cancel']);
      await expectFits(page, dialog);
    });

    test('General: the ? on Environment explains the section and every row in plain words', async ({page}) => {
      const dialog = page.locator('.mob-dlg[aria-label="Options"]');
      await dialog.locator('.mob-band', {hasText: 'Environment'}).locator('.mob-band-help').click();
      const sheet = page.locator('.mob-help-sheet');
      await expect(sheet).toContainText('The defaults (20 °C, 30 %, sea level) suit most rooms.');
      await expect(sheet).toContainText('Temperature: the air temperature in kelvin (K).');
      await expect(sheet).toContainText('Air density: how heavy this air is.');
    });

    test('Plot Window: the full colour list of nine, then twelve limit rows, each with its reset', async ({page}) => {
      const dialog = page.locator('.mob-dlg[aria-label="Options"]');
      await dialog.locator('.opt-phone-tabs button', {hasText: 'Plot Window'}).click();
      await expectBands(dialog, ['Colors', 'Limits']);
      const colourLabels = ['0 dB line', '-3dB line', 'Background', 'Other lines', 'Labels', 'Xmax limit', 'Cursor lines', 'Air speed limit', 'Selected range'];
      await expect(dialog.locator('.mob-dcolor-row .mob-crow-label')).toHaveText(colourLabels);
      await expect(dialog.locator('.mob-dcolor-row input[type=color]')).toHaveCount(9);
      await expect(dialog.locator('.mob-dcolor-row .mob-dreset')).toHaveCount(9);
      for (const h of await heights(dialog.locator('.mob-dcolor-row'))) expect(Math.abs(h - ROW_PX), 'colour row height').toBeLessThanOrEqual(TOL);
      await expect(dialog.locator('.mob-dlim')).toHaveCount(12);
      await expect(dialog.locator('.mob-dlim .mob-crow-label').first()).toHaveText('Frequency range');
      for (const row of await dialog.locator('.mob-dlim').all()) {
        await expect(row.locator('input[type=number]')).toHaveCount(2);
        await expect(row.locator('.mob-dreset')).toHaveCount(1);
      }
      await expect(dialog.locator('.mob-dlim').nth(4)).toContainText('SPL');
      await expectFooter(dialog, ['Defaults', 'OK', 'Cancel']);
      await dialog.locator('.mob-dlg-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expectFits(page, dialog);
    });

    test('Your data: Storage, Backups and Export / Import bands, and the two import choices in John\'s words', async ({page}) => {
      const dialog = page.locator('.mob-dlg[aria-label="Options"]');
      await dialog.locator('.opt-phone-tabs button', {hasText: 'Your data'}).click();
      await expectBands(dialog, ['Storage', 'Backups', 'Export / Import']);
      await expect(dialog.getByText('When importing:')).toBeVisible();
      const add = dialog.locator('label.mob-dcheck', {hasText: "Add the settings in the file to the app's state"});
      const replace = dialog.locator('label.mob-dcheck', {hasText: 'Replace all'});
      await expect(add).toBeVisible();
      await expect(replace).toBeVisible();
      await expect(dialog.getByText("Any settings in the imported file will be added to the app's settings, so this is an update & append operation.")).toBeVisible();
      await expect(dialog.getByText("The imported file completely replaces the app's settings. A backup is made first.")).toBeVisible();
      await expect(dialog.getByText('Remove what the file does not hold')).toHaveCount(0);
      await expect(add.locator('input')).toBeChecked();
      await replace.locator('input').check();
      await expect(replace.locator('input')).toBeChecked();
      await expect(add.locator('input')).not.toBeChecked();
      await dialog.locator('.mob-dlg-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expectFits(page, dialog);
    });

    test('Your data: a backup is a card with its four buttons, all inside the screen', async ({page}) => {
      const dialog = page.locator('.mob-dlg[aria-label="Options"]');
      await dialog.locator('.opt-phone-tabs button', {hasText: 'Your data'}).click();
      await dialog.locator('.sh-backup-now').click();
      const card = dialog.locator('.sh-row').first();
      await expect(card).toBeVisible();
      await expect(card.locator('.sh-actions button')).toHaveText(['Restore everything', 'Restore one project', 'Export', 'Delete']);
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + TOL);
      await expect(dialog.locator('.sh-total')).toContainText('Total');
      await expectFits(page, dialog);
    });
  });
}

test('Options: the colours, the username and the import choice are kept by OK and dropped by Cancel', async ({page}) => {
  await startOnPhone(page, PIXEL_9);
  await tapMobileMenuItem(page, 'Options');
  const dialog = page.locator('.mob-dlg[aria-label="Options"]');
  await dialog.locator('#opt-phone-username').fill('Zed');
  await dialog.locator('.opt-phone-tabs button', {hasText: 'Plot Window'}).click();
  await dialog.locator('#opt-phone-color-airSpeedLimit').fill('#112233');
  await dialog.locator('#opt-phone-color-selectedRange').fill('#445566');
  await dialog.getByRole('button', {name: 'OK'}).click();
  await expect(dialog).toHaveCount(0);

  await tapMobileMenuItem(page, 'Options');
  await expect(dialog.locator('#opt-phone-username')).toHaveValue('Zed');
  await dialog.locator('.opt-phone-tabs button', {hasText: 'Plot Window'}).click();
  await expect(dialog.locator('#opt-phone-color-airSpeedLimit')).toHaveValue('#112233');
  await expect(dialog.locator('#opt-phone-color-selectedRange')).toHaveValue('#445566');
  await dialog.getByRole('button', {name: 'Reset Air speed limit'}).click();
  await expect(dialog.locator('#opt-phone-color-airSpeedLimit')).toHaveValue('#d2691e');
  await dialog.getByRole('button', {name: 'Cancel'}).click();
  await expect(dialog).toHaveCount(0);

  await tapMobileMenuItem(page, 'Options');
  await dialog.locator('.opt-phone-tabs button', {hasText: 'Plot Window'}).click();
  await expect(dialog.locator('#opt-phone-color-airSpeedLimit')).toHaveValue('#112233');
});

test('Options: a bad frequency range shows its reason under the tabs and holds OK back', async ({page}) => {
  await startOnPhone(page, PIXEL_9);
  await tapMobileMenuItem(page, 'Options');
  const dialog = page.locator('.mob-dlg[aria-label="Options"]');
  await dialog.locator('.opt-phone-tabs button', {hasText: 'Plot Window'}).click();
  await dialog.locator('#opt-phone-lim-fmin').fill('30000');
  await dialog.locator('#opt-phone-lim-fmin').blur();
  await expect(dialog.getByTestId('settings-error')).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'OK'})).toBeDisabled();
});

for (const size of PHONE_SIZES) {
  test.describe(`B11 About at ${size.width}×${size.height}`, () => {
    test('the version, its day and the change log lead the page, ahead of the first heading', async ({page}) => {
      const stamp = runningStamp();
      await page.route('**/v/index.json', route => route.fulfill({json: [
        {stamp, kind: 'release', tag: `v${stamp}`, version: '7.0.952', url: 'https://example.test/r', published: stamp, subject: 'x', latest: true},
      ]}));
      await startOnPhone(page, size);
      await tapMobileMenuItem(page, 'About OpenISD');
      const line = page.getByTestId('about-version-line');
      await expect(line).toBeVisible();
      await expect(line).toContainText('Version 7.0.952 ·');
      const link = line.getByRole('link', {name: 'Change log'});
      await expect(link).toHaveAttribute('href', 'https://github.com/Johnlon/openisd/releases');
      await expect(link).toHaveAttribute('target', '_blank');
      const order = await page.evaluate(() => {
        const v = document.querySelector('[data-testid="about-version-line"]')?.getBoundingClientRect();
        const h = document.querySelector('.sp #sp-title, .sp h2')?.getBoundingClientRect();
        return v && h ? h.top - v.top : NaN;
      });
      expect(order, 'the version line sits above the headline').toBeGreaterThan(0);
      const about = await page.locator('.sp').boundingBox();
      expect(about!.width).toBeGreaterThanOrEqual(size.width - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    });
  });
}

for (const size of PHONE_SIZES) {
  test.describe(`B11 Differences at ${size.width}×${size.height}`, () => {
    test('three bands with ?, cards that fold, the bug cards marked, a Close button', async ({page}) => {
      await startOnPhone(page, size);
      await tapMobileMenuItem(page, 'OpenISD and WinISD differences');
      const dialog = page.locator('.mob-dlg[aria-label="OpenISD and WinISD differences"]');
      await expect(dialog).toBeVisible();
      await expectHeader(dialog, 'OpenISD and WinISD differences');
      await expectBands(dialog, ['WinISD bugs you can switch back on', "Options: WinISD's way or alternative", 'WinISD bugs OpenISD fixes (no switch)']);
      await expect(dialog.getByText('Tap one to read it.')).toBeVisible();

      const first = dialog.locator('.mob-dcard').first();
      const head = first.locator('.mob-dcard-head');
      await expect(head).toHaveAttribute('aria-expanded', 'false');
      await expect(first.locator('.mob-dcard-body')).toHaveCount(0);
      await expect(first).toHaveClass(/bug/);
      await expect(head.locator('small')).toContainText('Switch:');
      await head.click();
      await expect(head).toHaveAttribute('aria-expanded', 'true');
      await expect(first.locator('.mob-dcard-body dt')).toHaveText(['WinISD', 'OpenISD', 'Seen in', 'Size']);
      await head.click();
      await expect(first.locator('.mob-dcard-body')).toHaveCount(0);

      await expectFooter(dialog, ['Close']);
      await expectFits(page, dialog);
      await dialog.getByRole('button', {name: 'Close'}).last().click();
      await expect(dialog).toHaveCount(0);
    });
  });
}

for (const size of PHONE_SIZES) {
  test.describe(`B11 Diagnostics at ${size.width}×${size.height}`, () => {
    test('the nothing-to-report hint, Cloud sync and Browser storage bands, Copy / Reload / Dismiss', async ({page}) => {
      await startOnPhone(page, size);
      await tapMobileMenuItem(page, 'Diagnostics');
      const dialog = page.locator('.mob-dlg[aria-label="Diagnostics"]');
      await expect(dialog).toBeVisible();
      await expectHeader(dialog, 'Diagnostics');
      await expect(dialog.getByText('Nothing to report.', {exact: false})).toBeVisible();
      await expectBands(dialog, ['Cloud sync', 'Browser storage']);
      await expect(dialog.locator('.mob-dpre')).toHaveCount(2);
      await expect(dialog.locator('.mob-dpre').nth(0)).toContainText('Cloud sync:');
      await expect(dialog.locator('.mob-dpre').nth(1)).toContainText('Persistent storage');
      await expectFooter(dialog, ['Copy diagnostics', 'Reload', 'Dismiss']);
      await expectFits(page, dialog);
      await dialog.getByRole('button', {name: 'Dismiss'}).click();
      await expect(dialog).toHaveCount(0);
    });
  });
}

for (const size of PHONE_SIZES) {
  test.describe(`B11 Cloud sync at ${size.width}×${size.height}`, () => {
    test.beforeEach(async ({page}) => {
      await enableCloudSync(page);
      await stubGoogleApis(page);
    });

    test('the badge is a 40 px target with a 24 px glyph; the dialog has the Google Drive band, the state, the privacy words and one button', async ({page}) => {
      await startOnPhone(page, size);
      const badge = page.locator('.mob-header-sync');
      await expect(badge).toBeVisible();
      const b = (await badge.boundingBox())!;
      expect(Math.abs(b.width - 40)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(b.height - 40)).toBeLessThanOrEqual(TOL);
      const glyph = (await badge.locator('svg').first().boundingBox())!;
      expect(Math.max(glyph.width, glyph.height)).toBeGreaterThanOrEqual(23.5);
      expect(Math.max(glyph.width, glyph.height)).toBeLessThanOrEqual(24.5);

      await badge.click();
      const dialog = page.locator('.mob-dlg', {has: page.locator('.cloud-sync-dialog')});
      await expect(dialog).toBeVisible();
      await expectHeader(dialog, 'Cloud sync');
      await expectBands(dialog, ['Google Drive']);
      await expect(dialog.locator('.cloud-sync-headline')).toContainText('Cloud sync is off');
      await expect(dialog.locator('.cloud-sync-explainer')).toContainText('hidden folder in your own Google Drive');
      await expect(dialog.getByRole('link', {name: 'Privacy'})).toBeVisible();
      await expect(dialog.locator('.cloud-sync-buttons button')).toHaveText(['Connect Google Drive']);
      const [button] = await heights(dialog.locator('.cloud-sync-buttons button'));
      expect(button, 'button is a finger tall').toBeGreaterThanOrEqual(40);
      await expectFooter(dialog, ['Close']);
      await expectFits(page, dialog);
    });
  });
}

for (const size of PHONE_SIZES) {
  test.describe(`B11 Store gate at ${size.width}×${size.height}`, () => {
    test('a newer store shows the phone gate: brand line, title, a card per backup, Export everything full width at the foot', async ({page}) => {
      // A normal start and a backup first, so the gate has a backup to list; then a second tab opens with the store marked newer.
      await startOnPhone(page, size);
      await tapMobileMenuItem(page, 'Options');
      const dialog = page.locator('.mob-dlg[aria-label="Options"]');
      await dialog.locator('.opt-phone-tabs button', {hasText: 'Your data'}).click();
      await dialog.locator('.sh-backup-now').click();
      await expect(dialog.locator('.sh-row').first()).toBeVisible();
      const layoutBefore = await page.evaluate(() => localStorage.getItem('openisd_storage_layout'));
      await page.evaluate(() => { localStorage.setItem('openisd_storage_layout', '99'); });

      const gatePage = await page.context().newPage();
      await gatePage.setViewportSize(size);
      await gatePage.goto('/');
      const gate = gatePage.getByTestId('store-gate');
      await expect(gate).toBeVisible();
      await expect(gate.locator('.store-gate-brand')).toHaveText('OpenISD Storage');
      await expect(gate.locator('h1')).toHaveText('This browser holds data from a newer OpenISD');
      const fontPx = await gate.locator('h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(fontPx).toBe(19);

      const exportButton = gate.getByRole('button', {name: 'Export everything'});
      const box = (await exportButton.boundingBox())!;
      expect(Math.abs(box.height - 44)).toBeLessThanOrEqual(TOL);
      expect(box.width, 'the button runs the width of the page').toBeGreaterThanOrEqual(size.width - 32 - TOL);
      expect(box.y + box.height, 'the button sits at the foot of the screen').toBeGreaterThanOrEqual(size.height - 40);

      const cards = gate.locator('.store-gate-backups li');
      const report = await cards.evaluateAll(els => els.map(e => {
        const r = e.getBoundingClientRect();
        const names = [...e.querySelectorAll('button')].map(x => x.textContent?.trim());
        return {x: r.x, right: r.right, restore: names.includes('Restore'), readOnly: names.includes('Open read-only')};
      }));
      expect(report.filter(c => c.x < 0 || c.right > size.width + TOL || !c.restore || !c.readOnly), 'every backup card fits and has both buttons').toEqual([]);
      expect(await gatePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await page.evaluate((before: string | null) => {
        if (before === null) localStorage.removeItem('openisd_storage_layout'); else localStorage.setItem('openisd_storage_layout', before);
      }, layoutBefore);
      await gatePage.close();
    });
  });
}
