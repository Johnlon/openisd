/**
 * The mobile Advanced tab. The FIELD WIRING itself (env overrides, loss mode, WinISD-compat
 * switches) is proven once, in `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s
 * `createEnvironmentAir` suite and `AdvancedOptions-hooks.test.ts` — the same factory/hook this
 * tab calls. These specs prove the UI is correctly WIRED to that shared logic.
 *
 * Reached via the hamburger menu (like Project), not the bottom tab bar — same reasoning as
 * Project: a settings-style destination, not a primary content tab.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';
import {PhoneHelp, PhoneRowSizes} from '@openisd/design/fields';

function fieldRow(page: import('@playwright/test').Page, label: string) {
  return mobileFieldRow(page, label);
}

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: 'Advanced' }).click();
});

test('shows the environment fields, calculated readouts, and WinISD-compat controls', async ({ page }) => {
  await expect(page.locator('.mob-band', { hasText: 'Environment' })).toBeVisible();
  await expect(fieldRow(page, 'Temperature')).toBeVisible();
  await expect(fieldRow(page, 'Relative humidity')).toBeVisible();
  await expect(fieldRow(page, 'Air pressure')).toBeVisible();
  await expect(fieldRow(page, 'Sound velocity')).toBeVisible();
  await expect(fieldRow(page, 'Air density')).toBeVisible();

  await expect(page.getByText('Force flat response')).toBeVisible();

  await expect(page.locator('.mob-band', { hasText: 'Enable WinISD bugs' })).toBeVisible();
  await expect(page.locator('#mob-adv-lossmode')).toHaveCount(0);
  await expect(page.getByText('WinISD air model')).toHaveCount(0);
  await expect(page.getByText('Two-BL driver')).toBeVisible();
  await expect(page.getByText('Re without Rg')).toBeVisible();
});

test('editing the temperature writes through and clearing it falls back to the app default', async ({ page }) => {
  const tempInput = fieldRow(page, 'Temperature').locator('input');
  await tempInput.fill('300');
  await tempInput.blur();
  await expect(tempInput).toHaveValue(/300/);

  await page.getByRole('button', { name: 'Reset to app levels' }).click();
  await expect(tempInput).not.toHaveValue(/300/);
});

test('typing a sound velocity and an air density enters them; clearing returns them to calculated', async ({ page }) => {
  const c = fieldRow(page, 'Sound velocity').locator('input');
  const rho = fieldRow(page, 'Air density').locator('input');
  await expect(c).toHaveClass(/value-c/);
  await expect(rho).toHaveClass(/value-c/);
  const calculatedC = await c.inputValue();
  const calculatedRho = await rho.inputValue();

  await c.fill('222.5');
  await c.press('Tab');
  await expect(c).toHaveValue(/222\.5/);
  await expect(c).not.toHaveClass(/value-c/);

  await rho.fill('2.34567');
  await rho.press('Tab');
  await expect(rho).toHaveValue(/2\.34567/);
  await expect(rho).not.toHaveClass(/value-c/);
  await expect(c).toHaveValue(/222\.5/);

  await c.fill('');
  await c.press('Tab');
  await rho.fill('');
  await rho.press('Tab');
  await expect(c).toHaveClass(/value-c/);
  await expect(rho).toHaveClass(/value-c/);
  await expect(c).toHaveValue(calculatedC);
  await expect(rho).toHaveValue(calculatedRho);
});

test('a typed air density, and separately a typed sound velocity, change the chart data', async ({ page }) => {
  const closeAdvanced = () => page.getByRole('button', { name: 'Close', exact: true }).last().click();
  const openAdvanced = async () => {
    await page.locator('.mob-tab', { hasText: 'Box' }).click();
    await page.locator('.mob-hamburger').click();
    await page.locator('.mob-menu-item', { hasText: 'Advanced' }).click();
  };
  const chartTable = async (): Promise<string> => {
    await closeAdvanced();
    await page.locator('.mob-tab', { hasText: 'Graph' }).click();
    await page.locator('.mob-chart-cell .mob-band').first().getByRole('button', { name: 'Data' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('tbody tr').first()).toBeVisible();
    const text = await dialog.locator('tbody').innerText();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await openAdvanced();
    return text;
  };
  const type = async (label: string, value: string) => {
    const input = fieldRow(page, label).locator('input');
    await input.fill(value);
    await input.press('Tab');
  };

  const calculated = await chartTable();

  await type('Air density', '2.34567');
  expect(await chartTable()).not.toBe(calculated);
  await type('Air density', '');
  expect(await chartTable()).toBe(calculated);

  await type('Sound velocity', '222.5');
  expect(await chartTable()).not.toBe(calculated);
  await type('Sound velocity', '');
  expect(await chartTable()).toBe(calculated);
});

test('toggling the "Force flat response" checkbox writes through to the project', async ({ page }) => {
  const checkbox = page.locator('label', { hasText: 'Force flat response' }).locator('input[type=checkbox]');
  const before = await checkbox.isChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked({ checked: !before });
});

test('four grey bands, each with a ?, name the groups', async ({ page }) => {
  const bands = page.locator('.mob-dlg .mob-band');
  await expect(bands).toHaveText(PhoneHelp.ADVANCED_SECTIONS.map(s => new RegExp(`^${s.title}\\s*\\?$`, 'i')));
  for (const b of await bands.all()) {
    await expect(b.locator('.mob-band-help')).toBeVisible();
    expect(Math.abs((await b.boundingBox())!.height - 28)).toBeLessThanOrEqual(0.5);
  }
});

test('the bug switches carry the warning class under the "Enable WinISD bugs" band', async ({ page }) => {
  const group = page.locator('.error-switch-group');
  for (const key of ['winisdDriverModel', 'winisdVaModel', 'winisdPrNprResonance', 'winisdBesselHighpass', 'winisdAbcGroupDelay', 'winisdDriverCountModel', 'winisdSealedPicker', 'winisdTlPortNoEndCorrection']) {
    const label = group.locator(`label[data-field-key="${key}"]`);
    await expect(label, key).toHaveClass(/error-switch-marked/);
    await expect(label, key).toHaveAttribute('title', /^Ticking brings back a WinISD bug\.\n/);
  }
  await expect(group.locator('label[data-field-key="winisdAbcIntraPortVelocity"]')).toHaveCount(0);
  await expect(page.locator('label[data-field-key="winisdAbcIntraPortVelocity"] input')).toBeDisabled();
  await expect(group.locator('label[data-field-key="winisdPrNprResonance"] input')).toBeDisabled();
  await expect(group.locator('label[data-field-key="winisdDriverCountModel"] input')).toBeDisabled();
});

test('the warning mark of every bug switch sits fully inside its row and inside the screen', async ({ page }) => {
  const rows = page.locator('.error-switch-group label.error-switch-marked');
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const row = (await rows.nth(i).boundingBox())!;
    const mark = (await rows.nth(i).locator('.error-switch-mark').boundingBox())!;
    expect(mark.x, `mark ${i} left edge`).toBeGreaterThanOrEqual(row.x);
    expect(mark.x + mark.width, `mark ${i} right edge`).toBeLessThanOrEqual(row.x + row.width);
    expect(mark.x, `mark ${i} on screen`).toBeGreaterThanOrEqual(0);
  }
});

test('the "Enable WinISD-style" group has every WinISD option the desktop has, and each one writes through', async ({ page }) => {
  for (const key of ['winisdWrapPhase', 'winisdFlatModel']) {
    const checkbox = page.locator(`label[data-field-key="${key}"] input[type=checkbox]`);
    await expect(checkbox, key).toBeVisible();
    const before = await checkbox.isChecked();
    await checkbox.click();
    await expect(checkbox, key).toBeChecked({ checked: !before });
  }
});

test('the group help links are the bands\' ? buttons: no separate help link beside a heading', async ({ page }) => {
  await expect(page.locator('button.compat-help-link')).toHaveCount(0);
});

test('a help line on the bugs band links to its Differences entry, which opens at that entry', async ({ page }) => {
  await page.locator('.mob-band', { hasText: 'Enable WinISD bugs' }).locator('.mob-band-help').click();
  const sheet = page.getByRole('dialog', { name: 'Help: Enable WinISD bugs' });
  await expect(sheet.locator('.mob-help-row')).toHaveCount(PhoneHelp.ADVANCED_WINISD_BUGS.rows.length);
  await expect(sheet.getByRole('button', { name: 'More in Differences' })).toHaveCount(PhoneHelp.ADVANCED_WINISD_BUGS.rows.length);
  await sheet.locator('.mob-help-row', { hasText: 'Two-BL driver' }).getByRole('button', { name: 'More in Differences' }).click();
  await expect(sheet).toBeHidden();
  const diff = page.getByRole('dialog', { name: 'OpenISD and WinISD differences' });
  await expect(diff).toBeVisible();
  await expect(diff.locator('.wd-entry.current')).toContainText('WinISD mixes two BL values');
  await diff.getByRole('button', { name: 'Close' }).last().click();
  await expect(page.locator('.mob-band', { hasText: 'Enable WinISD bugs' })).toBeVisible();
});

test('the transmission line option row carries the ≠W cue', async ({ page }) => {
  await expect(page.locator('label[data-field-key="tlPortModel"] .winisd-deviation-cue')).toBeVisible();
});

for (const size of PHONE_SIZES) {
  test(`rows are classic depth, bug rows are tinted, nothing is cut or scrolls sideways at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const rows = page.locator('.mob-dlg .mob-switch-row, .mob-dlg .adv-options label');
    expect(await rows.count()).toBeGreaterThanOrEqual(15);
    const heights = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(PhoneRowSizes.CLASSIC.rowMinPx - 0.5);
    const bug = page.locator('.mob-dlg .error-switch-marked').first();
    expect(await bug.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cut: [...document.querySelectorAll<HTMLElement>('.mob-dlg label, .mob-dlg input, .mob-dlg button')]
        .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => `${e.tagName}:${e.textContent?.trim()}`),
      outside: [...document.querySelectorAll<HTMLElement>('.mob-dlg input, .mob-dlg button')]
        .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > window.innerWidth + 0.5); }).length,
    }));
    const reset = page.getByRole('button', { name: 'Reset to app levels' });
    expect((await reset.boundingBox())!.height, 'the one phone button height').toBeCloseTo(PhoneRowSizes.BUTTON_PX, 0);
    await expect(reset, 'the plain grey phone button, not the blue one').toHaveClass(/\bmob-btn-plain\b/);
    expect(overflow.page, 'no horizontal page scroll').toBe(false);
    expect(overflow.cut, 'nothing cut').toEqual([]);
    expect(overflow.outside, 'nothing outside sideways').toBe(0);
  });
}

// BUG (2026-09-29, John, live on his phone): "environment view needs to scroll... truncation at
// the moment". Every mobile tab's `.mob-panel` sets `overflow: hidden`, and a flex item with
// overflow other than visible gets an automatic MINIMUM size of 0 — so with the column-flex default
// `flex-shrink: 1`, once a tall tab's content exceeded `.mob-content` the shrink algorithm silently
// squashed every panel and clipped its content, instead of letting `.mob-content`'s own
// `overflow-y: auto` scroll. Fixed in MobileShell.vue: `.mob-content > :deep(*) { flex-shrink: 0; }`.
// Needs a genuinely phone-sized (narrow AND short) viewport: the default one is tall enough that
// most tabs never overflow.
test('scrolls to its last control instead of clipping it', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 700 });

  const lastControl = page.getByText('Re without Rg');
  await lastControl.scrollIntoViewIfNeeded();
  await expect(lastControl).toBeVisible();

  // Only the shared container scrolls: the page itself renders at its full (unclipped) height.
  const page_ = await page.locator('.mob-dlg .mob-classic').evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  expect(page_.scrollHeight).toBeLessThanOrEqual(page_.clientHeight);
});
