import {expect, openAProject, test} from '../fixtures.js';
import {DesktopLabels} from '@openisd/design/fields';
import type {Locator, Page} from '@playwright/test';

/**
 * QO269: the desktop (Original) skin has the phone's help. A ? on each section band opens that
 * band's help in a panel down the right side; Filters, Advanced and Project have no bands, so their
 * ? sits at the top of the right-hand column and opens help for the whole tab. The New project
 * wizard has the phone's ⓘ popups beside Placement and EBP.
 * Layout: at the smallest laptop sizes nothing is clipped, nothing scrolls, and the bottom panel keeps its height.
 */

const SIZES = [{width: 1024, height: 768}, {width: 1280, height: 720}];
const BOX_TYPES = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'];
/** Help lines whose label is deliberately not a caption on the tab: the port shape button shows the word Round or Slotted, so its help line is captioned Shape (QO429.c4). */
const CAPTION_EXCEPTIONS: ReadonlySet<string> = new Set([DesktopLabels.VENT_SHAPE]);
const tabLink = (page: Page, name: string): Locator => page.locator('.project-nav li', {hasText: new RegExp(`^${name}$`)});

/**
 * The ?s add no scrollbar and no clipping: the active tab section's scroll size, and the page's, are the same
 * with the ?s as with them hidden. (Some tabs already scroll sideways at 1024 wide; that is not this change.)
 */
async function expectHelpAddsNoScroll(page: Page, what: string): Promise<void> {
  const measure = () => page.evaluate(() => {
    const section = document.querySelector('.tab-section.active');
    const panel = document.querySelector('.content-panel');
    if (section === null || panel === null) throw new Error('no active tab');
    const root = document.documentElement;
    return {
      sectionW: section.scrollWidth, sectionH: section.scrollHeight, clientW: section.clientWidth, clientH: section.clientHeight,
      pageScrolls: root.scrollWidth > root.clientWidth || root.scrollHeight > root.clientHeight,
      panelHeight: Math.round(panel.getBoundingClientRect().height),
    };
  });
  const withHelp = await measure();
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'hide-help-buttons';
    style.textContent = '.desk-band-help, .tab-help-btn { display: none !important; }';
    document.head.append(style);
  });
  const without = await measure();
  await page.evaluate(() => { document.getElementById('hide-help-buttons')?.remove(); });
  expect(withHelp, `${what}: the ?s change the scroll size or the panel height`).toEqual(without);
  expect(withHelp.pageScrolls, `${what}: the page scrolls`).toBe(false);
}

async function panelHeight(page: Page): Promise<number> {
  return Math.round((await page.locator('.content-panel').boundingBox())!.height);
}

