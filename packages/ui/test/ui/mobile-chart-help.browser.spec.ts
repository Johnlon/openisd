import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {ChartPageHelp} from '@openisd/design/fields';

/** Every chart on the phone Graph page has the same ? in its band, opening help with its first sentence. */
test('phone Graph page: every offered chart has a ? that opens its help, with no clipping or sideways scroll', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await expect(page.locator('.mob-chart-cell')).toHaveCount(1);

  await page.locator('.mob-chart-pick').click();
  const names = await page.locator('.mob-chart-list .mob-chart-name').allTextContents();
  expect(names.length, 'the picker offers several charts').toBeGreaterThan(8);
  await page.locator('.mob-chart-pick').click();

  for (const label of names) {
    await page.locator('.mob-chart-pick').click();
    await page.locator('.mob-chart-list .mob-chart-name').getByText(label, {exact: true}).click();
    const band = page.locator('.mob-chart-cell .mob-band').first();
    const title = (await band.locator('.mob-band-title').textContent() ?? '').replace('Data', '').trim();
    const help = ChartPageHelp.forChart(title);
    expect(help, `help text for the chart "${title}"`).not.toBeNull();
    await band.getByRole('button', {name: `Help: ${title}`}).click();
    const sheet = page.getByRole('dialog', {name: `Help: ${title}`});
    await expect(sheet).toContainText(help?.intro ?? '');
    await expect(sheet.locator('a[target="_blank"]')).toHaveCount(help?.links.length ?? 0);
    const box = await sheet.evaluate(e => { const r = e.getBoundingClientRect(); return {l: r.left, r: r.right, b: r.bottom, sw: e.scrollWidth, cw: e.clientWidth, vw: window.innerWidth, vh: window.innerHeight, page: document.documentElement.scrollWidth > document.documentElement.clientWidth}; });
    expect(box.l, `${title} sheet left`).toBeGreaterThanOrEqual(-0.5);
    expect(box.r, `${title} sheet right`).toBeLessThanOrEqual(box.vw + 0.5);
    expect(box.b, `${title} sheet bottom`).toBeLessThanOrEqual(box.vh + 0.5);
    expect(box.sw, `${title} no sideways scroll in the sheet`).toBeLessThanOrEqual(box.cw + 1);
    expect(box.page, `${title} no page sideways scroll`).toBe(false);
    await sheet.getByRole('button', {name: 'Close help'}).click();
    await expect(sheet).toHaveCount(0);
  }
});
