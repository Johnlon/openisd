import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES, PIXEL_9} from '../fixtures/phoneSizes.js';
import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';

/**
 * The classic phone rows (PHONE_CLASSIC_BUILD_SPEC §3): on Box (each box type), Driver and Signal,
 * at every phone size, every field row is the CLASSIC depth, value boxes share one left edge with
 * the text gutter inside, chips sit inside their box, nothing is cut or scrolls sideways, the key
 * strip sits under the header, and section bands are 28 px with a ? at the right.
 * Driver editor tabs join when B6 lands; the New project wizard (B12, screen 25) is measured at the end of this file.
 */
const ROW_PX = PhoneRowSizes.CLASSIC.rowMinPx;
const GUTTER_PX = PhoneRowColumns.STANDARD.textGutterPx;
const BAND_PX = 28;
const TOL = 0.5;

/** With CLASSIC_SHOTS_DIR set, the Pixel 9 run saves the page's pictures there (for the before and after sets). */
async function photograph(page: Page, width: number, name: string): Promise<void> {
  const dir = process.env.CLASSIC_SHOTS_DIR;
  if (dir === undefined || width !== PIXEL_9.width) return;
  const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await page.screenshot({path: `${dir}/${file}-top.png`});
  await page.locator('.mob-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.screenshot({path: `${dir}/${file}-bottom.png`});
  await page.locator('.mob-content').evaluate(el => { el.scrollTop = 0; });
  const enclosure = page.locator('.mob-tab', {hasText: /Vented|Passive Radiator|Bandpass|ABC/}).first();
  if (await enclosure.count() > 0) { await enclosure.click(); await page.screenshot({path: `${dir}/${file}-enclosure.png`}); }
}

const PAGES: readonly {readonly name: string; readonly open: (page: Page) => Promise<void>}[] = [
  ...['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'].map(type => ({
    name: `Box ${type}`,
    open: async (page: Page) => {
      await page.locator('.mob-tab', {hasText: 'Box'}).first().click();
      await page.locator('#mob-box-type').selectOption(type);
    },
  })),
  {name: 'Driver', open: async page => { await page.locator('.mob-tab', {hasText: 'Driver'}).first().click(); }},
  {name: 'Signal', open: async page => { await page.locator('.mob-tab', {hasText: 'Signal'}).first().click(); }},
  {name: 'Filters', open: async page => {
    await page.locator('.mob-tab', {hasText: 'Filters'}).first().click();
    for (const chip of ['+ LP', '+ AP', '+ LT', '+ PEQ', '+ DLP']) await page.getByText(chip, {exact: true}).click();
  }},
];

for (const size of PHONE_SIZES) {
  for (const pageSpec of PAGES) {
    test(`classic rows: ${pageSpec.name} at ${size.width}×${size.height}`, async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await pageSpec.open(page);
      await photograph(page, size.width, pageSpec.name);

      const rows = page.locator('.mob-content .mob-ui-field, .mob-content .mob-crow');
      expect(await rows.count(), 'the page has field rows').toBeGreaterThan(0);

      const heights = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
      for (const h of heights) expect(Math.abs(h - ROW_PX), `row height ${h}`).toBeLessThanOrEqual(TOL);

      const boxes = await rows.evaluateAll(els => els.flatMap(row => {
        const input = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value .mob-readonly, select.mob-cselect');
        if (!input) return [];
        const box = input.getBoundingClientRect();
        const chip = row.querySelector<HTMLElement>('.ui-field-unit')?.getBoundingClientRect();
        return [{
          left: box.left, right: box.right,
          gutter: parseFloat(getComputedStyle(input).paddingLeft),
          chipInside: chip === undefined || chip.width === 0 || (chip.left >= box.left && chip.right <= box.right + 0.5),
        }];
      }));
      expect(boxes.length).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(Math.abs(b.left - boxes[0].left), 'value boxes share one left edge').toBeLessThanOrEqual(TOL);
        expect(b.gutter, 'text gutter').toBe(GUTTER_PX);
        expect(b.chipInside, 'unit chip inside its box').toBe(true);
      }

      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        cut: [...document.querySelectorAll<HTMLElement>('.mob-content label, .mob-content input, .mob-content button')]
          .filter(e => e.closest('[data-carousel]') === null)
          .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => `${e.tagName}.${e.className}:${e.textContent?.trim() || e.getAttribute('aria-label') || e.id}`),
        outside: [...document.querySelectorAll<HTMLElement>('.mob-content input, .mob-content button')]
          .filter(e => e.closest('[data-carousel]') === null)
          .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > window.innerWidth + 0.5); }).length,
      }));
      expect(overflow.page, 'no horizontal page scroll').toBe(false);
      expect(overflow.cut, 'no label, value or button is cut').toEqual([]);
      expect(overflow.outside, 'no control outside the viewport sideways').toBe(0);

      const strip = page.locator('.mob-key-strip');
      await expect(strip, 'key strip under the header').toBeVisible();
      for (const word of ['Entered', 'Calculated', 'Not Available']) await expect(strip).toContainText(word);
      const order = await page.evaluate(() => {
        const header = document.querySelector('.mob-topbar')?.getBoundingClientRect();
        const s = document.querySelector('.mob-key-strip')?.getBoundingClientRect();
        return header && s ? s.top - header.bottom : NaN;
      });
      expect(Math.abs(order), 'strip touches the header bottom').toBeLessThanOrEqual(1);

      const bands = await page.locator('.mob-content .mob-band').evaluateAll(els => els.map(e => ({
        h: e.getBoundingClientRect().height, help: e.querySelector('.mob-band-help') !== null,
      })));
      expect(bands.length, 'the page has section bands').toBeGreaterThan(0);
      for (const b of bands) {
        expect(Math.abs(b.h - BAND_PX), 'band height').toBeLessThanOrEqual(TOL);
        expect(b.help, 'band has a ?').toBe(true);
      }
    });
  }
}

