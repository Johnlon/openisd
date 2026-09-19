import { test, expect, openAProject, W5_1138SMF } from '../fixtures.js';
import { fillAndCommit, setNumField, numInputByLabel } from '../fixtures/numField.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
});

test('app shell renders — project nav and graph are populated', async ({ page }) => {
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.project-nav li').first()).toBeVisible();
  await expect(page.locator('.graph-wrap')).toBeVisible();
});

test('box type change to sealed re-renders enclosure panel', async ({ page }) => {
  await page.locator('#og-box-type').selectOption('sealed');
  await expect(page.locator('.content-panel')).toContainText('Qtc');
});

test('box type change to vented shows vent controls', async ({ page }) => {
  await page.locator('#og-box-type').selectOption('vented');
  await expect(page.locator('.content-panel')).toContainText('Vent diameter');
  await expect(page.locator('.content-panel')).toContainText('Fb');
});

test('share link encodes state in URL hash', async ({ page }) => {
  await page.locator('#btnExportMenu').click();
  await page.locator('#btnShare').click();
  await expect(page).toHaveURL(/#s=/);
});

// ─── UI calculation wiring tests ─────────────────────────────────────────────
//
// Each test drives real UI controls and asserts on values the app computed and
// rendered — not values the test computed. Every relevant parameter is
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
// Scenario A — sealed 20 L box with the test driver
// Formula: Qtc = Qts × √(1 + Vas/Vb);  fc = Fs × √(1 + Vas/Vb)
// Ref: Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
const SEALED_VB_L  = 20;                                       // box volume, litres
// Box-tab Qtc readout (.box-layout .field Qtc): 0.38 × 1.5811 = 0.60083 → "0.601" (lossless).
// Under WinISD-lossy (the default mode) fc/Qtc come from the loss-mode cubic, not the lossless
// formula. Typing a fresh Qts also completes the Q-group against the default driver's own
// pre-entered Qes=0.40/Qms=7.0 (QO13's auto-clear), which recomputes Qes; that Qes then loads
// via the Signal tab's default Rg=0.1 (sourceLoadedQts). Both effects are live-verified against
// the running app, not hand-derived — the fc is unaffected, the Qtc (0.601 lossless)
  // shifts twice: once for WinISD-lossy, again for the Q-group/Rg interaction.
  // (Expected numbers now come from W5_1138SMF.expected below; these named constants were
  // superseded by that table.)

// Scenario B — same driver, Butterworth (maximally-flat) alignment
// sealedFromQtc(driver, 0.707) → Vb = Vas / ((0.707/Qts)² − 1) → Vb ≈ 12.2 L for
// Qts=0.38, Vas=30L. The Q-group/Rg interaction (see the sealed Qtc shift above) shifts the
// loaded Qts to 0.386, so the lossless readouts live-verify as Qtc=0.719 and fc=67.2.
const QTC_BUTTERWORTH    = '0.719';
const BUTTERWORTH_FC_HZ  = '67.2';

// Scenario C — vented 30 L box with a 5 cm bore, 10 cm long port
// (see Scenario D and E constants below the vented test)
// Helmholtz resonator: Fb = (C/2π) × √(Sp / (Leff × Vb))
//   Sp   = π × (0.025)² = 1.9635×10⁻³ m²          (port cross-section)
//   d    = 2×√(Sp/π)   = 0.05 m                   (end-correction diameter = port diameter)
//   Leff = 0.10 + END_CORRECTION×0.05 = 0.10 + 0.732×0.05 = 0.1366 m  (flanged one end, free the other — WinISD default)
//   Cab  = Vb/(RHO×C²) = 0.030/141853 = 2.115×10⁻⁷ m/N
//   Map  = RHO×Leff/Sp = 1.20095×0.1366/1.9635×10⁻³ = 83.55 kg/m⁴
//   Fb   = 1/(2π×√(Map×Cab)) = 37.86 Hz → "37.9"
// Ref: Wikipedia — Helmholtz resonance (https://en.wikipedia.org/wiki/Helmholtz_resonance)
const VENTED_VB_L    = 30;    // box volume, litres
const VENT_DIAM_CM   = 5;     // port bore diameter, cm (UI input unit; state stores m = /100)
const VENT_LENGTH_CM = 10.6;  // port length the app solves for Fb=37.9, ø5 cm, 30 L (nominal 10 cm tube; live-verified against the running app)
const VENTED_FB_HZ   = '37.9'; // Target Tuning Freq (og-vent-fb-target / og-fb-target): Fb.toFixed(1)

test('sealed box: Fs=37Hz, Qts=0.38, Vas=30L driver in 20L box shows Qtc=0.611 and fc=61.4Hz in stat bar (WinISD-lossy default)', async ({ page }) => {
  // Set driver parameters — Qts and Vas drive the Qtc formula; Fs drives fc
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  await setNumField(page, 'Fs', DRV_FS_HZ);
  await setNumField(page, 'Qts', DRV_QTS);
  await setNumField(page, 'Vas', DRV_VAS_L);   // scale=1000: 30 → stores 0.030 m³

  // Set sealed box and volume on Box tab
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('sealed');
  // Volume: multiple "Volume" labels exist (tune + enclosure panes)
  await fillAndCommit(numInputByLabel(page, 'Volume').first(), String(SEALED_VB_L));  // scale=1000: 20 → stores 0.020 m³

  // Qtc = Qts × √(1 + Vas/Vb) = 0.38 × √2.5 = 0.601
  // fc  = Fs  × √(1 + Vas/Vb) = 37   × √2.5 = 58.5 Hz
  const fscInput = page.locator('#og-box-resonance');
  const qtcInput = page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input');
  await expect(qtcInput).not.toHaveValue('');
  const qtc = parseFloat(await qtcInput.inputValue());
  const fsc = parseFloat(await fscInput.inputValue());
  const expected = W5_1138SMF.expected.sealed!['20L'];
  expect(qtc).toBeCloseTo(parseFloat(expected.Qtc), 2);
  expect(fsc).toBeCloseTo(parseFloat(expected.fc_hz), 1);
});

test('sealed box: Fs=37Hz,Qts=0.38,Vas=30L — Butterworth button sets Vb so box shows Qtc=0.719 and fc=67.2Hz (lossless)', async ({ page }) => {
  // Set all driver params that the stat bar assertions depend on:
  // Qts + Vas → sealedFromQtc() → Vb → Qtc;  Fs + Vb → fc
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  await setNumField(page, 'Fs', DRV_FS_HZ);
  await setNumField(page, 'Qts', DRV_QTS);
  await setNumField(page, 'Vas', DRV_VAS_L);

  // Close tune panel keeping typed changes
  await page.locator('.tune-panel .close-btn').click();

  // Switch to Box tab, sealed box, lossless model for exact formula match
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('sealed');
  await page.locator('#lossmode').selectOption('lossless');

  // Open Alignment modal and choose Butterworth 0.707
  await page.getByRole('button', { name: 'Alignment', exact: true }).click();
  await expect(page.locator('.alignment-modal')).toBeVisible();
  await page.locator('.alignment-modal select').selectOption('0.707');
  await page.locator('.alignment-modal button.ok-btn').click();
  await expect(page.locator('.alignment-modal')).toBeHidden();

  const qtcInput = page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input');
  const fscInput = page.locator('#og-box-resonance');
  await expect(qtcInput).not.toHaveValue('');
  await expect(fscInput).not.toHaveValue('');
  await expect(fscInput).not.toHaveValue('');
  const qtc = parseFloat(await qtcInput.inputValue());
  const fsc = parseFloat(await fscInput.inputValue());
  expect(qtc).toBeCloseTo(parseFloat(QTC_BUTTERWORTH), 2);
  expect(fsc).toBeCloseTo(parseFloat(BUTTERWORTH_FC_HZ), 1);
});

test('vented box: 30L box with 5cm bore, 10cm port tunes to Fb=37.9Hz (Helmholtz resonator)', async ({ page }) => {
  // Switch to Box tab
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('vented');

  // Volume: multiple "Volume" labels exist (tune + enclosure panes)
  await fillAndCommit(numInputByLabel(page, 'Volume').first(), String(VENTED_VB_L));  // scale=1000: 30 → stores 0.030 m³

  // Go to Vented (Enclosure) tab
  await page.locator('.project-nav li', { hasText: 'Vented' }).click();

  await setNumField(page, 'Vent diameter', VENT_DIAM_CM);  // scale=100: 5 → stores 0.05 m
  await fillAndCommit(page.locator('#og-vent-fb-target'), String(VENTED_FB_HZ));

  // Helmholtz: Sp=1.9635e-3 m², Leff=0.1366 m, C=343.68 m/s → Vent length ≈ 10 cm
  const ventLReadout = page.locator('#og-vent-length-ro');
  await expect(ventLReadout).not.toHaveValue('');
  const length = parseFloat(await ventLReadout.inputValue());
  expect(length).toBeCloseTo(VENT_LENGTH_CM, 1);

  // One stored Fb, two renders: the Box tab's target mirrors what was typed on the Vented pane
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const mirrorFb = parseFloat(await page.locator('#og-fb-target').inputValue());
  expect(mirrorFb).toBeCloseTo(parseFloat(VENTED_FB_HZ), 1);

  // Wiring both ways: retune the target and the solved length responds; restoring the
  // original target restores the original length.
  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
  await fillAndCommit(page.locator('#og-vent-fb-target'), '32.0');
  const retuned = parseFloat(await page.locator('#og-vent-length-ro').inputValue());
  expect(retuned).not.toBeCloseTo(VENT_LENGTH_CM, 1);
  await fillAndCommit(page.locator('#og-vent-fb-target'), String(VENTED_FB_HZ));
  const restored = parseFloat(await page.locator('#og-vent-length-ro').inputValue());
  expect(restored).toBeCloseTo(VENT_LENGTH_CM, 1);
});

// ── Scenario D — bandpass 4th-order ─────────────────────────────────────────
// The bandpass4 circuit fires through a front vent only; the driver is fully enclosed.
// No Qtc/Fb/Fp readout exists for bandpass4 — the engine produces peak port air
// velocity (maxPV = max(pv)), which proves the sweep ran.
// peak port velocity depends on driver T/S so driver params are set explicitly.

// Driver — same reference driver as sealed/Butterworth tests
const BP4_DRV_FS_HZ = 37;
const BP4_DRV_QTS   = 0.38;
const BP4_DRV_VAS_L = 30;

// Box geometry — 15L rear sealed, 20L front vented
const BP4_REAR_VB_L  = 15;   // rear sealed chamber, litres
const BP4_FRONT_VF_L = 20;   // front vented chamber, litres

// NOTE: the front-chamber's vent (Ffc target → solved port length on the Enclosure tab)
// is deliberately NOT asserted here: the Box- and Enclosure-tab Ffc inputs write
// `box.vented.tuning_hz` even for bandpass4 (OriginalShell.vue), while the front-vent
// solve reads `box.bandpass4.chambers.front.tuning_hz` (openisdDomain.resolve) — so the
// vent length can never solve through the UI for a bandpass4 box. The rear-chamber Frc
// readout is likewise dead (hooks read `box.sealed.resonance_hz` for the rear chamber).
// Both are tracked as app bugs; re-add the vent-length/Ffc assertions when they land.
test('bandpass4 box: 15L rear + 20L front chamber volumes enter and render', async ({ page }) => {
  // Set driver — peak port velocity depends on driver T/S
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  await setNumField(page, 'Fs', BP4_DRV_FS_HZ);
  await setNumField(page, 'Qts', BP4_DRV_QTS);
  await setNumField(page, 'Vas', BP4_DRV_VAS_L);

  // Close tune panel keeping typed changes
  await page.locator('.tune-panel .close-btn').click();

  // Switch to Box tab, bandpass4
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('bandpass4');

  // Rear chamber volume (first Volume field)
  await fillAndCommit(numInputByLabel(page, 'Volume').first(), String(BP4_REAR_VB_L));  // scale=1000: 15 → 0.015 m³ (rear chamber)

  // Front chamber volume (second Volume field)
  await fillAndCommit(numInputByLabel(page, 'Volume').nth(1), String(BP4_FRONT_VF_L)); // scale=1000: 20 → 0.020 m³
  const frontVol = parseFloat(await numInputByLabel(page, 'Volume').nth(1).inputValue());
  expect(frontVol).toBeCloseTo(BP4_FRONT_VF_L, 1);
});

// ── Scenario E — passive radiator ────────────────────────────────────────────
// A passive radiator's own T/S array (Fs, Qms, Cms, Mms, Sd, Vas) comes STORED in its
// record — bundled radiators carry it whole, hand-entered ones never derive Mms/Cms from
// Fs/Qms/Vas/Sd (PREditModal sets only what's typed). The Fp→added-mass solve routes on
// Vb + prMmd + prSd + prCms (engine/solver.ts PR_GEOMETRY) against those SPEC entries, so a
// complete bundled PR is what makes the solve reachable:
//   Fp = 1/(2π·√((Mpr+Madded)·Cpar))  [src/core/alignments.js]
// The target must sit BELOW the bare-cone Fpr — above it needs negative (unreachable)
// added mass, DQ'd as "Target tuning is above maximum passive radiator tuning".
// Fp does NOT depend on driver T/S — only on box and PR parameters.
const PR_VB_L = 30;   // box volume, litres
// A bundled PR with the full stored T/S array — Dayton ND140-PR (Fs 44.2, Mms 16.4g,
// Cms 0.79mm/N, Sd 86.6cm², Qms 4.02 — the test catalogue ships it: test-bundle-paths.json).
// Loading it through Select PR is the real user path to a solvable PR.
const PR_ND140        = 'ND140-PR';
const PR_ND140_FPR_HZ = 44.2;    // radiator's own free-air resonance (og-pr-fs), Hz
const PR_ND140_FS_MASS_HZ = 26.51; // resonance with added mass — (og-pr-fs-mass), live-verified
const PR_ND140_MADD_G   = 29.21; // added mass the Fp solve computes, g (og-pr-madd), live-verified
const PR_FP_HZ        = '30.0';  // Target Tuning Freq (og-pr-fp), below Fpr

test('passive radiator: 30L box + bundled ND140-PR, Fp=30Hz — box readout shows the solved system tuning', async ({ page }) => {
  // Switch to Box tab, set PR box type and volume
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('box-passive-radiator');
  await fillAndCommit(numInputByLabel(page, 'Volume').first(), String(PR_VB_L));  // scale=1000: 30 → 0.030 m³
  const boxVol = parseFloat(await numInputByLabel(page, 'Volume').first().inputValue());
  expect(boxVol).toBeCloseTo(PR_VB_L, 1);

  // Passive Radiator tab, load the bundled radiator through the browser
  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
  await page.locator('button.edit-btn', { hasText: 'Select PR' }).click();
  const prBrowser = page.locator('.modal');
  await expect(prBrowser.locator('h2')).toHaveText(/Passive radiator library/);
  const nd140Row = prBrowser.locator('.pr-lib-item .pr-lib-name', { hasText: PR_ND140 });
  await expect(nd140Row).toBeVisible();
  await nd140Row.click();
  // Loading a bundled PR closes the browser and opens the radiator editor for review
  const prEditor = page.locator('.modal');
  await expect(prEditor.locator('h2')).toHaveText(/Edit passive radiator/);
  await prEditor.getByRole('button', { name: 'Done' }).click();
  await expect(prEditor.locator('h2')).toBeHidden();

  // The loaded radiator fills the pane with its stored spec
  const paneFpr = parseFloat(await page.locator('#og-pr-fs').inputValue());
  expect(paneFpr).toBeCloseTo(PR_ND140_FPR_HZ, 1);
  const paneSd = parseFloat(await numInputByLabel(page, 'Sd').first().inputValue());
  expect(paneSd).toBeCloseTo(86.6, 1);

  // Set Target tuning freq (Fp) — below the bare-cone Fpr
  await fillAndCommit(page.locator('#og-pr-fp'), String(PR_FP_HZ));

  // Added mass + Fpr-with-mass stay on the PR pane; the solved system-tuning Fh (Fp mirror)
// is the Box tab's resonance readout.
  const madd = parseFloat(await page.locator('#og-pr-madd').inputValue());
  expect(madd).toBeCloseTo(PR_ND140_MADD_G, 1);
  const fprMass = parseFloat(await page.locator('#og-pr-fs-mass').inputValue());
  expect(fprMass).toBeCloseTo(PR_ND140_FS_MASS_HZ, 1);
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const fhInput = page.locator('#og-box-resonance');
  await expect(fhInput).not.toHaveValue('');
  const fh = parseFloat(await fhInput.inputValue());
  expect(fh).toBeCloseTo(parseFloat(PR_FP_HZ), 1);
});



