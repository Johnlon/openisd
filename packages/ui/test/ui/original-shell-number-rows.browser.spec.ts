import type {Locator, Page} from '@playwright/test';
import {expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';

/** The two number boxes that used to be hand-built in OriginalShell.vue: the Signal Generator Hz box and
 *  the sealed alignment dialog Volume are field rows with ▲▼ step buttons (BUG_20261005_no-common-ui-field-component). */

test.beforeEach(async ({appPage: page}) => {
  await page.goto('/');
  await openAProject(page);
});

/** True when the element has no hidden overflow on either axis. */
async function noOverflow(target: Locator): Promise<{sw: number; cw: number; sh: number; ch: number}> {
  return target.evaluate(el => ({sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight}));
}

async function expectFits(page: Page, selector: string): Promise<void> {
  const m = await noOverflow(page.locator(selector).first());
  expect(m.sw, `${selector} scrollWidth ${m.sw} vs clientWidth ${m.cw}`).toBeLessThanOrEqual(m.cw);
  expect(m.sh, `${selector} scrollHeight ${m.sh} vs clientHeight ${m.ch}`).toBeLessThanOrEqual(m.ch);
}

test.describe('Signal Generator Hz', () => {
  const row = (page: Page) => page.locator('.signal-gen-row .ui-field');

  test('is a field row with step buttons, and ▲ changes the shown value', async ({appPage: page}) => {
    await expect(page.locator('.signal-gen-row input[type=number]')).toHaveCount(0);
    await expect(row(page).locator('.num-stepper-btn')).toHaveCount(2);
    const box = row(page).locator('input');
    const before = await box.inputValue();
    await row(page).locator('.num-stepper-btn').first().click();
    await expect(box).not.toHaveValue(before);
    // The frequency lives in the shared worker page between tests: put it back as a user would.
    await row(page).locator('.num-stepper-btn').nth(1).click();
    await expect(box).toHaveValue(before);
  });

  test('an emptied box is refused: never blank or 0 once left', async ({appPage: page}) => {
    const box = row(page).locator('input');
    const before = await box.inputValue();
    await box.fill('');
    await box.press('Tab');
    await expect(box).not.toHaveValue('0');
    // The box keeps the refused text until Esc; the stored frequency never changed.
    await box.focus();
    await box.press('Escape');
    await expect(box).toHaveValue(before);
  });

  for (const [width, height] of [[1880, 1000], [1280, 800]] as const) {
    test(`fits the left panel at ${width}x${height}`, async ({appPage: page}) => {
      await page.setViewportSize({width, height});
      await expectFits(page, '.quad-signalgen-wrap');
      await expectFits(page, '.signal-gen-row');
      const m = await noOverflow(page.locator('.signal-gen-row'));
      console.log(`signal-gen-row ${width}x${height}: scrollWidth ${m.sw} clientWidth ${m.cw}`);
      const inside = await page.locator('.signal-gen-row .ui-field').evaluate(el => {
        const r = el.getBoundingClientRect();
        const p = el.closest('.signal-gen-row')!.getBoundingClientRect();
        return r.right <= p.right + 1 && r.left >= p.left - 1;
      });
      expect(inside).toBe(true);
    });
  }
});

test.describe('Sealed alignment dialog Volume', () => {
  async function openDialog(page: Page): Promise<Locator> {
    await setFocusedBoxType(page, 'sealed');
    await page.locator('.project-nav li', {hasText: 'Box'}).click();
    await page.getByRole('button', {name: 'Alignment', exact: true}).click();
    await expect(page.locator('.alignment-modal')).toBeVisible();
    return page.locator('.alignment-modal');
  }

  test('has step buttons, ▲ changes the volume, typing applies it', async ({appPage: page}) => {
    const dialog = await openDialog(page);
    const box = dialog.locator('#og-sealed-alignment-volume');
    await expect(dialog.locator('input[type=number]')).toHaveCount(0);
    await expect(dialog.locator('.ui-field .num-stepper-btn')).toHaveCount(2);
    const before = await box.inputValue();
    await dialog.locator('.ui-field .num-stepper-btn').first().click();
    await expect(box).not.toHaveValue(before);
    await box.click();   // a box takes its caret on the last digit when focused; click first, then replace the whole value
    await box.fill('42');
    await box.press('Tab');
    await expect(box).toHaveValue(/^42(\.0+)?$/);
    await dialog.locator('button.ok-btn').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#og-box-volume')).toHaveValue(/^42(\.0+)?$/);
  });

  test('an emptied volume is refused: Accept keeps the last good volume', async ({appPage: page}) => {
    const dialog = await openDialog(page);
    const box = dialog.locator('#og-sealed-alignment-volume');
    await box.fill('');
    await box.press('Tab');
    await expect(box).not.toHaveValue('0');
    await dialog.locator('button.ok-btn').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#og-box-volume')).not.toHaveValue('');
    await expect(page.locator('#og-box-volume')).not.toHaveValue('0');
  });

  for (const [width, height] of [[1880, 1000], [1280, 800]] as const) {
    test(`fits at ${width}x${height}`, async ({appPage: page}) => {
      await page.setViewportSize({width, height});
      const dialog = await openDialog(page);
      const m = await noOverflow(dialog.locator('.modal-body'));
      console.log(`alignment modal-body ${width}x${height}: scrollWidth ${m.sw} clientWidth ${m.cw}`);
      expect(m.sw).toBeLessThanOrEqual(m.cw);
      expect(m.sh).toBeLessThanOrEqual(m.ch);
      const inside = await dialog.locator('.ui-field').evaluate(el => {
        const r = el.getBoundingClientRect();
        const p = el.closest('.modal-body')!.getBoundingClientRect();
        return r.right <= p.right + 1;
      });
      expect(inside).toBe(true);
    });
  }
});
