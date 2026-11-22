import {readFileSync} from 'node:fs';
import type {Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {ensureSampleProject} from '../fixtures/sampleProject.js';

/**
 * The phone Driver tab's driver-name button (BUG_20261108_phone-driver-name-button-overflows): a long
 * driver name ("SB Acoustics SB15BAC30-8-COAX/ aluminum") wraps inside the 374 px window, whole, and the full
 * name is the button's title (T736, AI live review 8 Nov).
 */
const LONG_MODEL = 'SB Acoustics SB15BAC30-8-COAX/ aluminum cone with a very long descriptive suffix';
const MX6_22_MODEL = 'MX6-22 6-1/2" Max-X High Excursion DVC Subwoofer Driver 2 Ohms Per Coil';
const SIZES = [{width: 374, height: 705}, {width: 390, height: 844}] as const;

async function openDriverTabWithModel(page: Page, model: string): Promise<void> {
  await forceMobileSkin(page);
  await page.goto('/');
  const project = readFileSync(ensureSampleProject(), 'utf8').replace(/("model"\s*:\s*\{\s*"value"\s*:\s*)"W5-1138SMF"/, (_all, head: string) => `${head}${JSON.stringify(model)}`);
  expect(project).toContain(model.split(' ')[0] ?? model);
  await page.locator('.mobile-root input[type=file]').setInputFiles({name: 'long-driver.owpr', mimeType: 'application/json', buffer: Buffer.from(project)});
  await page.locator('.mob-tabbar').waitFor({state: 'visible'});
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
}

test.describe('374 x 705', () => {
  test.use({viewport: {width: 374, height: 705}});

  test('a long driver name wraps inside the window and is the button title', async ({page}) => {
    await openDriverTabWithModel(page, LONG_MODEL);
    const button = page.locator('.mob-cname-button');
    await expect(button).toContainText('aluminum');
    const m = await button.evaluate(el => ({sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, right: el.getBoundingClientRect().right, title: el.getAttribute('title')}));
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    expect(m.sh).toBeLessThanOrEqual(m.ch);
    expect(m.right).toBeLessThanOrEqual(374);
    expect(m.title).toContain('aluminum');
  });
});

/**
 * BUG_20261115_phone-driver-name-button-clipped-under-header: the wrapped button grew past its fixed-height row (centred, so it grew
 * upward too): its first line sat under the header and its last line over the Select driver / Info / Edit buttons.
 * The row holds the whole button: nothing of it above the page's top or below the row, and the buttons row starts where the row ends.
 */
for (const size of SIZES) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({viewport: size});

    test('the driver name row holds the whole wrapped name: nothing above the page, nothing over the buttons below', async ({page}) => {
      await openDriverTabWithModel(page, MX6_22_MODEL);
      const button = page.locator('.mob-cname-button');
      await expect(button).toContainText('MX6-22');
      const rectOf = (selector: string) => page.locator(selector).first().evaluate(el => {
        const r = el.getBoundingClientRect();
        return {top: r.top, bottom: r.bottom};
      });
      const btn = await rectOf('.mob-cname-button');
      const row = await page.locator('.mob-cname-button').evaluate(el => {
        const r = (el.parentElement ?? el).getBoundingClientRect();
        return {top: r.top, bottom: r.bottom};
      });
      const page_ = await rectOf('.mob-classic');
      const buttons = await rectOf('.mob-cbtns');
      expect(btn.top, 'name button starts at or below the top of the page').toBeGreaterThanOrEqual(page_.top - 0.5);
      expect(btn.top, 'name button starts inside its row').toBeGreaterThanOrEqual(row.top - 0.5);
      expect(btn.bottom, 'name button ends inside its row').toBeLessThanOrEqual(row.bottom + 0.5);
      expect(row.bottom, 'the row ends before the Select driver / Info / Edit buttons').toBeLessThanOrEqual(buttons.top + 0.5);
    });
  });
}
