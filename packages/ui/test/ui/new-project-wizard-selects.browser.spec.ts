import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

/**
 * The New project wizard's pick lists and footer buttons look as they did in 7.0.951 where T365 did
 * not mean to change them: the phone pick lists use the page's 15 px text (not 18 px), the desktop
 * pick lists keep their old widths and fill their field column, and Back / Next / Cancel are one size.
 * T365's own sizes stay: footer buttons are at least 84x30 on the desktop.
 * (T421, review of the changes since 7.0.951, row 15.)
 */

const TEST_DRIVER = 'Tang Band W5-1138SMF';

/** Each pick list on steps 2 to 4, and the width it had on the desktop in 7.0.951. */
const PICKS = [
  {step: 2, box: 'sealed', id: 'np-ndrivers', desktopWidth: 180},
  {step: 2, box: 'sealed', id: 'np-wiring', desktopWidth: 180},
  {step: 3, box: 'sealed', id: 'np-box-type', desktopWidth: 240},
  {step: 4, box: 'sealed', id: 'np-alignment', desktopWidth: 260},
  {step: 4, box: 'vented', id: 'np-vented-alignment', desktopWidth: 260},
] as const;

const PHONE_SELECT_FONT = '15px';

async function toStep(page: Page, mobile: boolean, step: number, box: string): Promise<void> {
  if (mobile) await page.getByText('New project').first().click();
  else await page.locator('.tb-btn[title*="New project"]').click();
  const root = mobile ? page.locator('.mob-np-body') : page.locator('.overlay.open .modal-body');
  const footer = mobile ? page.locator('.mob-np-footer') : page.locator('.overlay.open .modal-footer');
  const next = footer.getByText(mobile ? 'Next ▸' : 'Next', {exact: true});
  await page.locator('.driver-library input.filter').fill('W5-1138SMF');
  await root.getByText(TEST_DRIVER).first().click();
  await next.click();
  for (let at = 2; at < step; at++) {
    await next.click();
    if (at === 2) await page.locator('#np-box-type').selectOption(box);
  }
  if (!mobile) await expect(page.locator('.np-step')).toContainText(`Step ${step} of 5`);   // the phone's step bar shows the title only
}

/** What one skin looks like in 7.0.951: the pick list text size and widths. */
interface Skin {
  readonly name: string;
  readonly mobile: boolean;
  readonly footer: string;
  /** The smallest footer button: T365's 84x30 on the desktop; the phone's buttons fill the footer. */
  readonly minButton: {readonly w: number; readonly h: number};
}
const SKINS: readonly Skin[] = [
  {name: 'Desktop', mobile: false, footer: '.overlay.open .modal-footer', minButton: {w: 84, h: 30}},
  {name: 'Pixel 9', mobile: true, footer: '.mob-np-footer', minButton: {w: 0, h: 0}},
];

async function measure(page: Page, id: string): Promise<{font: string; width: number; column: number}> {
  return page.locator(`#${id}`).evaluate(el => {
    // The classic phone row (label | pick list): the pick list fills to the ▲▼ column, a wide one to the row's edge.
    const row = el.closest('.mob-crow');
    const label = row?.querySelector('.mob-crow-label');
    let phone: number | null = null;
    if (row && label) {
      const cs = getComputedStyle(row);
      const content = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const stepper = el.classList.contains('mob-cselect-wide') ? 0 : parseFloat(cs.getPropertyValue('--mob-col-stepper'));
      phone = content - (row.classList.contains('mob-crow-stack') ? 0 : label.getBoundingClientRect().width) - stepper;
    }
    return {
      font: getComputedStyle(el).fontSize,
      width: el.getBoundingClientRect().width,
      column: phone ?? el.closest('.ui-field-value')?.getBoundingClientRect().width ?? 0,
    };
  });
}

for (const skin of SKINS) {
  test.describe(`${skin.name} wizard pick lists and footer`, () => {
    if (skin.mobile) test.use({viewport: PIXEL_9});

    test.beforeEach(async ({page}) => {
      if (skin.mobile) await forceMobileSkin(page);
      await page.goto('/');
    });

    for (const {step, box, id} of PICKS) {
      test(`${id} fills its field column`, async ({page}) => {
        await toStep(page, skin.mobile, step, box);
        const m = await measure(page, id);
        expect(m.width, `${id} is as wide as its field column`).toBeCloseTo(m.column, 0);
      });
    }

    test('Back, Next and Cancel are one size, at least T365\'s', async ({page}) => {
      await toStep(page, skin.mobile, 4, 'sealed');
      const footer = page.locator(skin.footer);
      const sizes = await footer.locator('button').evaluateAll(els => els.map(el => {
        const b = el.getBoundingClientRect();
        return {w: Math.round(b.width), h: Math.round(b.height)};
      }));
      expect(sizes).toHaveLength(3);
      expect(new Set(sizes.map(b => `${b.w}x${b.h}`)).size, `button sizes: ${JSON.stringify(sizes)}`).toBe(1);
      expect(sizes[0]?.w).toBeGreaterThanOrEqual(skin.minButton.w);
      expect(sizes[0]?.h).toBeGreaterThanOrEqual(skin.minButton.h);
    });
  });
}

test.describe('Desktop wizard pick list widths', () => {
  test.beforeEach(async ({page}) => { await page.goto('/'); });

  for (const {step, box, id, desktopWidth} of PICKS) {
    test(`${id} is ${desktopWidth}px wide, as in 7.0.951`, async ({page}) => {
      await toStep(page, false, step, box);
      expect((await measure(page, id)).width).toBeCloseTo(desktopWidth, 0);
    });
  }
});

test.describe('Pixel 9 wizard pick list text', () => {
  test.use({viewport: PIXEL_9});

  test.beforeEach(async ({page}) => { await forceMobileSkin(page); await page.goto('/'); });

  for (const {step, box, id} of PICKS) {
    test(`${id} text is ${PHONE_SELECT_FONT}, as in 7.0.951`, async ({page}) => {
      await toStep(page, true, step, box);
      expect((await measure(page, id)).font).toBe(PHONE_SELECT_FONT);
    });
  }
});