test.describe('B10 Project sheet rows', () => {
  for (const size of PHONE_SIZES) {
    test(`classic rows: Project sheet at ${size.width}×${size.height}`, async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await page.locator('.mob-hamburger').click();
      await page.getByText('Project details').click();
      const rows = page.locator('.mob-dlg .mob-crow:not(.mob-crow-notes)');
      expect(await rows.count()).toBeGreaterThan(0);
      for (const h of await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) expect(Math.abs(h - ROW_PX)).toBeLessThanOrEqual(TOL);
      const bands = await page.locator('.mob-dlg .mob-band').evaluateAll(els => els.map(e => ({h: e.getBoundingClientRect().height, help: e.querySelector('.mob-band-help') !== null})));
      expect(bands.length).toBeGreaterThan(0);
      for (const b of bands) { expect(Math.abs(b.h - BAND_PX)).toBeLessThanOrEqual(TOL); expect(b.help).toBe(true); }
    });
  }
});

/**
 * B5 (T510): the driver picker (screen 6), Manage drivers (screen 7) and the passive radiator
 * browser (screen 35). Filters fold behind one button beside the search; the list gets the screen.
 */
const SHEET_BAND_PX = 28;
const SHEET_ROW_PX = 52;
const MIN_LIST_ROWS_ON_SCREEN = 5;

type DriverSheet = {readonly name: string; readonly open: (page: Page) => Promise<void>; readonly root: string};
const DRIVER_SHEETS: readonly DriverSheet[] = [
  {
    name: 'Driver picker', root: '.wb-modal',
    open: async page => {
      await page.locator('.mob-tab', {hasText: 'Driver'}).first().click();
      await page.getByText('Select driver').click();
    },
  },
  {
    name: 'Manage drivers', root: '.mob-dlg',
    open: async page => { await tapMobileMenuItem(page, 'Manage Drivers'); },
  },
];

