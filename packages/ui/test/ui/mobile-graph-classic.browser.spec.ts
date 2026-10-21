import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';
import {ChartPageSizes, PhoneRowSizes} from '@openisd/design/fields';

/**
 * The classic phone Graph page (PHONE_CLASSIC_BUILD_SPEC screens 11 to 14): the chart bar, a 28 px
 * band over each chart with the Data chip and a ?, one shared legend, the Tune / What-if button
 * strip, the Data sheet and the shorter Tune and What-if sheets. Auto Y stays on the chart (QO278).
 * Sizes come from ChartPageSizes and PhoneRowSizes.CLASSIC (the standard
 * 40 px rows; every button the one 44 px button).
 */
const BAR_PX = ChartPageSizes.CLASSIC.barHeightPx();
const BAND_PX = ChartPageSizes.CLASSIC.values.bandPx;
const SHEET_MAX_PX = ChartPageSizes.CLASSIC.values.sheetMaxPx;
const SHEET_BAND_PX = ChartPageSizes.CLASSIC.values.sheetBandPx;
const SHEET_ROW_PX = PhoneRowSizes.CLASSIC.rowMinPx;
const TOL = 0.5;

async function openGraph(page: Page, size: {width: number; height: number}): Promise<void> {
  await page.setViewportSize(size);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await expect(page.locator('.mob-chart-cell')).toHaveCount(1);
}

const heightOf = (page: Page, selector: string) => page.locator(selector).first().evaluate(e => e.getBoundingClientRect().height);

async function noSidewaysOverflow(page: Page): Promise<void> {
  const o = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    cut: [...document.querySelectorAll<HTMLElement>('.mob-chart-view button, .mob-chart-view select, .mob-chart-view label, .mob-chart-view input')]
      .filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'hidden').map(e => `${e.tagName}.${e.className}:${e.textContent?.trim()}`),
    outside: [...document.querySelectorAll<HTMLElement>('.mob-chart-view button, .mob-chart-view select, .mob-chart-view input')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -0.5 || r.right > window.innerWidth + 0.5); })
      .map(e => `${e.tagName}.${e.className}`),
  }));
  expect(o.page, 'no horizontal page scroll').toBe(false);
  expect(o.cut, 'nothing cut').toEqual([]);
  expect(o.outside, 'nothing outside the screen sideways').toEqual([]);
}

