import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('app shell renders — side panel and graph grid are populated', async ({ page }) => {
  await expect(page.locator('#side fieldset').first()).toBeVisible();
  await expect(page.locator('#ggrid .gpanel').first()).toBeVisible();
  await expect(page.locator('#stat')).not.toBeEmpty();
});

test('in-browser self-test passes all three physics gates', async ({ page }) => {
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  await page.goto('/');
  await page.waitForFunction(() => window._selfTestDone === true, { timeout: 5000 })
    .catch(() => {});
  logs.find(l => l.includes('[Resonate self-test]'));  // presence checked implicitly via gates
  const gate1 = logs.find(l => l.includes('GATE1'));
  const gate2 = logs.find(l => l.includes('GATE2'));
  const gate3 = logs.find(l => l.includes('GATE3'));
  expect(gate1).toMatch(/PASS/);
  expect(gate2).toMatch(/PASS/);
  expect(gate3).toMatch(/PASS/);
});

test('box type change to sealed re-renders enclosure panel', async ({ page }) => {
  await page.locator('#boxtype').selectOption('sealed');
  await expect(page.locator('#side')).toContainText('Qtc');
});

test('box type change to vented shows vent controls', async ({ page }) => {
  await page.locator('#boxtype').selectOption('vented');
  await expect(page.locator('#side')).toContainText('Vent diameter');
  await expect(page.locator('#side')).toContainText('Fb');
});