for (const size of PHONE_SIZES) {
  for (const sheet of DRIVER_SHEETS) {
    test(`classic sheet: ${sheet.name} at ${size.width}×${size.height}`, async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await sheet.open(page);
      const root = page.locator(sheet.root);
      const library = root.locator('.driver-library');
      await expect(library).toBeVisible();
      await expect(library.locator('.ditem').first()).toBeVisible();

      // Filters are folded: the search sits beside a Filters button; no type chips, no Fs/Sd/Z boxes.
      const search = library.locator('input.filter');
      await expect(search).toHaveAttribute('placeholder', 'Brand or model');
      const toggle = library.locator('.dl-filters-toggle');
      await expect(toggle).toHaveText(/^Filters/);
      await expect(library.locator('.type-row')).toBeHidden();
      await expect(library.locator('.param-row')).toBeHidden();
      const s = await search.boundingBox();
      const t = await toggle.boundingBox();
      expect(Math.abs((s!.y + s!.height / 2) - (t!.y + t!.height / 2)), 'Filters button beside the search').toBeLessThanOrEqual(6);

      // Section bands: 28 px, a ? at the right.
      const bands = await library.locator('.mob-band').evaluateAll(els => els.map(e => ({
        title: e.querySelector('.mob-band-title')?.textContent ?? '', h: e.getBoundingClientRect().height, help: e.querySelector('.mob-band-help') !== null,
      })));
      expect(bands.map(b => b.title)).toEqual(['Search', 'Drivers']);
      for (const b of bands) { expect(Math.abs(b.h - SHEET_BAND_PX)).toBeLessThanOrEqual(TOL); expect(b.help).toBe(true); }

      // The list gets the screen: several two-line rows wholly in view, each at least 52 px with a 44 px star.
      const vp = page.viewportSize()!;
      const rows = await library.locator('.ditem').evaluateAll(els => els.map(e => {
        const r = e.getBoundingClientRect();
        const star = e.querySelector('.fav-btn')?.getBoundingClientRect();
        return {top: r.top, bottom: r.bottom, h: r.height, starW: star?.width ?? 0, starH: star?.height ?? 0, lines: e.querySelectorAll('.dl-name, .dl-sub').length};
      }));
      const inView = rows.filter(r => r.top >= 0 && r.bottom <= vp.height);
      expect(inView.length, 'every row up to five wholly on screen').toBeGreaterThanOrEqual(Math.min(rows.length, MIN_LIST_ROWS_ON_SCREEN));
      const listH = (await library.locator('.dlist').boundingBox())!.height;
      expect(listH, 'the list box has room for five rows (not capped at 42vh)').toBeGreaterThanOrEqual(MIN_LIST_ROWS_ON_SCREEN * SHEET_ROW_PX);
      for (const r of inView) {
        expect(r.h).toBeGreaterThanOrEqual(SHEET_ROW_PX - TOL);
        expect(r.starW).toBeGreaterThanOrEqual(44 - TOL);
        expect(r.starH).toBeGreaterThanOrEqual(44 - TOL);
        expect(r.lines, 'name line and links line').toBe(2);
      }

      // Filters opens the folded rows: chips for the types, no "Type" or "Show" labels.
      await toggle.click();
      await expect(toggle).toHaveText(/^Hide filters/);
      await expect(library.locator('.type-row')).toBeVisible();
      await expect(library.locator('.param-row')).toBeVisible();
      await expect(library.locator('.type-row .type-chip').first()).toBeVisible();
      await expect(library.locator('.plabel', {hasText: /^(Type|Show)$/})).toHaveCount(0);

      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        outside: [...document.querySelectorAll<HTMLElement>('.driver-library input, .driver-library button')]
          .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > window.innerWidth + 0.5); }).length,
      }));
      expect(overflow.page, 'no horizontal page scroll').toBe(false);
      expect(overflow.outside, 'no control outside the viewport sideways').toBe(0);
      for (const name of [/Add new Driver/, /Load File/]) {
        const b = await root.getByRole('button', {name}).boundingBox();
        expect(b!.y + b!.height, String(name)).toBeLessThanOrEqual(vp.height);
        expect(b!.height, String(name)).toBeGreaterThanOrEqual(44 - TOL);
      }
    });
  }

  test(`classic sheet: Passive radiator browser at ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Box'}).first().click();
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await page.getByRole('button', {name: 'Select passive radiator'}).click();
    const modal = page.locator('.overlay.on .modal');
    await expect(modal.locator('.pr-lib-item').first()).toBeVisible();
    const vp = page.viewportSize()!;

    const head = await modal.locator('h2').boundingBox();
    expect(Math.abs(head!.height - 48), 'header 48 px').toBeLessThanOrEqual(TOL);
    expect((await modal.locator('.pr-filter').boundingBox())!.height, 'filter box 36 px').toBeCloseTo(36, 0);

    const items = await modal.locator('.pr-lib-item').evaluateAll(els => els.map(e => ({
      h: e.getBoundingClientRect().height, specs: e.querySelector('.pr-lib-specs')?.textContent ?? '',
      star: e.querySelector('.fav-btn') !== null,
    })));
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(i.h).toBeGreaterThanOrEqual(44 - TOL);
      expect(i.specs, 'specs line').toMatch(/^Sd = .+ · Mms = .+ · Cms = .+$/);
      expect(i.star).toBe(true);
    }
    for (const name of [/Define new passive radiator/, 'Done']) {
      const b = await modal.getByRole('button', {name}).boundingBox();
      expect(b!.height, String(name)).toBeCloseTo(42, 0);
      expect(b!.y + b!.height).toBeLessThanOrEqual(vp.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
}

/**
 * B12, screen 25: the New project wizard follows QO267/wizard-live.html. Every step, every box type on
 * step 4, at every phone size: classic rows (40 px, one value-box edge, 14 px gutter, chip inside),
 * 28 px bands with no ? of their own (the one ? is on the step bar), the key strip under the header,
 * the step bar with the title only, a two-line banner on steps 2 to 5, the pictures, and the footer
 * Cancel, Back, Next. The alignment select is the one row that is taller: its label sits above it.
 */
const WIZARD_DRIVER = 'Tang Band W5-1138SMF';

const WIZARD_STEPS: readonly {readonly name: string; readonly box: string; readonly at: number; readonly pictures: number}[] = [
  {name: 'step 2 drivers and placement', box: 'vented', at: 2, pictures: 1},
  {name: 'step 3 type of design', box: 'vented', at: 3, pictures: 1},
  ...['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'].map(box => ({name: `step 4 ${box}`, box, at: 4, pictures: 1})),
  {name: 'step 5 project information', box: 'vented', at: 5, pictures: 0},
];

async function wizardAt(page: Page, at: number, box: string): Promise<void> {
  await page.getByText('New project').click();
  await page.getByText(WIZARD_DRIVER).click();
  const next = page.locator('.mob-np-footer button.np-primary');
  await next.click();                                   // step 2
  if (at > 2) await next.click();                       // step 3
  if (at > 3) { await page.locator('#np-box-type').selectOption(box); await next.click(); }   // step 4
  if (at > 4) await next.click();                       // step 5
}

for (const size of PHONE_SIZES) {
  for (const step of WIZARD_STEPS) {
    test(`classic wizard: ${step.name} at ${size.width}×${size.height}`, async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await wizardAt(page, step.at, step.box);
      const body = page.locator('.mob-np-body');

      const rows = body.locator('.mob-ui-field, .mob-crow:not(.mob-crow-stack)');
      const heights = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
      expect(heights.length, 'the page has field rows (step 5 has none)').toBeGreaterThanOrEqual(step.at === 5 ? 0 : 1);
      for (const h of heights) expect(Math.abs(h - ROW_PX), `row height ${h}`).toBeLessThanOrEqual(TOL);

      const boxes = await rows.evaluateAll(els => els.flatMap(row => {
        const input = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value .mob-readonly, select.mob-cselect');
        if (!input) return [];
        const box = input.getBoundingClientRect();
        const chip = row.querySelector<HTMLElement>('.ui-field-unit')?.getBoundingClientRect();
        return [{left: box.left, gutter: parseFloat(getComputedStyle(input).paddingLeft),
          chipInside: chip === undefined || chip.width === 0 || (chip.left >= box.left && chip.right <= box.right + 0.5)}];
      }));
      for (const b of boxes) {
        expect(Math.abs(b.left - boxes[0].left), 'value boxes share one left edge').toBeLessThanOrEqual(TOL);
        expect(b.gutter, 'text gutter').toBe(GUTTER_PX);
        expect(b.chipInside, 'unit chip inside its box').toBe(true);
      }

      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        body: (() => { const b = document.querySelector('.mob-np-body'); return b ? b.scrollWidth > b.clientWidth : true; })(),
        cut: [...document.querySelectorAll<HTMLElement>('.mob-np-overlay label, .mob-np-overlay input, .mob-np-overlay button, .mob-np-overlay select')]
          .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => `${e.tagName}.${e.className}:${e.textContent?.trim() || e.id}`),
        outside: [...document.querySelectorAll<HTMLElement>('.mob-np-overlay input, .mob-np-overlay button, .mob-np-overlay select, .mob-np-overlay textarea')]
          .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -0.5 || r.right > window.innerWidth + 0.5); }).length,
      }));
      expect(overflow.page, 'no horizontal page scroll').toBe(false);
      expect(overflow.body, 'no horizontal scroll in the wizard body').toBe(false);
      expect(overflow.cut, 'no label, value or button is cut').toEqual([]);
      expect(overflow.outside, 'no control outside the viewport sideways').toBe(0);

      const strip = page.locator('.mob-np-overlay .mob-key-strip');
      for (const word of ['Entered', 'Calculated', 'Not Available']) await expect(strip).toContainText(word);
      const gap = await page.evaluate(() => {
        const header = document.querySelector('.mob-np-head')?.getBoundingClientRect();
        const s = document.querySelector('.mob-np-overlay .mob-key-strip')?.getBoundingClientRect();
        return header && s ? s.top - header.bottom : NaN;
      });
      expect(Math.abs(gap), 'strip touches the header bottom').toBeLessThanOrEqual(1);

      const bar = page.locator('.mob-np-stepbar');
      await expect(bar, 'step bar shows the title only').not.toContainText(/step \d/i);
      await expect(bar.locator('.np-step')).not.toBeEmpty();
      await expect(bar.locator('.mob-np-help'), 'one ? on the step bar').toHaveCount(1);
      await expect(page.locator('.mob-np-overlay .mob-band-help'), 'bands carry no ? in the wizard').toHaveCount(0);
      await expect(page.locator('.mob-np-overlay .mob-np-dots'), 'no progress dots').toHaveCount(0);
      const bands = await body.locator('.mob-band').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
      expect(bands.length, 'the page has section bands').toBeGreaterThan(0);
      for (const h of bands) expect(Math.abs(h - BAND_PX), 'band height').toBeLessThanOrEqual(TOL);

      await expect(body.locator('.mob-np-banner'), 'two-line banner').toHaveCount(1);
      await expect(body.locator('.mob-np-banner > *')).toHaveCount(2);
      await expect(body.locator('.mob-np-pic svg:visible')).toHaveCount(step.pictures);

      const btnHeights = await page.locator('.mob-np-footer button').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
      for (const h of btnHeights) expect(Math.abs(h - 44), 'one 44 px button').toBeLessThanOrEqual(TOL);
      await expect(page.locator('.mob-np-footer .np-primary'), 'one primary button').toHaveCount(1);
      const primaryBg = await page.locator('.mob-np-footer .np-primary').evaluate(e => getComputedStyle(e).backgroundColor);
      expect(primaryBg, 'primary is blue, not green').not.toBe('rgb(27, 125, 27)');
      const footer = await page.locator('.mob-np-footer button').allTextContents();
      expect(footer.map(t => t.trim()), 'footer order').toEqual(['Cancel', '◀ Back', step.at === 5 ? 'Create Project' : 'Next ▸']);
    });
  }
}

test('classic wizard: the ? on the step bar opens that step\'s help and closes again', async ({page}) => {
  await page.setViewportSize(PIXEL_9);
  await forceMobileSkin(page);
  await page.goto('/');
  await wizardAt(page, 2, 'vented');
  await page.locator('.mob-np-help').click();
  const sheet = page.getByRole('dialog', {name: /Help: Number of drivers and placement/});
  await expect(sheet).toContainText('Driver Array');
  await expect(sheet).toContainText('Placement');
  await sheet.getByRole('button', {name: 'Close help'}).click();
  await expect(sheet).toHaveCount(0);
});

test('classic wizard: Iso-Barik shows its drawing and the not-modelled note; the ⓘ explains placement', async ({page}) => {
  await page.setViewportSize(PIXEL_9);
  await forceMobileSkin(page);
  await page.goto('/');
  await wizardAt(page, 2, 'vented');
  await expect(page.locator('.mob-np-pic')).not.toContainText('not modelled');
  await page.locator('#np-placement').selectOption('iso');
  await expect(page.locator('.mob-np-pic')).toContainText('Iso-Barik is not modelled yet');
  await page.getByRole('button', {name: 'About driver placement'}).click();
  await expect(page.getByRole('dialog', {name: 'Driver placement'})).toContainText('Standard');
  await page.getByRole('dialog', {name: 'Driver placement'}).getByRole('button', {name: 'Close'}).click();
  await expect(page.getByRole('dialog', {name: 'Driver placement'})).toHaveCount(0);
});

test('classic wizard: step 3 has the EBP row under Box type with its badge; its ⓘ gives the driver\'s EBP', async ({page}) => {
  await page.setViewportSize(PIXEL_9);
  await forceMobileSkin(page);
  await page.goto('/');
  await wizardAt(page, 3, 'vented');
  const row = page.locator('.mob-np-ebp');
  await expect(row).toContainText(/^EBP: [\d.]+\s*Fs \/ Qes/);
  await expect(row.locator('.mob-np-ebp-badge')).toHaveText(/Sealed|Vented|Sealed or vented/);
  await page.getByRole('button', {name: 'About EBP'}).click();
  await expect(page.getByRole('dialog', {name: 'EBP'})).toContainText('Your driver: EBP');
});

test('classic wizard: step 5 has the name and description boxes with their labels above, and Enter in the name does not create', async ({page}) => {
  await page.setViewportSize(PIXEL_9);
  await forceMobileSkin(page);
  await page.goto('/');
  await wizardAt(page, 5, 'vented');
  const name = page.getByLabel('Project name');
  const description = page.getByLabel('Description');
  const [nameBox, labelBox] = [await name.boundingBox(), await page.locator('label', {hasText: 'Project name'}).boundingBox()];
  expect(labelBox!.y + labelBox!.height, 'label above the name box').toBeLessThanOrEqual(nameBox!.y + 1);
  await name.fill('My sub');
  await name.press('Enter');
  await expect(page.locator('.mob-np-overlay'), 'Enter finishes the box, it does not create').toBeVisible();
  await expect(name).toHaveValue('My sub');
  await description.fill('Notes');
  await page.locator('.mob-np-footer').getByText('Create Project').click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();
});
