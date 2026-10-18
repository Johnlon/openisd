import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

/**
 * Step 4 of the New project wizard, every box type, desktop and Pixel 9: each row (a pick list or a
 * number) has its label at one left edge and its control at one left edge, and every control is the
 * same height, so the page reads as one column. The arrows are one size on all the number boxes.
 * (John, 17 Oct 2026: "check the field width and height, alignment and button sizes".)
 */

/** Each box type and how many label columns its step 4 has on the desktop: the chambers sit side by side. */
const BOX_TYPES = [
  {box: 'sealed', desktopColumns: 1}, {box: 'vented', desktopColumns: 1}, {box: 'box-passive-radiator', desktopColumns: 1},
  {box: 'bandpass4', desktopColumns: 2}, {box: 'bandpass6', desktopColumns: 2}, {box: 'abc', desktopColumns: 2},
] as const;
const TEST_DRIVER = 'Tang Band W5-1138SMF';

async function toStepFour(page: Page, mobile: boolean, box: string): Promise<void> {
  if (mobile) await page.getByText('New project').first().click();
  else await page.locator('.tb-btn[title*="New project"]').click();
  const root = mobile ? page.locator('.mob-np-body') : page.locator('.overlay.open .modal-body');
  const footer = mobile ? page.locator('.mob-np-footer') : page.locator('.overlay.open .modal-footer');
  const next = footer.getByText('Next', {exact: true});
  await root.getByText(TEST_DRIVER).first().click();
  await next.click();
  await next.click();
  await page.locator('#np-box-type').selectOption(box);
  await next.click();
  await expect(page.locator('.np-step')).toContainText('Step 4 of 5');
}

interface Edges { readonly id: string; readonly labelLeft: number; readonly controlLeft: number; readonly height: number }

/** Every pick list and text/number box on the step, with its label's and its own left edge and its height. */
async function rows(page: Page): Promise<Edges[]> {
  const controls = page.locator('.step-content select, .step-content input[type=text], .step-content input:not([type])');
  const count = await controls.count();
  const out: Edges[] = [];
  for (let i = 0; i < count; i++) {
    const control: Locator = controls.nth(i);
    const id = await control.getAttribute('id');
    expect(id, 'every control on step 4 has an id, so its label can be tied to it').not.toBeNull();
    const label = page.locator(`.step-content label[for="${id}"]`);
    await expect(label, `${id} has a label`).toHaveCount(1);
    const l = await label.boundingBox();
    const c = await control.boundingBox();
    if (l === null || c === null) continue;
    out.push({id: id ?? '', labelLeft: l.x, controlLeft: c.x, height: c.height});
  }
  return out;
}

for (const mobile of [false, true]) {
  test.describe(`${mobile ? 'Pixel 9' : 'Desktop'} wizard step 4`, () => {
    if (mobile) test.use({viewport: PIXEL_9});

    test.beforeEach(async ({page}) => {
      if (mobile) await forceMobileSkin(page);
      await page.goto('/');
    });

    for (const {box, desktopColumns} of BOX_TYPES) {
      test(`${box}: one label column, one control left edge, one control height`, async ({page}) => {
        await toStepFour(page, mobile, box);
        const r = await rows(page);

        expect(r.length, 'step 4 has controls').toBeGreaterThan(0);
        // Chambers are two side-by-side columns on desktop: each column is one column of its own.
        const columns = new Map<number, Edges[]>();
        for (const e of r) columns.set(Math.round(e.labelLeft), [...(columns.get(Math.round(e.labelLeft)) ?? []), e]);
        for (const e of r) {
          expect(e.controlLeft - e.labelLeft, `${e.id}: same label-to-control distance as ${r[0]?.id}`).toBeCloseTo((r[0]?.controlLeft ?? 0) - (r[0]?.labelLeft ?? 0), 0);
          expect(e.height, `${e.id}: same height as ${r[0]?.id}`).toBeCloseTo(r[0]?.height ?? 0, 0);
        }
        expect(columns.size, `${box}: label columns`).toBe(mobile ? 1 : desktopColumns);
      });

      test(`${box}: the arrows are one size on every number box`, async ({page}) => {
        await toStepFour(page, mobile, box);
        const sizes = await page.locator('.step-content .num-stepper-btn').evaluateAll(els => els.map(el => {
          const b = el.getBoundingClientRect();
          return `${Math.round(b.width)}x${Math.round(b.height)}`;
        }));
        expect(sizes.length, 'there are arrows').toBeGreaterThan(0);
        expect(new Set(sizes).size, `arrow sizes: ${sizes.join(', ')}`).toBe(1);
      });
    }
  });
}
