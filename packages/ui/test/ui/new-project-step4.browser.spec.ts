import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

/**
 * Step 4 of the New project wizard, on both skins: every box type has it, and it holds the box's
 * volume and tuning as field rows (▲▼ on every number box), none cut off or scrolling sideways.
 * (John, 17 Oct 2026: "step 4 for every box type".)
 */

interface StepFour {
  readonly box: string;
  /** The ids of the number boxes on the page, in order. */
  readonly inputs: readonly string[];
  readonly label: string;
}

const STEP_FOURS: readonly StepFour[] = [
  {box: 'sealed', inputs: ['np-sealed-volume'], label: 'Sealed Alignment'},
  {box: 'vented', inputs: ['np-vented-volume', 'np-vented-tuning'], label: 'Vented Alignment'},
  {box: 'box-passive-radiator', inputs: ['np-starting-volume'], label: 'Passive Radiator'},
  {box: 'bandpass4', inputs: ['np-rear-volume', 'np-front-volume', 'np-front-tuning'], label: 'Chambers'},
  {box: 'bandpass6', inputs: ['np-rear-volume', 'np-rear-tuning', 'np-front-volume', 'np-front-tuning'], label: 'Chambers'},
  {box: 'abc', inputs: ['np-rear-volume', 'np-rear-tuning', 'np-front-volume', 'np-front-tuning'], label: 'Chambers'},
];

const TEST_DRIVER = 'Tang Band W5-1138SMF';

async function toStepFour(page: Page, mobile: boolean, box: string): Promise<void> {
  if (mobile) await page.getByText('New project').first().click();
  else await page.locator('.tb-btn[title*="New project"]').click();
  const root = mobile ? page.locator('.mob-np-body') : page.locator('.overlay.open .modal-body');
  const footer = mobile ? page.locator('.mob-np-footer') : page.locator('.overlay.open .modal-footer');
  const next = footer.getByText(mobile ? 'Next ▸' : 'Next', {exact: true});
  await root.getByText(TEST_DRIVER).first().click();
  await next.click();
  await next.click();
  await page.locator('#np-box-type').selectOption(box);
  await next.click();
}

for (const mobile of [false, true]) {
  test.describe(`${mobile ? 'Phone' : 'Desktop'} wizard`, () => {
    if (mobile) test.use({viewport: PIXEL_9});

    test.beforeEach(async ({page}) => {
      if (mobile) await forceMobileSkin(page);
      await page.goto('/');
    });

    for (const {box, inputs, label} of STEP_FOURS) {
      test(`${box}: step 4 holds ${inputs.length} number box(es), each with arrows, and nothing runs off the screen`, async ({page}) => {
        await toStepFour(page, mobile, box);
        // The phone's step bar shows the title only (screen 25); the desktop shows the step number too.
        await expect(page.locator('.np-step')).toContainText(mobile ? label : `Step 4 of 5 — ${label}`);
        for (const id of inputs) {
          const input = page.locator(`#${id}`);
          await expect(input, `${id} is on step 4`).toBeVisible();
          await expect(input.locator('xpath=ancestor::*[contains(@class,"ui-field")][1]').locator('.num-stepper-btn')).toHaveCount(2);
          const box_ = await input.boundingBox();
          const viewport = page.viewportSize();
          expect(box_ !== null && viewport !== null && box_.x >= 0 && box_.x + box_.width <= viewport.width, `${id} fits the width`).toBe(true);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflow, 'the page scrolls sideways').toBe(false);
      });
    }
  });
}