for (const size of SIZES) {
  test.describe(`Desktop help at ${size.width}x${size.height}`, () => {
    test.use({viewport: size});

    test.beforeEach(async ({page}) => {
      await page.goto('/');
      await openAProject(page);
    });

    // [tab, the band titles that each have a ?]
    const BANDED: ReadonlyArray<readonly [string, readonly string[]]> = [
      ['Box', ['Rear chamber']],
      ['Driver', ['Placement', 'Advanced options']],
      ['Signal', ['Listening place', 'Signal source']],
    ];
    for (const [tab, bands] of BANDED) {
      test(`${tab}: each band's ? opens that band's help on the right, nothing is clipped`, async ({page}) => {
        await tabLink(page, tab).click();
        const before = await panelHeight(page);
        for (const band of bands) {
          const help = page.locator('.tab-section.active').getByRole('button', {name: `Help: ${band}`});
          await expect(help).toBeVisible();
          const bandBox = await help.locator('xpath=..').boundingBox();
          const helpBox = await help.boundingBox();
          expect(helpBox!.x + helpBox!.width, `${band}: the ? is inside its band`).toBeLessThanOrEqual(bandBox!.x + bandBox!.width + 0.5);
          expect(bandBox!.height, `${band}: the band stays a thin row`).toBeLessThanOrEqual(26);
          await help.click();
          const panel = page.getByRole('dialog', {name: `Help: ${band}`});
          await expect(panel).toBeVisible();
          const p = await panel.boundingBox();
          expect(p!.x + p!.width, `${band}: help panel is on screen`).toBeLessThanOrEqual(size.width);
          expect(p!.x, `${band}: help panel is on the right`).toBeGreaterThan(size.width / 2);
          await expect(panel).toContainText(/\w+:/);
          await panel.getByRole('button', {name: 'Close help'}).click();
          await expect(panel).toBeHidden();
        }
        expect(await panelHeight(page), `${tab}: panel height`).toBe(before);
        await expectHelpAddsNoScroll(page, tab);
      });
    }

    // Every box type, every tab: the ?s add no scroll, the panel keeps its height, and every help line is
    // labelled with the caption its row has on the screen.
    for (const box of BOX_TYPES) {
      test(`${box}: every tab's help lines carry the on-screen captions, and nothing scrolls or moves`, async ({page}) => {
        await tabLink(page, 'Box').click();
        await page.locator('#og-box-type').selectOption(box);
        const tabCount = await page.locator('.project-nav li').count();
        for (let i = 0; i < tabCount; i++) {
          const link = page.locator('.project-nav li').nth(i);
          const tab = ((await link.textContent()) ?? '').trim();
          await link.click();
          const section = page.locator('.tab-section.active');
          const before = await panelHeight(page);
          const captions = new Set(await section.evaluate(s => [...s.querySelectorAll('label, button, .desk-band-title')]
            .map(e => (e.textContent ?? '').replace(/^⚠\s*/, '').replace(/≠W$/, '').replace(/\s+/g, ' ').trim())));
          const helpLabels: string[] = [];
          const bands = await section.locator('.desk-band-help').count();
          for (let b = 0; b < bands; b++) {
            await section.locator('.desk-band-help').nth(b).click();
            helpLabels.push(...await page.locator('.desk-help-row b').allTextContents());
            await page.getByRole('button', {name: 'Close help'}).click();
          }
          for (const tabHelp of await page.locator('.save-rail .tab-help-btn').all()) {
            await tabHelp.click();
            helpLabels.push(...await page.locator('.desk-help-row b').allTextContents());
            await page.getByRole('button', {name: 'Close help'}).click();
          }
          for (const label of helpLabels.map(raw => raw.replace(/:$/, '')).filter(l => !CAPTION_EXCEPTIONS.has(l))) {
            expect(captions.has(label), `${box} / ${tab}: help line "${label}" is not a caption on that tab`).toBe(true);
          }
          expect(await panelHeight(page), `${box} / ${tab}: panel height`).toBe(before);
          await expectHelpAddsNoScroll(page, `${box} / ${tab}`);
        }
      });
    }

    test('Vented: the Vents tab band has a ?', async ({page}) => {
      await tabLink(page, 'Vented').click();
      await page.locator('.tab-section.active').getByRole('button', {name: 'Help: Vents'}).click();
      await expect(page.getByRole('dialog', {name: 'Help: Vents'})).toContainText('Vent diameter');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', {name: 'Help: Vents'})).toBeHidden();
      await expectHelpAddsNoScroll(page, 'Vents');
    });

    for (const tab of ['Filters', 'Advanced', 'Project']) {
      test(`${tab}: the tab's ? sits in the right column and opens help for the tab`, async ({page}) => {
        await tabLink(page, tab).click();
        const before = await panelHeight(page);
        const q = page.locator('.save-rail').getByRole('button', {name: 'Help: this tab'});
        await expect(q).toBeVisible();
        await q.click();
        const panel = page.locator('.desk-help');
        await expect(panel).toBeVisible();
        await expect(panel).toContainText(/\w+:|\w\./);
        await panel.getByRole('button', {name: 'Close help'}).click();
        await expect(panel).toBeHidden();
        expect(await panelHeight(page), `${tab}: panel height`).toBe(before);
        await expectHelpAddsNoScroll(page, tab);
      });
    }

    test('Box and Driver tabs have no tab-level ?', async ({page}) => {
      for (const tab of ['Box', 'Driver', 'Signal']) {
        await tabLink(page, tab).click();
        await expect(page.locator('.save-rail').getByRole('button', {name: 'Help: this tab'})).toHaveCount(0);
      }
    });

    test('the New project wizard has an ⓘ beside Placement and EBP that opens a card and closes', async ({page}) => {
      await page.locator('.tb-btn[title*="New project"]').click();
      const root = page.locator('.overlay.open .modal-body');
      const next = page.locator('.overlay.open .modal-footer').getByText('Next', {exact: true});
      await root.getByText('Tang Band W5-1138SMF').first().click();
      await next.click();
      await page.getByRole('button', {name: 'About driver placement'}).click();
      const card = page.getByRole('dialog', {name: 'Driver placement'});
      await expect(card).toBeVisible();
      const c = await card.boundingBox();
      expect(c!.x >= 0 && c!.x + c!.width <= size.width && c!.y >= 0 && c!.y + c!.height <= size.height, 'placement card on screen').toBe(true);
      await card.getByRole('button', {name: 'Close'}).click();
      await expect(card).toBeHidden();
      await next.click();
      await page.getByRole('button', {name: 'About EBP'}).click();
      const ebp = page.getByRole('dialog', {name: /Efficiency bandwidth product|EBP/i});
      await expect(ebp).toContainText('Your driver: EBP');
      await page.keyboard.press('Escape');
      await expect(ebp).toBeHidden();
      await expect(page.locator('.overlay.open .modal')).toBeVisible();
    });
  });
}
