/**
 * Shared test scenarios — driver parameters, box configuration, and expected outputs.
 *
 * Each scenario is a source-of-truth for a physical test case. The expected values
 * are verified against micka.de (an independent calculator) and then frozen here.
 * Both the Resonate UI tests (app.browser.spec.js) and the micka.de oracle tests
 * (micka-crosscheck.browser.spec.js) draw from this file.
 *
 * ── How to add a new test case ────────────────────────────────────────────────
 *  1. Add a scenario object here with driver + box params and a placeholder for
 *     expected outputs.
 *  2. Run `TEST_TARGET=micka npx playwright test test/micka-crosscheck.browser.spec.js`
 *     to let micka.de tell you the correct expected values; fill them in under `micka`.
 *  3. Map from micka's values to Resonate's display format (toFixed precision) and
 *     fill in under `resonate`.
 *  4. Add the Resonate UI wiring test to test/app.browser.spec.js.
 *
 * ── Driver field units ────────────────────────────────────────────────────────
 *  Fs   Hz          free-air resonance
 *  Qts  dimensionless  total system Q
 *  Qes  dimensionless  electrical Q (optional — needed for vented optimisation)
 *  Vas  litres      acoustic compliance volume
 *  Sd   cm²         diaphragm area (needed for vented, PR)
 *  Re   ohm         voice coil DC resistance (needed for vented, PR)
 *  Le   mH          voice coil inductance (optional)
 *
 * ── Box field units ───────────────────────────────────────────────────────────
 *  type     'sealed' | 'vented' | 'pr'
 *  Qtc      dimensionless  target system Q (sealed only)
 *  Vb       litres         enclosure volume (manual override)
 *  ventD    cm             port bore diameter (vented)
 *  ventL    cm             port physical length (vented)
 */

export const SCENARIOS = [

  // ── Scenario 1: Sealed Butterworth (Qtc = 0.707) ────────────────────────────
  // Formula: Vb = Vas / ((Qtc/Qts)² − 1) = 30 / 2.4616 = 12.18 L
  //          fc = Fs × Qtc/Qts = 37 × 1.8605 = 68.84 Hz
  // Ref: Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
  {
    id:   'sealed-butterworth',
    name: 'Sealed Butterworth: Fs=37Hz, Qts=0.38, Vas=30L → Qtc=0.707',
    driver: { Fs: 37, Qts: 0.38, Vas: 30 },
    box:    { type: 'sealed', Qtc: 0.707 },

    // micka.de values — verified 2026-06-26 by submitting the driver and reading the results table
    // Discrepancy (Vb 12.21 vs 12.18, fc 68.79 vs 68.84) is floating-point rounding in micka's
    // intermediate Vb step, not a formula difference.
    micka: {
      Vb: '12.21 litres',
      fc: '68.79',
    },

    // Resonate stat bar values — toFixed precision as rendered by StatBar.vue
    resonate: {
      Qtc: '0.707',  // exact by construction (Butterworth target)
      fc:  '68.8',   // toFixed(1) of 68.84 Hz
    },
  },

];