for (const size of PHONE_SIZES) {
  test(`Graph page: bar, band, button strip at ${size.width}×${size.height}`, async ({page}) => {
    await openGraph(page, size);

    expect(Math.abs(await heightOf(page, '.mob-chart-head') - BAR_PX), 'chart bar height').toBeLessThanOrEqual(TOL);
    for (const sel of ['.mob-chart-menu', '.mob-chart-pick', '.mob-chart-high select']) {
      expect(Math.abs(await heightOf(page, sel) - ChartPageSizes.CLASSIC.values.headControlPx), `${sel} height`).toBeLessThanOrEqual(TOL);
    }

    const band = page.locator('.mob-chart-cell .mob-band').first();
    await expect(band).toContainText('SPL response');
    expect(Math.abs(await heightOf(page, '.mob-chart-cell .mob-band') - BAND_PX), 'chart band height').toBeLessThanOrEqual(TOL);
    await expect(band.getByRole('button', {name: 'Data'})).toBeVisible();
    await expect(band.getByRole('button', {name: 'Help: SPL response'})).toBeVisible();
    const data = await band.getByRole('button', {name: 'Data'}).evaluate(el => {
      const r = el.getBoundingClientRect();
      const chip = el.firstElementChild?.getBoundingClientRect();
      return {w: r.width, h: r.height, chipH: chip?.height ?? 0};
    });
    expect(Math.min(data.w, data.h), 'the Data chip is hit as a 44 px button').toBeGreaterThanOrEqual(PhoneRowSizes.BUTTON_PX - TOL);
    expect(data.chipH, 'but drawn as a small chip inside the band').toBeLessThan(BAND_PX);
    const order = await page.evaluate(() => {
      const b = document.querySelector('.mob-chart-cell .mob-band')?.getBoundingClientRect();
      const c = document.querySelector('.mob-chart-cell canvas')?.getBoundingClientRect();
      return b && c ? c.top - b.bottom : NaN;
    });
    expect(Math.abs(order), 'the canvas starts under the band').toBeLessThanOrEqual(1);
    await expect(page.locator('.mob-chart-cell .gtitle'), 'the title is in the band, not on the chart').toHaveCount(0);

    const strip = await page.locator('.mob-sheet-dock').evaluate(el => {
      const r = el.getBoundingClientRect();
      return {h: r.height, buttons: [...el.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return {h: q.height, left: q.left, right: q.right}; })};
    });
    expect(strip.buttons).toHaveLength(2);
    for (const b of strip.buttons) expect(Math.abs(b.h - PhoneRowSizes.BUTTON_PX), 'strip button height').toBeLessThanOrEqual(TOL);
    expect(Math.abs(strip.h - ChartPageSizes.CLASSIC.stripHeightPx()), 'strip height').toBeLessThanOrEqual(TOL);
    expect(Math.abs(strip.buttons[1].left - strip.buttons[0].right - ChartPageSizes.CLASSIC.values.barGapPx), 'gap between the two buttons').toBeLessThanOrEqual(TOL);
    await noSidewaysOverflow(page);
  });

  test(`Data sheet: full screen with Copy, Download CSV, Close at ${size.width}×${size.height}`, async ({page}) => {
    await openGraph(page, size);
    await page.locator('.mob-chart-cell .mob-band').getByRole('button', {name: 'Data'}).click();
    const sheet = page.getByRole('dialog', {name: 'SPL response data'});
    await expect(sheet).toBeVisible();
    const box = await sheet.evaluate(el => { const r = el.getBoundingClientRect(); return {w: r.width, h: r.height, x: r.left, y: r.top}; });
    expect(box.w, 'full width').toBe(size.width);
    expect(box.h, 'full height').toBe(size.height);
    await expect(sheet.locator('tbody tr').first()).toBeVisible();
    for (const name of ['Copy', 'Download CSV', 'Close']) await expect(sheet.getByRole('button', {name, exact: true})).toBeVisible();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(sideways).toBe(false);
    await sheet.getByRole('button', {name: 'Close', exact: true}).click();
    await expect(sheet).toHaveCount(0);
  });

  for (const [sheetName, resetButtons] of [['Tune', 0], ['What-if', 1]] as const) {
    test(`${sheetName} sheet: 24 px band, 40 px rows, 44 px buttons, at most 250 px, chart kept at ${size.width}×${size.height}`, async ({page}) => {
      await openGraph(page, size);
      await page.getByRole('button', {name: `Open ${sheetName}`}).click();
      const sheet = page.locator('.mob-sheet');
      await expect(sheet).toBeVisible();
      expect(await sheet.evaluate(el => el.getBoundingClientRect().height), 'sheet height').toBeLessThanOrEqual(SHEET_MAX_PX + TOL);
      const band = sheet.locator('.mob-band');
      await expect(band).toContainText(sheetName);
      expect(Math.abs(await band.evaluate(el => el.getBoundingClientRect().height) - SHEET_BAND_PX), 'sheet band height').toBeLessThanOrEqual(TOL);
      await expect(band.getByRole('button', {name: `Help: ${sheetName}`})).toBeVisible();
      for (const h of await sheet.locator('.mob-sheet-line').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) {
        expect(Math.abs(h - SHEET_ROW_PX), 'sheet row height').toBeLessThanOrEqual(TOL);
      }
      const chart = await heightOf(page, '.mob-chart-cell .gpanel');
      expect(chart, 'the chart keeps its height').toBeGreaterThanOrEqual(120);
      await expect(sheet.getByRole('button', {name: 'Close', exact: true})).toBeVisible();
      for (const h of await sheet.locator('.mob-sheet-btn').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) {
        expect(Math.abs(h - PhoneRowSizes.BUTTON_PX), 'sheet button height').toBeLessThanOrEqual(TOL);
      }
      const cut = await sheet.locator('.mob-sheet-label, .mob-sheet-value input').evaluateAll(els =>
        els.filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map(e => e instanceof HTMLInputElement ? e.value : e.textContent?.trim()));
      expect(cut, 'no row label or value cut').toEqual([]);
      const covered = await sheet.locator('.mob-sheet-cell').evaluateAll(cells => cells.flatMap(cell => {
        const input = cell.querySelector('input');
        const unit = cell.querySelector('.mob-sheet-unit');
        if (input === null || unit === null) return [];
        const ctx = document.createElement('canvas').getContext('2d');
        if (ctx === null) return [];
        const st = getComputedStyle(input);
        ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
        const textEnd = input.getBoundingClientRect().left + parseFloat(st.paddingLeft) + ctx.measureText(input.value).width;
        return textEnd > unit.getBoundingClientRect().left ? [`${cell.querySelector('.mob-sheet-label')?.textContent}: ${input.value}`] : [];
      }));
      expect(await sheet.locator('.mob-sheet-cell .mob-sheet-unit').count(), 'units are measured').toBeGreaterThan(0);
      expect(covered, 'no value hidden under its unit').toEqual([]);
      await expect(sheet.getByRole('button', {name: 'Reset'}), 'only What-if has Reset').toHaveCount(resetButtons);
      await expect(page.locator('.gautoy'), 'Auto Y stays on the chart').toBeVisible();
      await noSidewaysOverflow(page);
    });
  }
}

test('one shared legend names each curve once, under the bar, only with two or more curves', async ({page}) => {
  await openGraph(page, PHONE_SIZES[0]);
  await expect(page.locator('.mob-chart-legend'), 'one curve: no legend').toHaveCount(0);
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  const legend = page.locator('.mob-chart-legend');
  await expect(legend).toBeVisible();
  await expect(legend.locator('.mob-chart-legend-item')).toHaveCount(2);
  const order = await page.evaluate(() => {
    const head = document.querySelector('.mob-chart-head')?.getBoundingClientRect();
    const leg = document.querySelector('.mob-chart-legend')?.getBoundingClientRect();
    return head && leg ? leg.top - head.bottom : NaN;
  });
  expect(Math.abs(order), 'the legend sits under the bar').toBeLessThanOrEqual(1);
  await page.locator('.mob-chart-cell .mob-band').getByRole('button', {name: 'Data'}).click();
  const sheet = page.getByRole('dialog', {name: 'SPL response data'});
  await expect(sheet.locator('thead th'), 'the Data sheet has one column per curve, after the frequency').toHaveCount(3);
});
