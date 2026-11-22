import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {Page} from '@playwright/test';
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const DRIVER = 'Tang Band W5-1138SMF';
const SCREENSHOT_DIR = process.env.SUMMARY_SCREENSHOT_DIR;

async function captureSummaryScreenshot(page: Page, name: string): Promise<void> {
  if (!SCREENSHOT_DIR) return;
  mkdirSync(SCREENSHOT_DIR, {recursive: true});
  await page.screenshot({path: join(SCREENSHOT_DIR, name)});
}

async function summaryPresentation(preview: import('@playwright/test').Locator) {
  return preview.evaluate(element => {
    const style = (selector: string) => {
      const target = element.querySelector<HTMLElement>(selector)!;
      const computed = getComputedStyle(target);
      return {
        display: computed.display,
        fontSize: computed.fontSize,
        lineHeight: computed.lineHeight,
        padding: computed.padding,
        gap: computed.gap,
      };
    };
    const columns = new Map<number, {numbers: number[]; units: number[]; gaps: number[]}>();
    for (const row of element.querySelectorAll<HTMLElement>('.spec-row')) {
      const cell = row.getBoundingClientRect();
      const column = Math.round(cell.left);
      const metrics = columns.get(column) ?? {numbers: [], units: [], gaps: []};
      columns.set(column, metrics);
      const value = row.querySelector<HTMLElement>('.spec-val b')!;
      if (Number.isFinite(Number(value.textContent?.trim()))) metrics.numbers.push(value.getBoundingClientRect().right);
      const unit = row.querySelector<HTMLElement>('.spec-unit');
      if (unit && unit.textContent?.trim()) {
        metrics.units.push(unit.getBoundingClientRect().left);
        metrics.gaps.push(unit.getBoundingClientRect().left - value.getBoundingClientRect().right);
      }
    }
    const drift = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : 0;
    const alignment = [...columns.values()];
    return {
      previewPadding: getComputedStyle(element).padding,
      specColumnCount: getComputedStyle(element.querySelector('.prev-specs')!).gridTemplateColumns.split(' ').length,
      specRow: style('.spec-row'),
      metadata: style('.prev-textinfo'),
      metadataLabel: style('.prev-src-lbl'),
      metadataRow: style('.prev-textrow'),
      numericRightDrift: Math.max(...alignment.map(column => drift(column.numbers))),
      unitStartDrift: Math.max(...alignment.map(column => drift(column.units))),
      minimumUnitGap: Math.min(...alignment.flatMap(column => column.gaps)),
    };
  });
}

test('the mobile driver library summary matches the wizard summary presentation', async ({page}) => {
  await page.setViewportSize({width: 412, height: 915});
  await forceMobileSkin(page);
  await page.goto('/');

  await page.getByText('New project').click();
  await page.getByText(DRIVER, {exact: true}).click();
  const wizardPreview = page.locator('.mob-np-library .preview');
  await expect(wizardPreview).toBeVisible();
  const wizardPresentation = await summaryPresentation(wizardPreview);
  await captureSummaryScreenshot(page, 'wizard.png');

  await page.locator('.mob-np-footer').getByRole('button', {name: 'Cancel'}).click();
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByRole('button', {name: 'Select driver'}).click();
  await page.locator('.dlist .ditem').filter({hasText: DRIVER}).click();
  const libraryPreview = page.locator('.driver-library.dl-phone .preview');
  await expect(libraryPreview).toBeVisible();
  const libraryPresentation = await summaryPresentation(libraryPreview);
  await captureSummaryScreenshot(page, 'library.png');

  expect(libraryPresentation).toEqual(wizardPresentation);
  for (const [context, presentation] of [['wizard', wizardPresentation], ['driver library', libraryPresentation]] as const) {
    expect(presentation.numericRightDrift, `${context} numeric values must align within each spec column`).toBeLessThanOrEqual(1);
    expect(presentation.unitStartDrift, `${context} units must align within each spec column`).toBeLessThanOrEqual(1);
    expect(presentation.minimumUnitGap, `${context} must leave a visible gap between each value and unit`).toBeGreaterThanOrEqual(4);
  }
});
