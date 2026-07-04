/**
 * Shared test scenarios — driver parameters, box configuration, and expected outputs.
 *
 * Each scenario is a source-of-truth for a physical test case. The expected values
 * are verified against micka.de (an independent calculator) and then frozen here.
 * Both the OpenISD UI tests (app.browser.spec.js) and the micka.de oracle tests
 * (micka-crosscheck.browser.spec.js) draw from this file.
 *
 * ── How to add a new test case ────────────────────────────────────────────────
 *  1. Add a scenario object here with driver + box params and a placeholder for
 *     expected outputs.
 *  2. Run `TEST_TARGET=micka npx playwright test test/micka-crosscheck.browser.spec.js`
 *     to let micka.de tell you the correct expected values; fill them in under `micka`.
 *     For enclosure types micka cannot model (passive radiator, bandpass) drive the
 *     SpeakerBoxLite oracle instead and fill them in under `sbl` — see
 *     test/speakerboxlite-crosscheck.browser.spec.js and OTHER_TOOLS.md.
 *  3. Map from the oracle's values to OpenISD's display format (toFixed precision) and
 *     fill in under `openisd`.
 *  4. Add the OpenISD UI wiring test to test/app.browser.spec.js.
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
 *  type     'sealed' | 'vented' | 'pr' | 'bandpass4'
 *  Qtc      dimensionless  target system Q (sealed only)
 *  Vb       litres         enclosure volume — sealed/vented; rear chamber for bandpass4
 *  Vf       litres         front (vented) chamber volume (bandpass4 only)
 *  ventD    cm             port bore diameter (vented, bandpass4)
 *  ventL    cm             port physical length (vented, bandpass4)
 */

export interface Scenario {
  id: string;
  name: string;
  driver: { Fs: number; Qts: number; Vas: number; Qes?: number; Sd?: number; Re?: number; Le?: number };
  box: {
    type: 'sealed' | 'vented' | 'pr' | 'bandpass4';
    Qtc?: number;
    Vb?: number;
    Vf?: number;
    ventD?: number;
    ventL?: number;
    pr?: { Vb: number; Sd: number; Mms: number; Cms: number; Rms: number; Madd?: number };
  };
  /** micka.de expected values (sealed/vented only — micka has no PR/bandpass support). */
  micka?: Record<string, string>;
  /** SpeakerBoxLite expected values — the oracle for PR and bandpass, which micka lacks. */
  sbl?: Record<string, string>;
  openisd: Record<string, string>;
  /** Filled in by gen-scenarios.ts at generation time. */
  _computed?: Record<string, string>;
}

export const SCENARIOS: Scenario[] = [

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

    // OpenISD stat bar values — toFixed precision as rendered by StatBar.vue
    openisd: {
      Qtc: '0.707',  // exact by construction (Butterworth target)
      fc:  '68.8',   // toFixed(1) of 68.84 Hz
    },
  },

  // ── Scenario 2: Vented 30L box, ø5cm bore × 10cm port ───────────────────────
  // Helmholtz resonator with END_CORRECTION = 0.732 (WinISD's one-flanged default)
  {
    id:   'vented-30l-5cm-10cm',
    name: 'Vented 30L box, ø5cm×10cm port: Fs=37Hz, Qts=0.38, Vas=30L',
    driver: { Fs: 37, Qts: 0.38, Vas: 30 },
    box:    { type: 'vented', Vb: 30, ventD: 5, ventL: 10 },

    // micka.de values — verified 2026-07-04 by submitting "Your own Box" (Vb=30L,
    // vent diameter=5cm, vent length=10cm) and reading the results table
    micka: {
      Fb: '37.85',
    },

    // OpenISD stat bar values — toFixed precision as rendered by StatBar.vue
    openisd: {
      Fb: '37.9',   // toFixed(1) of 37.86 Hz
    },
  },

  // ── Scenario 3: Passive radiator, 30L box, 50g PR, 0.5mm/N Cms ───────────────
  // micka.de cannot model passive radiators (its #ideal form exposes no PR mass /
  // compliance / area fields) — SpeakerBoxLite is the oracle for this scenario.
  // Fp = prTuning(P) = 1/(2π·√(Map·Cpar)) ≈ 37.87 Hz  [engine alignments.ts]
  {
    id:   'pr-30l-50g-0p5cms',
    name: 'Passive radiator: 30L box, 50g PR, 0.5mm/N Cms, 1.0kg/s Rms',
    driver: { Fs: 37, Qts: 0.38, Vas: 30 },
    box: {
      type: 'pr',
      Vb: 30,
      pr: { Vb: 30, Sd: 133, Mms: 50, Cms: 0.5, Rms: 1.0, Madd: 0 },
    },

    // sbl: filled by driving SpeakerBoxLite's Passive Radiator type (see
    // speakerboxlite-crosscheck.browser.spec.ts). Left empty until the oracle is run.

    // OpenISD stat bar values — toFixed precision as rendered by StatBar.vue
    openisd: {
      Fp: '37.9',   // toFixed(1) of 37.87 Hz
    },
  },

  // ── Scenario 4: 4th-order bandpass, 15L rear + 20L front, ø5cm×10cm port ─────
  // micka.de's #ideal form has no bandpass mode — SpeakerBoxLite is the oracle.
  // bandpass4 shows no single formula stat; the sweep produces peak port velocity.
  {
    id:   'bandpass4-15l-20l-5cm-10cm',
    name: '4th-order bandpass: 15L rear + 20L front, ø5cm×10cm port',
    driver: { Fs: 37, Qts: 0.38, Vas: 30 },
    box: { type: 'bandpass4', Vb: 15, Vf: 20, ventD: 5, ventL: 10 },

    // sbl: filled by driving SpeakerBoxLite's 4th Order Bandpass type. Left empty
    // until the oracle is run.

    // OpenISD stat bar values — toFixed precision as rendered by StatBar.vue
    openisd: {
      Vb: '15.0',   // (0.015 m³ × 1000).toFixed(1)
    },
  },

];
