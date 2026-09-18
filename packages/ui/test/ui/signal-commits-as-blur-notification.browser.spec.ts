import { test, expect } from '../fixtures.js';
import { fillAndCommit } from '../fixtures/numField.js';

const EDITOR = '.de-modal';
// const GENERAL = '.de-tab General';
const PW_ROW = '.de-fld__row--power';
const V_ROW = '.de-fld__row--voltage';

/**
 * WinISD Signal-pane coupling law, as a blur-COMMIT rule (not an animation):
 *
 *   V is the OUTPUT — the user enters it when they want a test drive voltage.
 *   P and Re are derived from it:  P = V²/Re  and  Re = V²/P.
 *
 * A blur is a NOTIFICATION whenever the entered cell changed since it was committed.
 * On such a blur the drive group must re-derive its derived member from the entered one:
 *   - entering V  ⇒ P = V²/Re (the 1 W reference shows as 1 W, not blank)
 *   - deleting V  ⇒ V = √(P·Re) is re-derived from the still-entered P and Re (NEVER
 *     left blank together)
 *
 * See docs/debugging/vue-runtime-debugging.md — "the 1 W in the background" case.
 */

test('entering a voltage makes the power derive to V²/Re on blur — the 1 W is shown, not blank', async ({ page }) => {
  // ARRANGE the precondition explicitly — never assume the editor opened on this pane.
  await page.locator(EDITOR).waitFor();
  const vol = page.locator(V_ROW).locator('input');
  const pow = page.locator(PW_ROW).locator('input');

  // enter a 1 W test voltage (the industry-standard 1 W into 8 Ω ≈ 2.83 V, but with a
  // DIFFERENT Re the voltage is the UNIQUE value that delivers 1 W into Re).
  await fillAndCommit(vol, '1.84');     // 1.84² / Re(=3.4) = 1.000… W → the background 1 W; blur = commit point

  const pW = Number(await pow.inputValue());
  expect(pW, 'P must derive to 1 W from V²/Re on blur').toBeCloseTo(1.0, 1);

  // And Re is recomposed from the same pair — the group is never left partially derived.
  const reCell = page.locator('.de-fld').filter({ has: page.locator('label', { hasText: 'Re' }) }).locator('input');
  const re = Number(await reCell.inputValue());
  expect(re, 'Re must be the entered (not double-derived) member').toBeCloseTo(3.4, 1);
});

test('deleting the voltage re-derives it from P and Re on blur — never leaves both blank', async ({ page }) => {
  await page.locator(EDITOR).waitFor();
  const vol = page.locator(V_ROW).locator('input');
  const pow = page.locator(PW_ROW).locator('input');

  // The group starts with P and Re entered; V is the derived output.
  const pBefore = Number(await pow.inputValue());
  const reCell = page.locator('.de-fld').filter({ has: page.locator('label', { hasText: 'Re' }) }).locator('input');
  const re = Number(await reCell.inputValue());
  expect(pBefore, 'precondition: a power must be entered').toBeGreaterThan(0);
  expect(re, 'precondition: an Re must be entered').toBeGreaterThan(0);

  // DELETING V is a MODIFICATION since commit — so this blur is a notification event.
  await fillAndCommit(vol, '');     // blur with a changed-since-commit cell = notify + re-derive

  const vAfter = Number(await vol.inputValue());
  expect(vAfter, 'V = √(P·Re) must be re-derived from the still-entered P and Re').toBeCloseTo(Math.sqrt(pBefore * re), 1)
  expect(vAfter, 'the re-derived V must be within an epsilon of the law').toBeGreaterThan(0);
});
