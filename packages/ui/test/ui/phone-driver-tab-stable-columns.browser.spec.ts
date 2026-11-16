import {readFileSync} from 'node:fs';
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * The phone Driver tab does not move when the driver changes (lead, QO923: a layout that moves when you change driver is
 * a defect). Its label column is as wide as the longest label the tab can show ("Coil wiring", a row only some drivers
 * have), so the value boxes sit at the same x with the same width for a driver with one coil or no coil count, a driver
 * with two coils and a known wiring, and one with two coils and an unknown wiring. The frozen 172 px holds for all three.
 */
const DRIVERS: readonly {name: string; file: string}[] = [
  {name: 'no coil count (CE28M-4)', file: 'dayton-audio/ce28m-4'},
  {name: 'two coils, wiring known (MX6-22)', file: 'dayton-audio/mx6-22'},
  {name: 'three coils, wiring not stated (W137A-854-4)', file: 'bliesma/w137a-854-4'},
];

async function boxes(page: Page): Promise<{x: number; width: number}[]> {
  return page.locator('.mob-classic input:not([type=checkbox]), .mob-classic select').evaluateAll(els => els.map(el => { const b = el.getBoundingClientRect(); return {x: Math.round(b.x * 10) / 10, width: Math.round(b.width * 10) / 10}; }));
}

test('the phone Driver tab value boxes have the same x and width for every driver', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  const seen: {name: string; fs: {x: number; width: number}; count: {x: number; width: number}}[] = [];
  for (const d of DRIVERS) {
    await page.getByText('Select driver').click();
    await page.locator('.driver-library input[type="file"]').setInputFiles({name: 'driver.owdr', mimeType: 'application/json', buffer: readFileSync(`packages/ui/public/drivers/${d.file}.json`)});
    await expect(page.locator('.driver-library .preview')).toBeVisible();
    await page.locator('.driver-library .use-btn').click();
    await expect(page.locator('.wb-modal')).toHaveCount(0);
    const all = await boxes(page);
    const fs = await page.locator('.mob-ui-field', {hasText: 'Fs'}).locator('input').first().evaluate(el => { const b = el.getBoundingClientRect(); return {x: Math.round(b.x * 10) / 10, width: Math.round(b.width * 10) / 10}; });
    const count = await page.locator('#mob-n-drivers').evaluate(el => { const b = el.getBoundingClientRect(); return {x: Math.round(b.x * 10) / 10, width: Math.round(b.width * 10) / 10}; });
    expect(all.length).toBeGreaterThan(0);
    seen.push({name: d.name, fs, count});
  }
  const first = seen[0]!;
  for (const s of seen) expect(s, s.name).toEqual({name: s.name, fs: first.fs, count: first.count});
});
