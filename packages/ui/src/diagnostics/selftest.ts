/**
 * Runtime self-test — bundle verification in the user's browser.
 *
 * PURPOSE: This is NOT a replacement for the Node.js test suite (test/*.test.mjs).
 * It is a complementary smoke-test that runs against the *deployed bundle* in the
 * user's actual browser, catching failures the build-time tests cannot see:
 *
 *   • Bundler / minifier corruption (Vite/Rollup transforming code incorrectly)
 *   • Tree-shaking accidentally dropping a needed export
 *   • Browser-specific JS engine edge cases (the test suite runs in Node V8 only)
 *   • Wrong physics constants after a configuration change that slips past CI
 *
 * WHEN IT RUNS: Called once from App.vue onMounted() — on every page load.
 *
 * OUTPUT: console.log under the prefix "[OpenISD self-test]".
 *         On failure: Flash notification visible to the user.
 *
 * window.selfTestDone: set to true when complete. Playwright waits on this
 * flag before running browser integration tests (test/app.browser.spec.js).
 *
 * NOTE ON CONSTANTS: The tolerance and driver constants below are intentionally
 * kept in sync with test/engine.test.mjs (same values, same names). They cannot
 * be shared via import because test/ files are not part of the browser bundle.
 * If you change a constant here, change it in engine.test.mjs too, and vice versa.
 *
 * See ARCHITECTURE.md AD-5 for the full rationale.
 */
import { Engine } from '@openisd/design/engine';
import type { AirEnvironment, SweepParams, SolverQuantities } from '@openisd/design/engine';

// No environment reaches this diagnostic's own closed-form reference, so it states the empty
// environment: every field of `AirEnvironment` is optional and falls back to the reference
// condition inside the engine — matching production, never a stored constant.
const REF_ENV: AirEnvironment = {};

declare global {
  interface Window { selfTestDone?: boolean }
}

export interface Diagnostics {
  /** Run every gate. Returns which passed, or a single failed row when the reference
   *  driver itself will not derive. */
  run(): DiagnosticsResult;
}

export type DiagnosticsResult =
  | Array<{ label: string; pass: boolean; detail: string }>
  | { p1: boolean; p2: boolean; p3: boolean };

