import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureSummaryContent} from '../fixtures/fieldVisualContract.js';
import {SCREENS} from '../visual/screens.js';
import type {Page} from '@playwright/test';

const cases = [
  {skin: 'mobile', width: 360, height: 740},
  {skin: 'mobile', width: 374, height: 705},
  {skin: 'mobile', width: 412, height: 915},
  {skin: 'mobile', width: 375, height: 667},
  {skin: 'mobile', width: 390, height: 844},
  {skin: 'mobile', width: 430, height: 932},
  {skin: 'desktop', width: 1280, height: 900},
] as const;

async function openWizard(page: Page, skin: 'mobile' | 'desktop'): Promise<void> {
    if (skin === 'mobile') await forceMobileSkin(page);
    await page.goto('/');
    if (skin === 'mobile') {
      await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await page.locator('.mob-hamburger').click();
      await page.getByRole('button', {name: 'New project', exact: true}).click();
    } else {
      await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await page.locator('.tb-btn[title*="New project"]').click();
    }
}

for (const size of cases) {
  test(`driver summary glyphs and route parity ${size.skin} ${size.width}`, async ({page}) => {
    await page.setViewportSize(size);
    await openWizard(page, size.skin);
    await page.getByText('Tang Band W5-1138SMF', {exact: true}).click();
    const preview = page.locator('.driver-library .preview:visible');
    const read = async () => {
      const report = await preview.evaluate(measureSummaryContent);
      expect(report.rows, 'the actual driver specification rows are mounted').toBeGreaterThan(10);
      expect(report.controls).toBe(report.rows);
      expect(report.issues).toEqual([]);
      return preview.evaluate(root => {
        const row = root.querySelector('.spec-row')!;
        const label = root.querySelector('.prev-src-lbl')!;
        return {rowWidth: row.getBoundingClientRect().width, metadataFont: getComputedStyle(label).font, rowFont: getComputedStyle(row).font, background: getComputedStyle(root).backgroundColor};
      });
    };
    const wizard = await read();
    await page.locator(size.skin === 'mobile' ? '.mob-np-footer' : '.overlay.open .modal-footer').getByRole('button', {name: 'Cancel', exact: true}).click();
    await page.locator(size.skin === 'mobile' ? '.mob-tab' : '.project-nav li').filter({hasText: /^Driver$/}).click();
    await page.getByRole('button', {name: /^Select driver$/i}).click();
    await page.getByText('Tang Band W5-1138SMF', {exact: true}).click();
    const library = await read();
    expect(Math.abs(wizard.rowWidth - library.rowWidth), 'the same driver information has the same column geometry on both routes').toBeLessThanOrEqual(2);
    expect(library.metadataFont).toBe(wizard.metadataFont);
    expect(library.rowFont).toBe(wizard.rowFont);
    expect(library.background).toBe(wizard.background);
  });
}

for (const screen of SCREENS.filter(screen => screen.name !== 'empty' && screen.name !== 'menu')) {
  test(`shared summary glyph contract ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await screen.open(page);
    const report = await page.locator('body').evaluate(measureSummaryContent);
    expect(report.controls, 'every mounted summary row is measured').toBe(report.rows);
    expect(report.issues).toEqual([]);
  });
}