test('share link encodes state in URL hash', async ({ page }) => {
  await page.locator('#btnShare').click();
  await expect(page).toHaveURL(/#s=/);
});

// ─── UI calculation wiring tests ─────────────────────────────────────────────
//
// Each test drives real UI controls and asserts on values the app computed and
// rendered in #stat — not values the test computed. Every relevant parameter is
// set explicitly via the UI; no test relies on "what the app happened to load."
//
// The discriminating rule: if the number being asserted was computed by calling
// core from the test (e.g. page.evaluate → import('/src/core/…')), it is a unit
// test in a browser tab and does NOT qualify as a UI wiring test.
//
// Physical constants used in derivations (src/core/constants.js):
//   C = 345 m/s (speed of sound at 20 °C)
//   RHO = 1.184 kg/m³ (air density at 20 °C)

// ── Test-scenario constants ──────────────────────────────────────────────────
// Naming: constants describe the physical scenario, not the app's internal state.

// Test driver — a subwoofer-class driver with round T/S numbers that give
// clean expected values. Set via UI in every test that depends on driver params.
const DRV_FS_HZ  = 37;    // resonant frequency, Hz
const DRV_QTS    = 0.38;  // total system Q
const DRV_VAS_L  = 30;    // acoustic compliance volume, litres (UI input unit; state stores m³ = /1000)
const DRV_VAS_M3 = 0.030; // same in m³

// Scenario A — sealed 20 L box with the test driver
// Formula: Qtc = Qts × √(1 + Vas/Vb);  fc = Fs × √(1 + Vas/Vb)
// Ref: Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
const SEALED_VB_L  = 20;                                       // box volume, litres
const SEALED_VB_M3 = 0.020;                                    // same in m³
const SEALED_SCALE = Math.sqrt(1 + DRV_VAS_M3 / SEALED_VB_M3); // √(1 + 30/20) = √2.5 = 1.5811
// StatBar: Qtc.toFixed(3) → 0.38 × 1.5811 = 0.60083 → "0.601"
const SEALED_QTC   = (DRV_QTS    * SEALED_SCALE).toFixed(3);
// StatBar: fc.toFixed(1) → 37 × 1.5811 = 58.50 → "58.5"
const SEALED_FC_HZ = (DRV_FS_HZ  * SEALED_SCALE).toFixed(1);

// Scenario B — same driver, Butterworth (maximally-flat) alignment
// sealedFromQtc(driver, 0.707) → Vb = Vas / ((0.707/Qts)² − 1)
// For Qts=0.38, Vas=30L: Vb ≈ 12.2 L → Qtc rounds to exactly "0.707"
// fc = Fs × Qtc/Qts = 37 × (0.707/0.38) = 68.84 Hz → toFixed(1) = "68.8"
// Cross-check: micka.de reports 68.79 Hz for the same driver (< 0.1 Hz difference)
const QTC_BUTTERWORTH    = '0.707';
const BUTTERWORTH_FC_HZ  = '68.8'; // toFixed(1) of 68.84 Hz

// Scenario C — vented 30 L box with a 5 cm bore, 10 cm long port
// (see Scenario D and E constants below the vented test)
// Helmholtz resonator: Fb = (C/2π) × √(Sp / (Leff × Vb))
//   Sp   = π × (0.025)² = 1.9635×10⁻³ m²          (port cross-section)
//   d    = 2×√(Sp/π)   = 0.05 m                   (end-correction diameter = port diameter)
//   Leff = 0.10 + 0.85×0.05 = 0.1425 m             (effective port length)
//   Cab  = Vb/(RHO×C²) = 0.030/140926 = 2.129×10⁻⁷ m/N
//   Map  = RHO×Leff/Sp = 1.184×0.1425/1.9635×10⁻³ = 85.94 kg/m⁴
//   Fb   = 1/(2π×√(Map×Cab)) = 37.21 Hz → "37.2"
// Ref: Wikipedia — Helmholtz resonance (https://en.wikipedia.org/wiki/Helmholtz_resonance)
const VENTED_VB_L    = 30;    // box volume, litres
const VENT_DIAM_CM   = 5;     // port bore diameter, cm (UI input unit; state stores m = /100)
const VENT_LENGTH_CM = 10;    // port tube length, cm
const VENTED_FB_HZ   = '37.2'; // StatBar: fb.toFixed(1)

// Helper: locate a NumInput's <input> element by its paired <label> text.
// NumInput renders a plain <input type="number"> with no id or data-bind;
// the parent .row div contains both the label and the input as siblings.
function numInputByLabel(page, labelText) {
  return page.locator('label')
    .filter({ hasText: labelText })
    .locator('..')
    .locator('input[type="number"]');
}

test('sealed box: Fs=37Hz, Qts=0.38, Vas=30L driver in 20L box shows Qtc=0.601 and fc=58.5Hz in stat bar', async ({ page }) => {
  // Set driver parameters — Qts and Vas drive the Qtc formula; Fs drives fc
  await page.locator('text=Edit ✎').click();
  await page.locator('input[data-bind="Fs"]').fill(String(DRV_FS_HZ));
  await page.locator('input[data-bind="Fs"]').press('Tab');
  const qtsInput = numInputByLabel(page, 'Qts');
  await qtsInput.fill(String(DRV_QTS));
  await qtsInput.press('Tab');
  const vasInput = numInputByLabel(page, 'Vas');
  await vasInput.fill(String(DRV_VAS_L));   // scale=1000: 30 → stores 0.030 m³
  await vasInput.press('Tab');

  // Set sealed box and volume
  await page.locator('#boxtype').selectOption('sealed');
  const vbInput = numInputByLabel(page, 'Box volume Vb');
  await vbInput.fill(String(SEALED_VB_L));  // scale=1000: 20 → stores 0.020 m³
  await vbInput.press('Tab');

  // Qtc = Qts × √(1 + Vas/Vb) = 0.38 × √2.5 = 0.601
  // fc  = Fs  × √(1 + Vas/Vb) = 37   × √2.5 = 58.5 Hz
  // StatBar reacts via Vue's 80 ms debounced sweep; Playwright retries until visible
  await expect(page.locator('#stat')).toContainText(`Qtc: ${SEALED_QTC}`);
  await expect(page.locator('#stat')).toContainText(`fc: ${SEALED_FC_HZ} Hz`);
});

test('sealed box: Fs=37Hz,Qts=0.38,Vas=30L — Butterworth button sets Vb so stat bar shows Qtc=0.707 and fc=68.8Hz', async ({ page }) => {
  // Set all driver params that the stat bar assertions depend on:
  // Qts + Vas → sealedFromQtc() → Vb → Qtc;  Fs + Vb → fc
  await page.locator('text=Edit ✎').click();
  await page.locator('input[data-bind="Fs"]').fill(String(DRV_FS_HZ));
  await page.locator('input[data-bind="Fs"]').press('Tab');
  const qtsInput = numInputByLabel(page, 'Qts');
  await qtsInput.fill(String(DRV_QTS));
  await qtsInput.press('Tab');
  const vasInput = numInputByLabel(page, 'Vas');
  await vasInput.fill(String(DRV_VAS_L));
  await vasInput.press('Tab');

  // Switch to sealed — the "Set Vb for Qtc=0.707" button only appears for sealed
  await page.locator('#boxtype').selectOption('sealed');
  // Clicking calls sealedFromQtc(driver, 0.707) → Vb = Vas/((0.707/Qts)²−1) ≈ 12.2L
  // Vb is written to state, triggering a full reactive recompute through engine → stat bar
  await page.locator('button', { hasText: 'Set Vb for Qtc=0.707' }).click();

  await expect(page.locator('#stat')).toContainText(`Qtc: ${QTC_BUTTERWORTH}`);
  // fc = Fs × √(1+Vas/Vb) = 37 × √3.461 = 68.84 Hz → "68.8"
  // Cross-validated: micka.de shows 68.79 Hz for the same driver (< 0.1 Hz delta)
  await expect(page.locator('#stat')).toContainText(`fc: ${BUTTERWORTH_FC_HZ} Hz`);
});

test('vented box: 30L box with 5cm bore, 10cm port tunes to Fb=37.2Hz (Helmholtz resonator)', async ({ page }) => {
  // Fb depends only on box geometry (Vb, port Sp, port Leff) — driver T/S play no role
  await page.locator('#boxtype').selectOption('vented');

  const vbInput = numInputByLabel(page, 'Box volume Vb');
  await vbInput.fill(String(VENTED_VB_L));  // scale=1000: 30 → stores 0.030 m³
  await vbInput.press('Tab');

  const ventDInput = numInputByLabel(page, 'Vent diameter');
  await ventDInput.fill(String(VENT_DIAM_CM));  // scale=100: 5 → stores 0.05 m
  await ventDInput.press('Tab');

  const ventLInput = numInputByLabel(page, 'Vent length');
  await ventLInput.fill(String(VENT_LENGTH_CM)); // scale=100: 10 → stores 0.10 m
  await ventLInput.press('Tab');

  // Helmholtz: Sp=1.9635e-3 m², Leff=0.1425 m, C=345 m/s → Fb=37.21Hz → "37.2"
  await expect(page.locator('#stat')).toContainText(`Fb: ${VENTED_FB_HZ} Hz`);
});

// ── Scenario D — bandpass 4th-order ─────────────────────────────────────────
// The bandpass4 circuit fires through a front vent only; the driver is fully enclosed.
// No formula-computed stat (Qtc/Fb/Fp) is shown in #stat for bandpass4 — the engine
// produces peak port air velocity (maxPV = max(pv)), which proves the sweep ran.
// peak port velocity depends on driver T/S so driver params are set explicitly.

// Driver — same reference driver as sealed/Butterworth tests
const BP4_DRV_FS_HZ = 37;
const BP4_DRV_QTS   = 0.38;
const BP4_DRV_VAS_L = 30;

// Box geometry — 15L rear sealed, 20L front vented, ø5cm × 10cm port
const BP4_REAR_VB_L    = 15;   // rear sealed chamber, litres
const BP4_FRONT_VF_L   = 20;   // front vented chamber, litres
const BP4_VENT_DIAM_CM = 5;    // port bore, cm
const BP4_VENT_LEN_CM  = 10;   // port tube length, cm
const BP4_STAT_VB      = '15.0'; // (0.015 m³ × 1000).toFixed(1)

test('bandpass4 box: 15L rear + 20L front + ø5cm×10cm port — stat bar shows box:bandpass4, Vb:15.0L and peak port velocity', async ({ page }) => {
  // Set driver — peak port velocity depends on driver T/S
  await page.locator('text=Edit ✎').click();
  await page.locator('input[data-bind="Fs"]').fill(String(BP4_DRV_FS_HZ));
  await page.locator('input[data-bind="Fs"]').press('Tab');
  const qtsInput = numInputByLabel(page, 'Qts');
  await qtsInput.fill(String(BP4_DRV_QTS));
  await qtsInput.press('Tab');
  const vasInput = numInputByLabel(page, 'Vas');
  await vasInput.fill(String(BP4_DRV_VAS_L));
  await vasInput.press('Tab');

  // Switch to bandpass4 and set box geometry
  await page.locator('#boxtype').selectOption('bandpass4');

  const vbInput = numInputByLabel(page, 'Box volume Vb');
  await vbInput.fill(String(BP4_REAR_VB_L));  // scale=1000: 15 → 0.015 m³ (rear chamber)
  await vbInput.press('Tab');

  // Front chamber Vf — only visible for bandpass4
  const vfInput = numInputByLabel(page, 'Front chamber Vf');
  await vfInput.fill(String(BP4_FRONT_VF_L)); // scale=1000: 20 → 0.020 m³
  await vfInput.press('Tab');

  const ventDInput = numInputByLabel(page, 'Vent diameter');
  await ventDInput.fill(String(BP4_VENT_DIAM_CM)); // scale=100: 5 → 0.05 m
  await ventDInput.press('Tab');

  const ventLInput = numInputByLabel(page, 'Vent length');
  await ventLInput.fill(String(BP4_VENT_LEN_CM)); // scale=100: 10 → 0.10 m
  await ventLInput.press('Tab');

  // Stat bar must show bandpass4 box type — proves box-type routing wiring
  await expect(page.locator('#stat')).toContainText('Box: bandpass4');
  // Vb passes through to stat bar as a sanity check
  await expect(page.locator('#stat')).toContainText(`Vb: ${BP4_STAT_VB} L`);
  // peak port appears only for vented/bandpass4 (v-if="stats.maxPV != null") and only when
  // the sweep engine ran the bandpass4 circuit — its presence proves the reactive chain works
  await expect(page.locator('#stat')).toContainText('peak port:');
});

// ── Scenario E — passive radiator ────────────────────────────────────────────
// Fp = prTuning(P) = 1/(2π·√(Map·Cpar))  [src/core/alignments.js]
//   Cab  = Vb/(RHO·C²) = 0.030/(1.184·345²) = 2.129e-7
//   Map  = prMmd/prSd² = 0.050/0.0133²   = 282.66
//   Cap  = prCms·prSd² = 5e-4·0.0133²   = 8.844e-8
//   Cpar = Cab·Cap/(Cab+Cap)             = 6.248e-8
//   Fp   = 1/(2π·√(282.66·6.248e-8))   ≈ 37.87 Hz → '37.9'
// Fp does NOT depend on driver T/S — only on box and PR parameters.
const PR_VB_L     = 30;    // box volume, litres
const PR_SD_CM2   = 133;   // piston area, cm²  (UI scale=1e4; 133 → 0.0133 m²)
const PR_MMS_G    = 50;    // moving mass, g    (UI scale=1000; 50  → 0.050 kg)
const PR_CMS_MMPN = 0.5;  // compliance, mm/N  (UI scale=1000; 0.5 → 5e-4 m/N)
const PR_RMS_KGS  = 1.0;  // mechanical damping, kg/s (direct, scale=1)
const PR_FP_HZ    = '37.9'; // Fp.toFixed(1) in stat bar

test('passive radiator: 30L box, 50g PR, 0.5mm/N Cms — stat bar shows Fp=37.9Hz', async ({ page }) => {
  // Switch to PR box type and set box volume (always visible, not in PR edit panel)
  await page.locator('#boxtype').selectOption('pr');

  const vbInput = numInputByLabel(page, 'Box volume Vb');
  await vbInput.fill(String(PR_VB_L));  // scale=1000: 30 → 0.030 m³
  await vbInput.press('Tab');

  // Open the PR edit panel — the collapsed view shows a summary; click to expand
  await page.locator('[title="Click to edit passive radiator parameters"]').click();

  // Switch from WinISD mode to T/S mode so Mms/Cms/Rms inputs appear directly
  const modeSelect = page.locator('label')
    .filter({ hasText: 'Input mode' })
    .locator('..')
    .locator('select');
  await modeSelect.selectOption('ts');

  // Set Sd — visible in T/S mode (piston area; scale=1e4 → cm²)
  const sdInput = numInputByLabel(page, 'Sd');
  await sdInput.fill(String(PR_SD_CM2));
  await sdInput.press('Tab');

  // Set Mms — only visible in T/S mode (moving mass; scale=1000 → g)
  const mmsInput = numInputByLabel(page, 'Mms');
  await mmsInput.fill(String(PR_MMS_G));
  await mmsInput.press('Tab');

  // Set Cms — only visible in T/S mode (compliance; scale=1000 → mm/N)
  const cmsInput = numInputByLabel(page, 'Cms');
  await cmsInput.fill(String(PR_CMS_MMPN));
  await cmsInput.press('Tab');

  // Set Rms — only visible in T/S mode (mechanical damping; scale=1)
  const rmsInput = numInputByLabel(page, 'Rms');
  await rmsInput.fill(String(PR_RMS_KGS));
  await rmsInput.press('Tab');

  // Set added mass = 0 g — ensures no stale default mass shifts Fp
  const maddInput = numInputByLabel(page, 'Added mass');
  await maddInput.fill('0');
  await maddInput.press('Tab');

  // Fp = 37.9 Hz — confirms the prTuning() reactive chain: PR params → Fp → stat bar
  await expect(page.locator('#stat')).toContainText(`Fp: ${PR_FP_HZ} Hz`);
});
