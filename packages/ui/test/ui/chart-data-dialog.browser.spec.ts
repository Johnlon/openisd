/**
 * John, 18 Oct 2026: "WE NEED TO ADD AN OPTION TO OPENISD TO SEE THE CHART DATA AS TEXT / DOWNLOAD".
 * Every chart's Data button opens its curves as a table; Download CSV saves them and a popup says
 * what was saved.
 */
import {readFileSync} from 'node:fs';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test('Original skin: Data shows the chart as a table, and Download CSV saves it with a popup', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const panel = page.locator('.chart-cell .gpanel').first();
  const chart = (await panel.locator('.gtitle').innerText()).replace(/Data$/, '').trim();
  await panel.getByRole('button', {name: 'Data'}).click();
  const dialog = page.getByRole('dialog', {name: `${chart} data`});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('th').first()).toHaveText('Frequency (Hz)');
  await expect(dialog.locator('tbody tr').first()).toBeVisible();

  const download = page.waitForEvent('download');
  await dialog.getByRole('button', {name: 'Download CSV'}).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(new RegExp(` - ${chart}\\.csv$`));
  const csv = readFileSync(await file.path(), 'utf8');
  expect(csv.split('\r\n')[0]).toMatch(/^Frequency \(Hz\),/);
  expect(csv.split('\r\n').length).toBeGreaterThan(10);
  const popup = page.getByRole('alertdialog');
  await expect(popup.locator('p')).toHaveText(`Saved the ${chart} chart data to ${file.suggestedFilename()}.`);
  await popup.getByRole('button', {name: 'OK'}).click();

  await dialog.getByRole('button', {name: 'Close'}).click();
  await expect(dialog).toBeHidden();
});

test('Mobile skin: Data shows the chart as a table, and Close closes it', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  const panel = page.locator('.mob-chart-cell .gpanel').first();
  await panel.getByRole('button', {name: 'Data'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('th').first()).toHaveText('Frequency (Hz)');
  await expect(dialog.getByRole('button', {name: 'Download CSV'})).toBeInViewport();
  await dialog.getByRole('button', {name: 'Close'}).click();
  await expect(dialog).toBeHidden();
});
