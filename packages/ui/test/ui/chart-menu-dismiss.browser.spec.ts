import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';

// John, 18 Nov 2026 (QO946.c253): "the drop down menu on the chart needs to dismiss if it lose focus";
// "at present have to click the header again". The chart menu closes on a press outside it (including on
// the header's other controls), on Escape and when Tab takes focus out; the header click still toggles it.
type Way = {name: string; leave: (page: Page) => Promise<void>};

async function checkEveryWay(page: Page, open: () => Promise<void>, list: Locator, toggler: Locator, outside: Locator, tabbable: Locator): Promise<void> {
  const ways: Way[] = [
    {name: 'a press on the chart', leave: async () => { await outside.click(); }},
    {name: 'Escape', leave: async p => { await p.keyboard.press('Escape'); }},
    {name: 'Tab out of the menu', leave: async p => { await tabbable.focus(); await p.keyboard.press('Tab'); }},
  ];
  for (const way of ways) {
    await open();
    await expect(list, `before ${way.name}`).toBeVisible();
    await way.leave(page);
    await expect(list, `after ${way.name}`).toBeHidden();
  }
  await open();
  await expect(list).toBeVisible();
  await toggler.click();
  await expect(list, 'the header click still toggles it closed').toBeHidden();
}

test('desktop: the chart menu closes on a press outside, Escape and Tab out; the chart name still toggles it', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const select = page.locator('.chart-select');
  const list = select.locator('.dropdown-menu');
  await checkEveryWay(page, async () => { if (!(await list.isVisible())) await select.click(); }, list, select,
    page.locator('.graph-wrap canvas'), select.locator('input[type=checkbox]').last());
  await expect(list).toBeHidden();
});

test('phone: the Graph tab chart picker closes on a press outside (even on the header), Escape and Tab out; the picker button still toggles it', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  const pick = page.locator('.mob-chart-pick');
  const list = page.locator('.mob-chart-list');
  await checkEveryWay(page, async () => { if (!(await list.isVisible())) await pick.click(); }, list, pick,
    page.locator('.mob-chart-high'), list.locator('.mob-chart-name').last());
  // A tap on the chart below the header (the backdrop) closes it too.
  await pick.click();
  await expect(list).toBeVisible();
  await page.mouse.click(187, 680);
  await expect(list).toBeHidden();
});
