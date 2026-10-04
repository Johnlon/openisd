import {COMPLETE_DRIVER_PROJECT_OWPR, curvesSplLength, expect, focusedDriveGroup, openAProject, test} from '../fixtures.js';
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

test.describe('Original Signal tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  });

  test.describe('series resistance', () => {
    test('shows WinISD 3-dp precision (0.100 ohm)', async ({ page }) => {
      await expect(signalInput(page, 'Series resistance')).toHaveValue(/^\d+\.\d{3}$/);
    });

    test('holds a typed value instead of resetting to 0', async ({ page }) => {
      const rs = signalInput(page, 'Series resistance');
      await fillAndBlur(rs, '0.5');
      await expect(rs).toHaveValue(/0\.5/);
      await fillAndBlur(rs, '2.0');
      await expect(rs).toHaveValue(/2/);
    });
  });

  test.describe('power and voltage pair', () => {
    test('both cells are filled from the stored 1 W reference and explain their law', async ({ page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');
      await expect(pow).toHaveValue(/\d/);
      await expect(vol).toHaveValue(/\d/);
      await expect(pow).not.toHaveAttribute('title', /undefined/);
      await expect(vol).not.toHaveAttribute('title', /undefined/);
      await expect(pow).toHaveAttribute('title', /P = V² \/ Re/);
      await expect(vol).toHaveAttribute('title', /V = √\(P · Re\)/);
    });

    test('moving the power moves the voltage, and the entered power survives its own blur', async ({ page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');

      await fillAndBlur(pow, '10');
      await expect(pow).toHaveValue(/\d/);
      await expect(vol).toHaveValue(/\d/);
      const live = await focusedDriveGroup(page);
      expect(live.P, 'the entered P must be the committed power').toBe(10);
      expect(live.Re, 'the driver must carry a Re').toBeGreaterThan(0);
      const v10 = Number(await vol.inputValue());
      expect(v10, 'the shown V must be √(P·(Re+Rs))').toBeCloseTo(Math.sqrt(10 * (live.Re! + (live.Rs ?? 0))), 1);
      expect(Number(await pow.inputValue()), 'the shown P must equal the entered P').toBeCloseTo(10, 1);

      await fillAndBlur(pow, '4');
      expect(Number(await vol.inputValue()), 'lowering power must lower the voltage').toBeLessThan(v10);
    });

    test('entering a voltage derives the power V²/(Re+Rs) on blur and keeps it', async ({ page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');

      await fillAndBlur(vol, '4');

      const renderedP = Number(await pow.inputValue());
      const g = await focusedDriveGroup(page);
      expect(renderedP, 'P must be derived, not blank').toBeGreaterThan(0);
      expect(renderedP, 'P must equal V²/(Re+Rs)').toBeCloseTo((4 * 4) / (g.Re! + (g.Rs ?? 0)), 1);
      expect(Number(await vol.inputValue()), 'the entered V must hold').toBeCloseTo(4, 1);
      expect(g.P, 'the committed power is the same law').toBeCloseTo((4 * 4) / (g.Re! + (g.Rs ?? 0)), 8);
    });

    test('clearing V returns the pair to the 1 W reference — neither end is left blank', async ({ page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');

      await fillAndBlur(pow, '10');
      await expect(vol).toHaveValue(/\d/);
      await fillAndBlur(vol, '');

      // Clearing V empties the pair and the resolve refills it from the 1 W reference: P is 1 W
      // entered, V is √(Re+Rs) calculated. The rule is pinned in driveSignal.test.ts
      // ("commit blank V | post: P 1 E, V √6 C").
      const live = await focusedDriveGroup(page);
      expect(live.P, 'clearing V returns the power to the 1 W reference').toBeCloseTo(1, 6);
      expect(Number(await vol.inputValue()), 'V is √(Re+Rs), never blank').toBeCloseTo(Math.sqrt(live.Re! + (live.Rs ?? 0)), 1);
      expect(Number(await pow.inputValue()), 'P shows the 1 W reference').toBeCloseTo(1, 1);
      await expect(vol).not.toHaveAttribute('title', /No drive level stated/);
    });

    test('clearing P keeps the voltage, which becomes the entered end of the pair', async ({ page }) => {
      const pow = signalInput(page, 'System input power');
      const vol = signalInput(page, 'Driver input voltage');

      await fillAndBlur(pow, '10');
      await expect(vol).toHaveValue(/\d/);
      await fillAndBlur(pow, '');

      // The voltage keeps the value it reads and becomes the entered end; the power re-derives from
      // it as V²/(Re+Rs), the same number now calculated rather than entered.
      const live = await focusedDriveGroup(page);
      expect(live.V, 'clearing P keeps the voltage').toBeCloseTo(Math.sqrt(10 * (live.Re! + (live.Rs ?? 0))), 6);
      expect(live.P, 'the power re-derives from the kept voltage').toBeCloseTo(10, 6);
      expect(Number(await vol.inputValue()), 'V is shown').toBeGreaterThan(0);
      expect(Number(await pow.inputValue()), 'P is shown').toBeCloseTo(10, 1);
    });
  });
});

test.describe('Original Signal tab with a complete driver', () => {
  test('a complete driver stores the 1 W reference and draws a chart without a drive data-quality note', async ({ page }) => {
    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await expect.poll(() => curvesSplLength(page)).toBeGreaterThan(0);

    await page.locator('.project-nav li', { hasText: 'Signal' }).click();
    await expect(page.locator('.field', { hasText: 'System input power' }).locator('.dq-note')).toHaveCount(0);
  });
});
