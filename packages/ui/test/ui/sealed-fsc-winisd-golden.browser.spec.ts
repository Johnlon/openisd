/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/core-engine/spec.md?html
 * Requirement: "Sealed-Box Resonance Loss Models"
 *
 * WinISD's own measured readout for this driver/box (user-supplied ground truth, verified
 * against the reverse-engineered algorithm in ../winisd_research/SEALED_FSC_MODEL.md):
 *
 *   --fs 40 --vas 7.65 --qes 0.450 --qms 2.940 --re 6.6 --rg 0.1 --vb 6 --ql 10 --qa 100
 *   → Fsc: 63.1762 Hz   Qtc: 0.5995
 *
 * openisd must reproduce this THROUGH THE UI: a clean project, driver entered via the
 * Tune panel, sealed box + losses set on the Box tab, series resistance (Rg) set on the
 * Signal tab, and the Box tab's own Fsc/Qtc readout showing the WinISD value — not a unit test
 * of the underlying engine function, which proves nothing about whether it is actually wired in.
 *
 * Two real bugs had to be fixed for this to pass:
 *   1. QO13 — Qts never recalculated from freshly-entered Qes/Qms because a stale inherited
 *      value stayed Entered (Driver ADT session-scoped fix, driver-q-group-staleness.test.ts).
 *   2. openisd ignored the series source resistance Rg entirely (sourceLoadedQts,
 *      packages/engine/test/loss-mode.test.ts).
 *
 * Skin: 'original' — the WinISD-parity shell (OriginalShell.vue) with dedicated Fsc/Qtc box
 * fields. NOT 'classic', which is a different, mothballed skin (SkinPicker.vue / skins.ts).
 */
import { test, expect } from '../fixtures.js';
import type { Locator, Page } from '@playwright/test';

function numInputByLabel(page: Page, labelText: string, scope: Locator = page.locator('body')) {
  return scope.locator('label')
    .filter({ hasText: labelText })
    .locator('..')
    .locator('input[type="number"]');
}

async function setField(page: Page, label: string, value: number, scope?: Locator) {
  const input = numInputByLabel(page, label, scope);
  await input.fill(String(value));
  await input.press('Tab');
}

test('sealed box WinISD golden: Fs=40 Vas=7.65L Qes=0.45 Qms=2.94 Re=6.6 Rg=0.1 Vb=6L Ql=10 Qa=100 → Fsc=63.1762Hz Qtc=0.5995', async ({ page }) => {
  await page.goto('/');

  // Driver: enter Fs/Qes/Qms/Vas/Re via the "Tune" panel (OgTune.vue).
  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  const tune = page.locator('.tune-panel');
  await setField(page, 'Fs', 40, tune);
  await setField(page, 'Qes', 0.450, tune);
  await setField(page, 'Qms', 2.940, tune);
  await setField(page, 'Vas', 7.65, tune);   // scale=1000: litres in, m³ stored
  await setField(page, 'Re', 6.6, tune);

  // Box tab: sealed, Vb=6L, then leakage/absorption losses via the Advanced-> popup.
  await page.locator('li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('sealed');
  // Two "Volume" fields exist in the DOM (the common row + the PR-specific rear-chamber row);
  // both bind to the same state.P.Vb, so the first is authoritative regardless of box type.
  const vbInput = numInputByLabel(page, 'Volume').first();
  await vbInput.fill('6');
  await vbInput.press('Tab');

  await page.locator('button.link-btn', { hasText: 'Advanced' }).first().click();
  await setField(page, 'Leakage Ql', 10);
  await setField(page, 'Absorption Qa', 100);
  await page.locator('button.ok-btn', { hasText: 'OK' }).click();

  // Signal tab: series resistance Rg = 0.1 Ω — the field this scenario exists to prove is wired.
  await page.locator('li', { hasText: 'Signal' }).click();
  await setField(page, 'Series resistance', 0.1);

  // Back to Box tab: read the live Fsc/Qtc readout.
  await page.locator('li', { hasText: 'Box' }).click();
  const fscText = await page.locator('.field', { hasText: 'Fsc' }).locator('input').inputValue();
  const qtcText = await page.locator('.field', { hasText: 'Qtc' }).locator('input').inputValue();

  const fsc = parseFloat(fscText);
  const qtc = parseFloat(qtcText);

  // Tolerances sized to the field's OWN display precision (Fsc 2dp, Qtc 3dp) — tight enough to
  // fail on the un-fixed (no-Rg, stale-Qts) value (~63.32 Hz / ~0.575), which this test must catch.
  expect(fsc).toBeCloseTo(63.1762, 1);
  expect(qtc).toBeCloseTo(0.5995, 2);
});
