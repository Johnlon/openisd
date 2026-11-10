import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, test} from '../fixtures.js';
import {PhoneRowColumns} from '@openisd/design/fields';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

// T720: on the phone Signal tab the typing input of each number box is 60% of its old width.
// Measured at 374x705 before the change: 186 px (input with its unit chip inside). 60% of 186 = 111.6.
// T742 widened the label column: the Signal column is now 145 px and the share 77%, so the Signal box stays 112 px.
const BOX_TAB_INPUT_WIDTH_PX = 145;
const EXPECTED_WIDTH_PX = BOX_TAB_INPUT_WIDTH_PX * PhoneRowColumns.SIGNAL_INPUT_SHARE;

test.use({viewport: {width: 374, height: 705}});

test('Signal tab number boxes are 60% of their old width, unclipped, one left edge', async ({appPage: page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab', {hasText: 'Signal'}).click();
  await expect(page.locator('.mob-band-title').first()).toHaveText('Signal');

  // The normal gap between a box and its arrows, read from the Box tab (not changed by T720).
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
  const normalGap = await page.locator('.mob-classic .ui-field').first().evaluate(f =>
    f.querySelector('.num-stepper')!.getBoundingClientRect().left - f.querySelector('input')!.getBoundingClientRect().right);
  await page.locator('.mob-tab', {hasText: 'Signal'}).click();
  const inputs = page.locator('.mob-classic .ui-field-value input');
  const count = await inputs.count();
  expect(count).toBeGreaterThanOrEqual(3);
  const lefts: number[] = [];
  for (let i = 0; i < count; i++) {
    const m = await inputs.nth(i).evaluate(el => ({
      width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left,
      scroll: el.scrollWidth, client: el.clientWidth,
    }));
    expect(m.width).toBeCloseTo(EXPECTED_WIDTH_PX, 0);
    const chip = await page.locator('.mob-classic .ui-field-unit').nth(i).evaluate(el => el.getBoundingClientRect().right);
    expect(chip, 'unit chip stays on the box right edge').toBeCloseTo(m.left + m.width, 0);
    const arrow = await page.locator('.mob-classic .num-stepper').nth(i).evaluate(el => el.getBoundingClientRect().left);
    expect(arrow - (m.left + m.width), 'arrows follow the narrower box with the normal gap').toBeCloseTo(normalGap, 0);
    expect(m.scroll).toBe(m.client);
    lefts.push(m.left);
  }
  expect(new Set(lefts.map(Math.round)).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
