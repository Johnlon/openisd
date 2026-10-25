import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';
import {PhoneRowSizes} from '@openisd/design/fields';

/**
 * Screen 19, the Project sheet (PHONE_CLASSIC_BUILD_SPEC §4, mock box-combined-live.html?ov=project):
 * a "Project details" band with a ?, then Name, Creator, Created and Modified rows and a Description
 * box, and a Close button. Rows are the classic depth; nothing is cut or scrolls sideways.
 */
const ROW_PX = PhoneRowSizes.CLASSIC.rowMinPx;

for (const size of PHONE_SIZES) {
  test.describe(`Project sheet at ${size.width}×${size.height}`, () => {
    test.beforeEach(async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await page.locator('.mob-hamburger').click();
      await page.getByText('Project details').click();
    });

    test('shows the Project details band with a ?, the four rows and the notes box', async ({page}) => {
      const dlg = page.locator('.mob-dlg');
      await expect(dlg.locator('.mob-dlg-title')).toHaveText('Project');
      const band = dlg.locator('.mob-band');
      await expect(band).toHaveCount(1);
      await expect(band).toContainText('Project details');
      await expect(band.locator('.mob-band-help')).toBeVisible();
      for (const label of ['Name', 'Creator', 'Created', 'Modified', 'Description']) {
        await expect(dlg.locator('.mob-crow-label', {hasText: new RegExp(`^${label}$`)})).toBeVisible();
      }
      await expect(dlg.getByRole('button', {name: 'Close', exact: true}).last()).toBeVisible();
    });

    test('the band is 28 px, the rows are the classic depth, the boxes share one left edge', async ({page}) => {
      const dlg = page.locator('.mob-dlg');
      const band = await dlg.locator('.mob-band').boundingBox();
      expect(Math.abs((band?.height ?? 0) - 28)).toBeLessThanOrEqual(0.5);
      const rows = dlg.locator('.mob-crow:not(.mob-crow-notes)');
      await expect(rows).toHaveCount(4);
      for (const h of await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) {
        expect(Math.abs(h - ROW_PX), `row height ${h}`).toBeLessThanOrEqual(0.5);
      }
      const lefts = await dlg.locator('.mob-crow input').evaluateAll(els => els.map(e => e.getBoundingClientRect().left));
      for (const l of lefts) expect(Math.abs(l - lefts[0])).toBeLessThanOrEqual(0.5);
    });

    test('nothing is cut, nothing scrolls sideways, every control is on screen', async ({page}) => {
      const result = await page.evaluate(() => {
        const dlg = document.querySelector('.mob-dlg');
        const els = [...(dlg?.querySelectorAll<HTMLElement>('label, input, textarea, button') ?? [])];
        return {
          page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          cut: els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.id || e.className),
          outside: els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > window.innerWidth + 0.5); }).length,
          below: els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > window.innerHeight + 0.5; }).length,
        };
      });
      expect(result.page).toBe(false);
      expect(result.cut).toEqual([]);
      expect(result.outside).toBe(0);
      expect(result.below).toBe(0);
    });

    test('the ? opens the section help and Close puts it away', async ({page}) => {
      await page.locator('.mob-dlg .mob-band-help').click();
      const help = page.getByRole('dialog', {name: 'Help: Project details'});
      await expect(help).toContainText('The project name and notes.');
      await help.getByRole('button', {name: 'Close help'}).click();
      await expect(help).toHaveCount(0);
    });
  });
}
