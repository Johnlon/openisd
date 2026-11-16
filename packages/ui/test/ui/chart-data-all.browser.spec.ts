/**
 * John, 16 Nov 2026: "can you quickly add a feature to export all data from the charts, just export literally everything
 * not just selected charts"; "put the buttons next to the existing data button as (all)". The (all) button next to every
 * chart's Data button downloads one ZIP with a CSV for every chart of the project and the project file, then a popup
 * says what was exported.
 */
import {readFileSync} from 'node:fs';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {Download, Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/** The file names in a ZIP's central directory. */
function zipNames(bytes: Buffer): string[] {
  const end = bytes.length - 22;
  expect(bytes.readUInt32LE(end)).toBe(0x06054b50);
  const count = bytes.readUInt16LE(end + 10);
  let at = bytes.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const len = bytes.readUInt16LE(at + 28);
    names.push(bytes.toString('utf8', at + 46, at + 46 + len));
    at += 46 + len;
  }
  return names;
}

async function checkDownload(page: Page, file: Download): Promise<void> {
  expect(file.suggestedFilename()).toMatch(/ - all chart data\.zip$/);
  const names = zipNames(readFileSync(await file.path()));
  expect(names.at(-1)).toBe('project.json');
  const csvs = names.filter(n => n.endsWith('.csv'));
  expect(csvs.length).toBeGreaterThan(10);
  for (const wanted of ['SPL response', 'Cone excursion', 'Impedance', 'Group delay']) {
    expect(csvs.some(n => n.endsWith(` - ${wanted}.csv`)), wanted).toBe(true);
  }
  const popup = page.getByRole('alertdialog');
  await expect(popup.locator('p')).toHaveText(`Exported ${csvs.length} charts to "${file.suggestedFilename()}".`);
  await popup.getByRole('button', {name: 'OK'}).click();
  await expect(popup).toBeHidden();
}

test('Original skin: (all) next to Data downloads every chart and the project in one ZIP, with a popup', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const panel = page.locator('.chart-cell .gpanel').first();
  const download = page.waitForEvent('download');
  await panel.getByRole('button', {name: '(all)'}).click();
  const file = await download;
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await checkDownload(page, file);
});

test('Mobile skin: (all) next to Data downloads every chart and the project in one ZIP, with a popup', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  const download = page.waitForEvent('download');
  await page.locator('.mob-chart-cell .mob-band').first().getByRole('button', {name: '(all)'}).click();
  const file = await download;
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await checkDownload(page, file);
});
