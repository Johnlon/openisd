import { test, expect } from '../fixtures.js';
import type { Page } from '@playwright/test';

/**
 * The Signal-pane drive trio on the Original shell: P (System input power) and V (Driver
 * input voltage) are one coupled pair under WinISD's reference-power law, V = √(P·Re),
 * P = V²/Re (packages/design/engine/formulas.ts — the domain stays pure law).
 *
 * Losing focus on a cell whose value changed since entry is a NOTIFICATION (bugs/
 * BUG_20260916_signal-pane-blur-must-notify.md): on such a blur the drive trio must
 * re-derive its derived member from the entered one and commit it, so neither cell may
 * ever be left blank.
 *
 * Test-side creed: every test switches to the Signal tab it intends, in every action,
 * never assuming the wizard left it there; none asserts a default value.
 */
const SIGNAL_TAB = '.project-nav li';
const SEALED = 'sealed';

async function buildNewProject(page: Page): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Project name');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption(SEALED);
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click();
  await expect(page.locator('.dlist')).toBeVisible();
  await page.locator('.dlist .ditem', { hasText: 'W5-1138SMF' }).first().click();
  await page.locator('.use-btn').click();
  await expect(page.locator('.original-root')).toBeVisible();
}

function signalInput(page: Page, label: string) {
  return page.locator('.field', { hasText: label }).locator('input');
}

/** The drive group's committed state, read live from the domain. */
async function driveGroup(page: Page) {
  return page.evaluate(async () => {
    const s = await import(/* @vite-ignore */ '/src/logic/appState.ts');
    const p = s.requireFocusedProject();
    return { P: p.powerDrive_W.value, V: p.driveVoltage_V.value, Re: p.driver.ts.Re_ohm.value };
  });
}

test('entering P on a new w5-1138smf project then blurring does not blank the P cell — the derived V lands and stays', async ({ page }) => {
  await page.goto('/');
  await buildNewProject(page);
  // CREED: this test intends the Signal tab — switch to it, never assume the wizard left it there.
  await page.locator(SIGNAL_TAB, { hasText: 'Signal' }).click();
  const pow = signalInput(page, 'System input power');
  const vol = signalInput(page, 'Driver input voltage');

  await pow.fill('10');
  await pow.blur();

  // The entered P must survive its own blur — never blank.
  await expect(pow).toHaveValue(/\d/);
  // The derived V must land (√(P·Re) at the pane's precision) and stay.
  await expect(vol).toHaveValue(/\d/);
  await expect(vol).not.toHaveValue('');

  // And the committed pair must agree with the live domain law V = √(P·Re).
  const live = await driveGroup(page);
  expect(live.P, 'the entered P must be the committed power').toBe(10);
  expect(live.Re, 'the creed driver must carry a Re').toBeGreaterThan(0);
  const renderedV = Number(await vol.inputValue());
  expect(renderedV, 'the shown V must be √(P·Re)').toBeCloseTo(Math.sqrt(10 * live.Re!), 1);
  expect(Number(await pow.inputValue()), 'the shown P must equal the entered P').toBeCloseTo(10, 1);
});

test('entering V on a new w5-1138smf project then blurring derives a consistent P (V²/Re) and keeps it', async ({ page }) => {
  await page.goto('/');
  await buildNewProject(page);
  await page.locator(SIGNAL_TAB, { hasText: 'Signal' }).click();
  const pow = signalInput(page, 'System input power');
  const vol = signalInput(page, 'Driver input voltage');

  await vol.fill('4');
  await vol.blur();

  // The derived P must be present — never blank — and equal V²/Re at the pane's precision.
  const renderedP = Number(await pow.inputValue());
  expect(renderedP, 'P must be derived, not blank').toBeGreaterThan(0);
  expect(renderedP, 'B1 P must equal V²/Re').toBeCloseTo((4 * 4) / (await driveGroup(page)).Re!, 1);
  expect(Number(await vol.inputValue()), 'the entered V must hold').toBeCloseTo(4, 1);

  // And the committed power in the domain is the same law.
  const live = await driveGroup(page);
  expect(live.P, 'the committed power must be V²/Re').toBeCloseTo((4 * 4) / live.Re!, 8);
});

test('clearing V then blurring keeps the entered P and recomputes V from P and Re — the pair is never left blank', async ({ page }) => {
  await page.goto('/');
  await buildNewProject(page);
  await page.locator(SIGNAL_TAB, { hasText: 'Signal' }).click();
  const pow = signalInput(page, 'System input power');
  const vol = signalInput(page, 'Driver input voltage');

  // Enter P first, so V is derived from it and visible.
  await pow.fill('10');
  await pow.blur();
  await expect(vol).toHaveValue(/\d/);

  // Delete V (empty the cell) and blur.
  await vol.fill('');
  await vol.blur();

  // The still-entered P must survive the delete — never cleared by its derived sibling.
  const live = await driveGroup(page);
  expect(live.P, 'clearing V must not clear the entered P').toBe(10);
  // V must be recomputed from the still-present P and Re (√(P·Re)), never left blank.
  expect(Number(await vol.inputValue()), 'V must be recomputed from P and Re, never blank').toBeCloseTo(Math.sqrt(10 * live.Re!), 1);
  expect(Number(await pow.inputValue()), 'P must still be shown').toBeCloseTo(10, 1);
});

test('clearing P then blurring leaves no phantom voltage — V cannot exist when its entered power is gone', async ({ page }) => {
  await page.goto('/');
  await buildNewProject(page);
  await page.locator(SIGNAL_TAB, { hasText: 'Signal' }).click();
  const pow = signalInput(page, 'System input power');
  const vol = signalInput(page, 'Driver input voltage');

  await pow.fill('10');
  await pow.blur();
  await expect(vol).toHaveValue(/\d/);

  // Delete P (empty the cell) and blur.
  await pow.fill('');
  await pow.blur();

  // P is genuinely gone — and V, a pure output of P and Re, must go with it. No phantom
  // √(1·Re) from a hidden reference power may keep V alive while its entered base is blank.
  expect((await driveGroup(page)).P, 'clearing P must clear the entered power').toBe(null);
  await expect(vol, 'V must not show the reference-power phantom when P is blank').toHaveValue('');
  await expect(pow, 'P must show blank').toHaveValue('');
});