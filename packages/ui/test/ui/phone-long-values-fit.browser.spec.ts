/**
 * T742 (John: clipping is a bug). A phone number box shows its longest figure and its whole unit at
 * 374 x 705, on the pages whose boxes carry wide units (Cms mm/N, Rms Ns/m, Vas, air density kg/m³).
 * The layout gate only measures the figures a project happens to show; this fills each box with a
 * long figure first.
 */
import type {Page} from '@playwright/test';
import {editorTab, expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const LONG_FIGURE = '0.368721';

async function expectNothingCut(page: Page, where: string): Promise<void> {
  const cut = await page.evaluate((figure) => {
    const out: string[] = [];
    for (const input of document.querySelectorAll<HTMLInputElement>('.ui-field input[data-numinput]')) {
      if (input.readOnly || input.getBoundingClientRect().width === 0) continue;
      input.value = figure;
      const unit = input.closest('.ui-field')?.querySelector<HTMLElement>('.ui-field-unit');
      const valueCut = input.scrollWidth - input.clientWidth;
      const unitCut = unit === undefined || unit === null ? 0 : unit.scrollWidth - unit.clientWidth;
      if (valueCut > 1 || unitCut > 1) out.push(`${input.closest('.ui-field')?.querySelector('label')?.textContent?.trim()} value ${valueCut}px unit ${unitCut}px`);
    }
    return out;
  }, LONG_FIGURE);
  expect(cut, `${where}: a figure or unit is cut`).toEqual([]);
}

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.setViewportSize({width: PIXEL_9.width, height: PIXEL_9.height});
  await page.goto('/');
  await openAMobileProject(page);
});

test('driver editor Parameters and Advanced show a long figure and the whole unit at 374', async ({page}) => {
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByText('Edit', {exact: true}).click();
  await editorTab(page, 'Parameters');
  await expectNothingCut(page, 'Parameters');
  await editorTab(page, 'Advanced');
  await expectNothingCut(page, 'Advanced');
});

test('the Advanced page shows a long figure and the whole unit at 374', async ({page}) => {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
  await expectNothingCut(page, 'Advanced');
});