export interface DiagnosticsDeps {
  /** Where a failure is surfaced to the user. The app passes `logging.flash`; a test passes
   *  a collector. `logging` is a SIBLING service, so it arrives as an argument — reaching
   *  for it directly would make one service depend on another. */
  report: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Reference test driver — synthetic 6.5" mid-woofer, 8 Ω nominal.
// Must stay in sync with REF_DRIVER in test/engine.test.mjs.
// ---------------------------------------------------------------------------
const REF_FS_HZ   = 37;      // Hz  — free-air resonance
const REF_QTS     = 0.38;    // —   — total Q at Fs
const REF_QES     = 0.40;    // —   — electrical Q at Fs
const REF_QMS     = 7.0;     // —   — mechanical Q at Fs
const REF_VAS_M3  = 0.030;   // m³  — equivalent compliance volume (30 L)
const REF_SD_M2   = 0.0133;  // m²  — effective piston area (~130 cm²)
const REF_RE_OHM  = 5.6;     // Ω   — voice-coil DC resistance
const REF_LE_H    = 0.7e-3;  // H   — voice-coil inductance
const REF_XMAX_M  = 0.005;   // m   — max one-way linear excursion (5 mm)
const REF_PE_W    = 60;      // W   — rated power
const REF_ZNOM_OHM = 8;      // Ω   — nominal impedance

// ---------------------------------------------------------------------------
// Tolerance constants — must stay in sync with test/engine.test.mjs.
// ---------------------------------------------------------------------------

// 0.1 dB: closed-form comparison; both sides use the same equation so drift
// is purely numerical. Well within IEC 60268-5 measurement uncertainty (±1 dB).
const GATE1_TOLERANCE_DB = 0.1;

// 0.5 dB: independent formula comparison (efficiency formula vs circuit solver).
const GATE2_TOLERANCE_DB = 0.5;

// 3 dB/oct: rolloff slope tolerance — discrete sampling + finite Ql introduce
// small deviations from the ideal 24 dB/oct fourth-order slope.
const GATE3_SLOPE_TOLERANCE_DB_OCT = 3;

// ---------------------------------------------------------------------------
// Sweep parameters
// ---------------------------------------------------------------------------

const VB_M3        = 0.020;  // 20 L sealed enclosure
const QL_LOSSLESS  = 1e6;    // Ql → ∞ = lossless, isolates acoustic response
const EG_V         = 2.83;   // V — IEC 60268-5 sensitivity reference voltage
const FMIN_HZ      = 10;     // sweep start
const FMAX_HZ      = 1000;   // sweep end
const N_POINTS     = 300;    // frequency grid points

const PASSBAND_REF_HZ    = 300;  // Hz — well above Fs, in the flat passband
const ROLLOFF_LOW_HZ     = 12;   // Hz — first rolloff check point (below Fb=30)
const ROLLOFF_HIGH_HZ    = 15;   // Hz — second rolloff check point (below Fb=30)
const VENTED_FB_HZ       = 30;   // Hz — target tuning frequency for Gate 3
const VENT_RADIUS_M      = 0.025; // m  — 50 mm diameter port
const VENTED_QL          = 7;    // —   — box leakage Q for vented test

// Impedance peaks: expect 2 peaks above 1.5× Re for a vented box at Fb=30 Hz.
const EXPECTED_Z_PEAKS         = 2;
const Z_PEAK_THRESHOLD         = 1.5;   // × Re — minimum height to count as a peak
const VENTED_THEORETICAL_SLOPE = 24;    // dB/oct — 4th-order Butterworth rolloff below Fb

export function createDiagnostics(deps: DiagnosticsDeps): Diagnostics {
  return { run: () => runSelfTest(deps.report) };
}

function runSelfTest(report: (msg: string) => void): DiagnosticsResult {
  const engine = new Engine();
  const refAir = engine.airFor(REF_ENV);
  const q: SolverQuantities = {
    Fs_hz: REF_FS_HZ, Re_ohm: REF_RE_OHM, Znom_ohm: REF_ZNOM_OHM,
    Qts: REF_QTS, Qes: REF_QES, Qms: REF_QMS,
    Vas_m3: REF_VAS_M3, Sd_m2: REF_SD_M2,
    Xmax_m: REF_XMAX_M, Pe_W: REF_PE_W,
  };
  const solved = engine.solveConsistencyGroup(q);
  const d: SolverQuantities = {
    ...solved,
    Re_terminal_ohm: solved.Re_ohm === undefined ? undefined
      : engine.terminalRe_ohm(solved.Re_ohm, solved.numVC, solved.wiring),
    BL_terminal_Tm: solved.BL_Tm === undefined ? undefined
      : engine.terminalBL_Tm(solved.BL_Tm, solved.numVC, solved.wiring),
  };
  if (d.Fs_hz === undefined || d.Vas_m3 === undefined || d.Qts === undefined || d.Re_ohm === undefined)
    return [{ label: 'Self-test', pass: false, detail: 'REF_DRIVER failed solveConsistencyGroup' }];

  // --- Gate 1: sealed SPL vs closed-form Thiele/Small transfer function ---
  // G²(x) = x⁴ / ((1−x²)² + x²/Qtc²),  x = f/fc
  // Ref: Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
  const fc  = d.Fs_hz  * Math.sqrt(1 + d.Vas_m3 / VB_M3);
  const Qtc = d.Qts * Math.sqrt(1 + d.Vas_m3 / VB_M3);
  const Psl: SweepParams = { Vb: VB_M3, Ql: QL_LOSSLESS, nDrivers: 1, wiring: 'parallel',
                eg: EG_V, fmin: FMIN_HZ, fmax: FMAX_HZ, N: N_POINTS };
  const { value: sw } = engine.sweep(d, 0, 'sealed', Psl); // Le=0 isolates acoustic response from voice-coil inductance
  if (!sw) return [{ label: 'Self-test', pass: false, detail: 'sealed sweep failed' }];
  const passbandRef = sw.spl[sw.spl.length - 1]; // HF asymptote = reference level
  let e1 = 0;
  for (let i = 0; i < sw.fs.length; i++) {
    const x  = sw.fs[i] / fc;
    const g2 = (x ** 4) / ((1 - x * x) ** 2 + (x * x) / (Qtc * Qtc));
    e1 = Math.max(e1, Math.abs(sw.spl[i] - (passbandRef + 10 * Math.log10(g2))));
  }

  // --- Gate 2: passband sensitivity vs Thiele/Small radiation efficiency ---
  // η₀ = (4π²/c³)·(Fs³·Vas/Qes),  Lref = K + 10·log₁₀(η₀) + 10·log₁₀(V²/Re),
  // K = 10·log₁₀(ρ·c/(2π·p_ref²)) — derived from the air, never a literal.
  // Ref: Beranek, L.L. "Acoustics." McGraw-Hill 1954.
  //
  // This diagnostic deliberately calls the SAME engine functions the sweep does rather than
  // keeping its own copy: it checks the sweep's CIRCUIT solution against the closed-form
  // reference level, so the reference side must be the project's one definition of that
  // level. A second copy here would only ever prove the two copies agree.
  const eta0    = engine.referenceEfficiency(d.Fs_hz, d.Vas_m3, d.Qes ?? REF_QES, refAir);
  const sensPredicted = engine.splFromEfficiency(eta0, refAir) + 10 * Math.log10(EG_V ** 2 / d.Re_ohm);
  const i300    = sw.fs.findIndex(f => f >= PASSBAND_REF_HZ);
  const pb      = sw.spl[i300];

  // --- Gate 3: vented rolloff slope and twin impedance peaks ---
  // Helmholtz: fb = (c/2π)·√(Sp/(Vb·Leff))
  // Ref: https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
  const Cab  = VB_M3 / (refAir.rho * refAir.c * refAir.c);
  const wb   = 2 * Math.PI * VENTED_FB_HZ;
  const Map  = 1 / (wb * wb * Cab);
  const Sp   = Math.PI * VENT_RADIUS_M ** 2;
  const Pv   = { ...Psl, Ql: VENTED_QL, Sp, Leff: Map * Sp / refAir.rho };
  const { value: sv } = engine.sweep(d, REF_LE_H, 'vented', Pv);
  if (!sv) return [{ label: 'Self-test', pass: false, detail: 'vented sweep failed' }];
  const ia   = sv.fs.findIndex(f => f >= ROLLOFF_LOW_HZ);
  const ib   = sv.fs.findIndex(f => f >= ROLLOFF_HIGH_HZ);
  const slope = (sv.spl[ib] - sv.spl[ia]) / Math.log2(sv.fs[ib] / sv.fs[ia]);
  const peaks = [];
  for (let i = 1; i < sv.zmag.length - 1; i++) {
    if (sv.zmag[i] > sv.zmag[i - 1] &&
        sv.zmag[i] > sv.zmag[i + 1] &&
        sv.zmag[i] > d.Re_ohm * Z_PEAK_THRESHOLD) {
      peaks.push(+sv.fs[i].toFixed(1));
    }
  }

  // --- Results ---
  const p1 = e1 < GATE1_TOLERANCE_DB;
  const p2 = Math.abs(pb - sensPredicted) < GATE2_TOLERANCE_DB;
  const p3 = Math.abs(slope - VENTED_THEORETICAL_SLOPE) < GATE3_SLOPE_TOLERANCE_DB_OCT && peaks.length === EXPECTED_Z_PEAKS;
  const allPass = p1 && p2 && p3;

  // eslint-disable-next-line no-console
  console.log('[OpenISD self-test]',
    `GATE1 sealed≡closed-form: max err ${e1.toFixed(4)} dB → ${p1 ? 'PASS' : 'FAIL'}`,
    `GATE2 sensitivity: circuit ${pb.toFixed(2)} vs predicted ${sensPredicted.toFixed(2)} dB → ${p2 ? 'PASS' : 'FAIL'}`,
    `GATE3 vented slope ${slope.toFixed(1)} dB/oct, peaks ${JSON.stringify(peaks)} → ${p3 ? 'PASS' : 'FAIL'}`,
    `OVERALL: ${allPass ? 'ALL PASS' : 'FAIL'}`);

  if (!allPass) {
    const failed = [!p1 && 'GATE1', !p2 && 'GATE2', !p3 && 'GATE3'].filter(Boolean).join(', ');
    report(`⚠ Physics self-test FAILED (${failed}) — open console for details`);
  }

  window.selfTestDone = true;
  return { p1, p2, p3 };
}
