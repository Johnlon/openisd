import {expect, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';

// The app's store, reached in-browser at runtime — passed as an evaluate ARGUMENT (never as a
// literal import), the same pattern original-skin.browser.spec.ts uses, so vue-tsc resolves nothing.
const APP_STATE = '/src/logic/appState.ts';

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
  await expect(modal).toContainText('Select driver for project');  // step 1: driver library
  await modal.locator('.dlist .ditem', { hasText: 'W5-1138SMF' }).first().click();
  await modal.locator('.use-btn').click();
  await modal.locator('button', { hasText: 'Next' }).click();   // Use lands on step 2 (num/placement); step 3: box type
  await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption(SEALED);
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Next' }).click();   // step 4: sealed alignment
  await modal.locator('input[type="text"]').fill('Signal project');
  await modal.locator('button', { hasText: 'Create' }).click();
  await expect(page.locator('.original-root')).toBeVisible();
}

function signalInput(page: Page, label: string) {
  return page.locator('.field', { hasText: label }).locator('input');
}

/** The drive group's committed state, read live from the domain. */
async function driveGroup(page: Page) {
  return page.evaluate(async (modPath) => {
    const s = await import(/* @vite-ignore */ modPath);
    const p = s.requireFocusedProject();
    return { P: p.powerDrive_W.value, V: p.driveVoltage_V.value, Re: p.driver.specs.Re_ohm.value };
  }, APP_STATE);
}

test('entering P on a new w5-1138smf project then blurring does not blank the P cell — the derived V lands and stays', async ({ page }) => {
  await page.goto('/');
  await buildNewProject(page);
  // CREED: this test intends the Signal tab — switch to it, never assume the wizard left it there.
  await page.locator(SIGNAL_TAB, { hasText: 'Signal' }).click();
  const pow = signalInput(page, 'System input power');
  const vol = signalInput(page, 'Driver input voltage');

  await fillAndBlur(pow, '10');

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

  await fillAndBlur(vol, '4');

  // The derived P must be present — never blank — and equal V²/Re at the pane's precision.
  const renderedP = Number(await pow.inputValue());
  expect(renderedP, 'P must be derived, not blank').toBeGreaterThan(0);
  expect(renderedP, 'B1 P must equal V²/Re').toBeCloseTo((4 * 4) / (await driveGroup(page)).Re!, 1);
  expect(Number(await vol.inputValue()), 'the entered V must hold').toBeCloseTo(4, 1);

  // And the committed power in the domain is the same law.
  const live = await driveGroup(page);
  expect(live.P, 'the committed power must be V²/Re').toBeCloseTo((4 * 4) / live.Re!, 8);
});

test('clearing V then blurring returns the pair to the 1 W reference — neither end is left blank', async ({ page }) => {
  await page.goto('/');
  await buildNewProject(page);
  await page.locator(SIGNAL_TAB, { hasText: 'Signal' }).click();
  const pow = signalInput(page, 'System input power');
  const vol = signalInput(page, 'Driver input voltage');

  // Enter P first, so V is derived from it and visible.
  await fillAndBlur(pow, '10');
  await expect(vol).toHaveValue(/\d/);

  // Delete V (empty the cell) and blur.
  await fillAndBlur(vol, '');

  // Clearing V empties the PAIR, and the resolve refills it from the 1 W reference: P is 1 W
  // entered, V is √Re calculated. The same rule the hook layer pins in
  // `OriginalShell-hooks.test.ts` ("commit blank V | post: P 1 E, V √6 C").
  const live = await driveGroup(page);
  expect(live.P, 'clearing V returns the power to the 1 W reference').toBeCloseTo(1, 6);
  expect(Number(await vol.inputValue()), 'V is √Re, never blank').toBeCloseTo(Math.sqrt(live.Re!), 1);
  expect(Number(await pow.inputValue()), 'P shows the 1 W reference').toBeCloseTo(1, 1);
});

test('clearing P then blurring keeps the voltage, which becomes the entered end of the pair', async ({ page }) => {
  await page.goto('/');
  await buildNewProject(page);
  await page.locator(SIGNAL_TAB, { hasText: 'Signal' }).click();
  const pow = signalInput(page, 'System input power');
  const vol = signalInput(page, 'Driver input voltage');

  await fillAndBlur(pow, '10');
  await expect(vol).toHaveValue(/\d/);

  // Delete P (empty the cell) and blur.
  await fillAndBlur(pow, '');

  // With Re known the voltage keeps the value it reads and becomes the ENTERED end, so the
  // power re-derives from it as V²/Re — the same number, now calculated rather than entered.
  // Neither end of the pair is ever blank (`OpenISDProject#powerDriveOver`'s `clear`).
  const live = await driveGroup(page);
  expect(live.V, 'clearing P keeps the voltage').toBeCloseTo(Math.sqrt(10 * live.Re!), 6);
  expect(live.P, 'the power re-derives from the kept voltage').toBeCloseTo(10, 6);
  expect(Number(await vol.inputValue()), 'V is shown').toBeGreaterThan(0);
  expect(Number(await pow.inputValue()), 'P is shown').toBeCloseTo(10, 1);
});