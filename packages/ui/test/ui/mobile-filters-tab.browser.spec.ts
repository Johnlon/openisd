/**
 * The mobile Filters tab (PHONE_CLASSIC_BUILD_SPEC screen 10): a card per filter with standard field
 * rows, a one-line chip carousel, filter frequencies in whole hertz. The filter chain itself is the
 * desktop's logic (OriginalFilters); its own spec files cover how it behaves.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {PHONE_FILTER_CHIPS, PhoneRowSizes} from '@openisd/design/fields';

test.beforeEach(async ({ appPage: page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Filters' }).click();
});

test('shows the quick-add row and an empty list with no filters yet', async ({ appPage: page }) => {
  await expect(page.getByText('+ LP', { exact: true })).toBeVisible();
  await expect(page.getByText('No filters active.')).toBeVisible();
});

test('adding a filter opens its editor immediately, and it survives switching tabs', async ({ appPage: page }) => {
  await page.getByText('+ LP', { exact: true }).click();
  await expect(page.getByText('Cutoff')).toBeVisible();

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await page.locator('.mob-tab', { hasText: 'Filters' }).click();
  await expect(page.getByText('Lowpass', { exact: false })).toBeVisible();
});

test('removing a filter clears the list back to empty', async ({ appPage: page }) => {
  await page.getByText('+ HP', { exact: true }).click();
  await expect(page.getByText('No filters active.')).toBeHidden();

  await page.getByRole('button', { name: 'Remove HP' }).click();
  await expect(page.getByText('No filters active.')).toBeVisible();
});

test('an order-4 allpass shows the WinISD deviation cue, and it opens the differences page at its entry, within the phone width', async ({ appPage: page }) => {
  await page.getByText('+ AP', { exact: true }).click();
  const order = page.locator('.mob-fcard .ui-field').filter({ has: page.locator('label:text-is("Order")') }).locator('input');
  await order.fill('4');
  await order.blur();
  const cue = page.locator('button.winisd-deviation-cue');
  await expect(cue).toBeVisible();
  await cue.click();
  const dialog = page.getByRole('dialog', { name: 'OpenISD and WinISD differences' });
  const entry = dialog.locator('.wd-entry.current, .mob-dcard.current');
  await expect(entry.locator('h4, .mob-dcard-title')).toHaveText('WinISD ignores allpass orders above 2');
  await expect(entry.locator('dt', { hasText: 'Switch' })).toHaveCount(0);
  const box = (await dialog.boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
});

test('Options "Show WinISD difference markers (≠W)" hides the cue, and ticking it brings it back', async ({ appPage: page }) => {
  await page.getByText('+ AP', { exact: true }).click();
  const cue = page.locator('button.winisd-deviation-cue');
  await expect(cue).toBeVisible();
  for (const on of [false, true]) {
    await tapMobileMenuItem(page, 'Options');
    await page.locator('[data-testid="difference-cues"] input').setChecked(on);
    await page.locator('[data-testid="settings-apply"]').click();
    await expect(cue).toHaveCount(on ? 1 : 0);
  }
});

test('the chips sit on one line, and the arrows show that more filter types are off screen', async ({ appPage: page }) => {
  const strip = page.locator('.mob-fstrip');
  const tops = await strip.locator('button').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size, 'all chips on one line').toBe(1);
  expect(await strip.evaluate(el => el.scrollWidth > el.clientWidth), 'more chips than fit').toBe(true);
  const next = page.getByRole('button', { name: 'More filter types' });
  await expect(next).toBeVisible();
  await expect(page.getByRole('button', { name: 'Earlier filter types' })).toBeHidden();
  await next.click();
  await expect(page.getByRole('button', { name: 'Earlier filter types' })).toBeVisible();
});

test('the chips and the arrows are the one phone button, PhoneRowSizes.BUTTON_PX tall', async ({ appPage: page }) => {
  const buttons = page.locator('.mob-fstrip-wrap .phone-btn:visible');
  await expect(buttons).toHaveCount(PHONE_FILTER_CHIPS.length + 1);   // the ‹ hides at the start
  const heights = await buttons.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
  for (const h of heights) expect(h).toBeCloseTo(PhoneRowSizes.BUTTON_PX, 0);
});

test('a filter is a card: tapping its header folds the rows, and the tick switches it off', async ({ appPage: page }) => {
  await page.getByText('+ PEQ', { exact: true }).click();
  const card = page.locator('.mob-fcard');
  await expect(card.locator('.ui-field')).toHaveCount(3);
  await card.getByRole('button', { name: 'Fold PEQ' }).click();
  await expect(card.locator('.ui-field')).toHaveCount(0);
  await card.getByRole('button', { name: 'Open PEQ' }).click();
  await expect(card.locator('.ui-field')).toHaveCount(3);
  await card.getByRole('checkbox', { name: 'PEQ on' }).uncheck();
  await expect(card.locator('.mob-fcard-cap')).toHaveClass(/mob-fcard-off/);
});

test('every filter type shows its rows as standard field rows, with frequencies in whole hertz', async ({ appPage: page }) => {
  const labels: Record<string, readonly string[]> = {
    '+ LP': ['Order', 'Q', 'Cutoff'], '+ AP': ['Order', 'Q', 't'], '+ LT': ['f0', 'Q0', 'fp', 'Qp'], '+ PEQ': ['fc', 'Gain', 'Q'],
    '+ Peak HP': ['Gpk', 'fpk'], '+ Gain': ['Gain'], '+ DLP': ['fc', 'Gain', 'BW'], '+ LS': ['fc', 'Q', 'Gain'], '+ HS': ['fc', 'Q', 'Gain'],
  };
  for (const [chip, rows] of Object.entries(labels)) {
    await page.getByText(chip, { exact: true }).click();
    const card = page.locator('.mob-fcard').last();
    await expect(card.locator('.ui-field .ui-field-label'), chip).toHaveText([...rows]);
    const hz = card.locator('.ui-field', { has: page.locator('.ui-field-unit', { hasText: 'Hz' }) }).locator('input');
    for (let k = 0; k < await hz.count(); k++) await expect(hz.nth(k), `${chip} frequency has no decimals`).toHaveValue(/^\d+$/);
  }
  await expect(page.locator('.mob-fcard select')).toHaveCount(0 + 1);   // the lowpass subtype
});

test('the ? on a card opens that filter\'s help', async ({ appPage: page }) => {
  await page.getByText('+ LP', { exact: true }).click();
  await page.getByRole('button', { name: 'Help: LP' }).click();
  const help = page.getByRole('dialog', { name: 'Help: Lowpass' });
  await expect(help).toContainText('cuts the highs above the cutoff');
});
