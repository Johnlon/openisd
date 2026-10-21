import {COMPLETE_DRIVER_PROJECT_OWPR, expect, expectChartDrawn, openAProject, openTab, shownDriverSpec, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';

/**
 * The Original shell's Signal tab. P (System input power) and V (Driver input voltage) are one
 * coupled pair under WinISD's reference-power law V = √(P·(Re+Rs)), P = V²/(Re+Rs). A blur on a
 * cell whose value changed is a notification: the pair re-derives its derived member from the
 * entered one, so neither cell is ever left blank. The arithmetic is pinned in
 * driveSignal.test.ts; these specs prove the cells are wired to it.
 */

function signalInput(page: Page, label: string): Locator {
  return page.locator('.field', { hasText: label }).locator('input');
}

/** The drive group as the screen shows it: power, voltage and series resistance on the Signal tab, the
 *  driver's Re in the Driver Editor (then back to the Signal tab). */
async function shownDriveGroup(page: Page): Promise<{P: number; V: number; Re: number; Rs: number}> {
  const Re = Number(await shownDriverSpec(page, 'Re'));
  await openTab(page, 'Signal');
  const read = async (label: string) => Number(await signalInput(page, label).inputValue());
  return {P: await read('System input power'), V: await read('Driver input voltage'), Re, Rs: await read('Series resistance')};
}

test.describe('Original Signal tab', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  });

  test('System input power spins by its tenths digit a tap: 1 W up is 1.1 W, down is 0.9 W', async ({ appPage: page }) => {
    const pow = signalInput(page, 'System input power');
    await fillAndBlur(pow, '1');
    await pow.focus();
    await pow.press('ArrowUp');
    await expect(pow).toHaveValue('1.10');
    await pow.press('ArrowDown');
    await expect(pow).toHaveValue('1.00');
    await pow.press('ArrowDown');
    await expect(pow).toHaveValue('0.90');
  });

  // John, 21 Oct 2026 (QO291.c153): the stepped digit is a place value; it moves with the number.
  test('a spin keeps its place as the number gains and loses a digit, by key and by ▲▼', async ({ appPage: page }) => {
    const pow = signalInput(page, 'System input power');
    await fillAndBlur(pow, '9.5');
    await pow.focus();
    await pow.press('Home');
    await pow.press('ArrowRight');          // the caret right of the units digit
    await pow.press('ArrowUp');
    await expect(pow).toHaveValue(/^10\.5/);
    await pow.press('ArrowUp');
    await expect(pow).toHaveValue(/^11\.5/);
    await fillAndBlur(pow, '10.5');
    await pow.focus();
    await pow.press('Home');                // the caret left of the tens digit
    await pow.press('ArrowDown');
    await expect(pow).toHaveValue(/^0\.5/);
    await pow.press('ArrowUp');
    await expect(pow).toHaveValue(/^10\.5/);
    const [upBtn, downBtn] = await page.locator('.field', { hasText: 'System input power' })
      .locator('.num-stepper-btn').all();   // [▲, ▼] order
    await downBtn.click();
    await expect(pow).toHaveValue(/^0\.5/);
    await upBtn.click();
    await expect(pow).toHaveValue(/^10\.5/);
  });

  test('System input power is a UIField: label, box, ⚠ slot and unit in one row', async ({ appPage: page }) => {
    const row = page.locator('.field', { hasText: 'System input power' });
    await expect(row.locator('input')).toHaveValue(/\d/);
    await expect(row.locator('.ui-field-unit')).toHaveText('W');
  });

  test.describe('series resistance', () => {
    test('shows WinISD 3-dp precision (0.100 ohm)', async ({ appPage: page }) => {
      await expect(signalInput(page, 'Series resistance')).toHaveValue(/^\d+\.\d{3}$/);
    });

    test('holds a typed value instead of resetting to 0', async ({ appPage: page }) => {
      const rs = signalInput(page, 'Series resistance');
      await fillAndBlur(rs, '0.5');
      await expect(rs).toHaveValue(/0\.5/);
      await fillAndBlur(rs, '2.0');
      await expect(rs).toHaveValue(/2/);
    });
  });

  test.describe('UIField rows (bugs/BUG_20261005_no-common-ui-field-component.md)', () => {
    test('series resistance: an emptied box is refused with a ⚠ and Esc restores the stored value', async ({ appPage: page }) => {
      const row = page.locator('.ui-field', { hasText: 'Series resistance' });
      const box = row.locator('input');
      await fillAndBlur(box, '0.5');
      await box.fill('');
      await expect(box).toHaveValue('');
      await expect(row.locator('.ui-field-dq-btn')).toBeVisible();
      await box.press('Escape');
      await expect(box).toHaveValue(/^0\.5/);
    });

    test('driver input voltage is a UIField row; emptied, it goes back to a calculated value', async ({ appPage: page }) => {
      const row = page.locator('.ui-field', { hasText: 'Driver input voltage' });
      const box = row.locator('input');
      await fillAndBlur(box, '12');
      await fillAndBlur(box, '');
      await expect(box).toHaveValue(/\d/);
    });
  });

  test.describe('power and voltage pair', () => {
    test('both cells are filled from the stored 1 W reference and explain their law', async ({ appPage: page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');
      await expect(pow).toHaveValue(/\d/);
      await expect(vol).toHaveValue(/\d/);
      await expect(pow).not.toHaveAttribute('title', /undefined/);
      await expect(vol).not.toHaveAttribute('title', /undefined/);
      await expect(pow).toHaveAttribute('title', /P = V² \/ Re/);
      await expect(vol).toHaveAttribute('title', /V = √\(P · Re\)/);
    });

    test('moving the power moves the voltage, and the entered power survives its own blur', async ({ appPage: page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');

      await fillAndBlur(pow, '10');
      await expect(pow).toHaveValue(/\d/);
      await expect(vol).toHaveValue(/\d/);
      const live = await shownDriveGroup(page);
      expect(live.P, 'the entered P must be the shown power').toBeCloseTo(10, 2);
      expect(live.Re, 'the driver must carry a Re').toBeGreaterThan(0);
      const v10 = Number(await vol.inputValue());
      expect(v10, 'the shown V must be √(P·(Re+Rs))').toBeCloseTo(Math.sqrt(10 * (live.Re + live.Rs)), 1);
      expect(Number(await pow.inputValue()), 'the shown P must equal the entered P').toBeCloseTo(10, 1);

      await fillAndBlur(pow, '4');
      expect(Number(await vol.inputValue()), 'lowering power must lower the voltage').toBeLessThan(v10);
    });

    test('entering a voltage derives the power V²/(Re+Rs) on blur and keeps it', async ({ appPage: page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');

      await fillAndBlur(vol, '4');

      const renderedP = Number(await pow.inputValue());
      const g = await shownDriveGroup(page);
      expect(renderedP, 'P must be derived, not blank').toBeGreaterThan(0);
      expect(renderedP, 'P must equal V²/(Re+Rs)').toBeCloseTo((4 * 4) / (g.Re + g.Rs), 1);
      expect(Number(await vol.inputValue()), 'the entered V must hold').toBeCloseTo(4, 1);
    });

    test('clearing V keeps the power, which becomes the entered end of the pair', async ({ appPage: page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');

      await fillAndBlur(pow, '10');
      await expect(vol).toHaveValue(/\d/);
      await fillAndBlur(vol, '');

      // The power keeps the value it reads and stays the entered end; V is calculated from it
      // (docs/design/FIELD_CLEAR_RULE.md). Neither end is left blank.
      const live = await shownDriveGroup(page);
      expect(live.P, 'clearing V keeps the power').toBeCloseTo(10, 2);
      expect(Number(await vol.inputValue()), 'V is calculated from the power, never blank').toBeCloseTo(Math.sqrt(10 * (live.Re + live.Rs)), 1);
      expect(Number(await pow.inputValue()), 'P shows what it was').toBeCloseTo(10, 1);
      await expect(vol).not.toHaveAttribute('title', /No drive level stated/);
    });

    test('clearing P keeps the voltage, which becomes the entered end of the pair', async ({ appPage: page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');

      await fillAndBlur(pow, '10');
      await expect(vol).toHaveValue(/\d/);
      await fillAndBlur(pow, '');

      // The voltage keeps the value it reads and becomes the entered end; the power re-derives from
      // it as V²/(Re+Rs), the same number now calculated rather than entered.
      const live = await shownDriveGroup(page);
      expect(live.V, 'clearing P keeps the voltage').toBeCloseTo(Math.sqrt(10 * (live.Re + live.Rs)), 2);
      expect(live.P, 'the power re-derives from the kept voltage').toBeCloseTo(10, 2);
      expect(Number(await vol.inputValue()), 'V is shown').toBeGreaterThan(0);
      expect(Number(await pow.inputValue()), 'P is shown').toBeCloseTo(10, 1);
    });
  });
});

test.describe('Original Signal tab with a complete driver', () => {
  test('a complete driver stores the 1 W reference and draws a chart without a drive data-quality note', async ({ appPage: page }) => {
    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await expectChartDrawn(page);

    await page.locator('.project-nav li', { hasText: 'Signal' }).click();
    await expect(page.locator('.field', { hasText: 'System input power' }).locator('.dq-note')).toHaveCount(0);
  });
});
