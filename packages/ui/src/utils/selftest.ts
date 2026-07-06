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
 * window._selfTestDone: set to true when complete. Playwright waits on this
 * flag before running browser integration tests (test/app.browser.spec.js).
 *
 * NOTE ON CONSTANTS: The tolerance and driver constants below are intentionally
 * kept in sync with test/engine.test.mjs (same values, same names). They cannot
 * be shared via import because test/ files are not part of the browser bundle.
 * If you change a constant here, change it in engine.test.mjs too, and vice versa.
 *
 * See ARCHITECTURE.md AD-5 for the full rationale.
 */
import { RHO, C } from '@openisd/engine';
import { deriveDriver } from '@openisd/engine';
import { sweep } from '@openisd/engine';
import type { SweepParams } from '@openisd/engine';
import { flash } from './flash.js';

declare global {
  interface Window { _selfTestDone?: boolean }
}

// ---------------------------------------------------------------------------
// Reference test driver — synthetic 6.5" mid-woofer, 8 Ω nominal.
// Must stay in sync with REF_DRIVER in test/engine.test.mjs.
// ---------------------------------------------------------------------------
const REF_DRIVER = {
  Fs:   37,      // Hz  — free-air resonance
  Qts:  0.38,    // —   — total Q at Fs
  Qes:  0.40,    // —   — electrical Q at Fs
  Qms:  7.0,     // —   — mechanical Q at Fs
  Vas:  0.030,   // m³  — equivalent compliance volume (30 L)
  Sd:   0.0133,  // m²  — effective piston area (~130 cm²)
  Re:   5.6,     // Ω   — voice-coil DC resistance
  Le:   0.7e-3,  // H   — voice-coil inductance
  Xmax: 0.005,   // m   — max one-way linear excursion (5 mm)
  Pe:   60,      // W   — rated power
  Z:    8,       // Ω   — nominal impedance
};

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
const SPL_EFFICIENCY_OFFSET_DB = 112.1; // dB — constant in T/S radiation efficiency → SPL formula
                                        // = 20·log10(ρ·c²/(4π²·p_ref)) at standard conditions

export function runSelfTest() {
  const { value: d } = deriveDriver(REF_DRIVER);
  if (!d) return [{ label: 'Self-test', pass: false, detail: 'REF_DRIVER failed deriveDriver validation' }];
  const dNoLe = { ...d, Le: 0 }; // Le=0 isolates acoustic response from voice-coil inductance

  // --- Gate 1: sealed SPL vs closed-form Thiele/Small transfer function ---
  // G²(x) = x⁴ / ((1−x²)² + x²/Qtc²),  x = f/fc
  // Ref: Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
  const fc  = d.Fs  * Math.sqrt(1 + d.Vas / VB_M3);
  const Qtc = d.Qts * Math.sqrt(1 + d.Vas / VB_M3);
  const Psl: SweepParams = { Vb: VB_M3, Ql: QL_LOSSLESS, nDrivers: 1, wiring: 'parallel',
                eg: EG_V, fmin: FMIN_HZ, fmax: FMAX_HZ, N: N_POINTS };
  const sw  = sweep(dNoLe, 'sealed', Psl);
  const passbandRef = sw.spl[sw.spl.length - 1]; // HF asymptote = reference level
  let e1 = 0;
  for (let i = 0; i < sw.fs.length; i++) {
    const x  = sw.fs[i] / fc;
    const g2 = (x ** 4) / ((1 - x * x) ** 2 + (x * x) / (Qtc * Qtc));
    e1 = Math.max(e1, Math.abs(sw.spl[i] - (passbandRef + 10 * Math.log10(g2))));
  }

  // --- Gate 2: passband sensitivity vs Thiele/Small radiation efficiency ---
  // η₀ = (4π²/c³)·(Fs³·Vas/Qes),  Lref = 112.1 + 10·log₁₀(η₀) + 10·log₁₀(V²/Re)
  // Ref: Beranek, L.L. "Acoustics." McGraw-Hill 1954.
  const eta0    = (4 * Math.PI ** 2 / C ** 3) * (d.Fs ** 3 * d.Vas) / d.Qes;
  const sensPredicted = SPL_EFFICIENCY_OFFSET_DB + 10 * Math.log10(eta0) + 10 * Math.log10(EG_V ** 2 / d.Re);
  const i300    = sw.fs.findIndex(f => f >= PASSBAND_REF_HZ);
  const pb      = sw.spl[i300];

  // --- Gate 3: vented rolloff slope and twin impedance peaks ---
  // Helmholtz: fb = (c/2π)·√(Sp/(Vb·Leff))
  // Ref: https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
  const Cab  = VB_M3 / (RHO * C * C);
  const wb   = 2 * Math.PI * VENTED_FB_HZ;
  const Map  = 1 / (wb * wb * Cab);
  const Sp   = Math.PI * VENT_RADIUS_M ** 2;
  const Pv   = { ...Psl, Ql: VENTED_QL, Sp, Leff: Map * Sp / RHO };
  const sv   = sweep(d, 'vented', Pv);
  const ia   = sv.fs.findIndex(f => f >= ROLLOFF_LOW_HZ);
  const ib   = sv.fs.findIndex(f => f >= ROLLOFF_HIGH_HZ);
  const slope = (sv.spl[ib] - sv.spl[ia]) / Math.log2(sv.fs[ib] / sv.fs[ia]);
  const peaks = [];
  for (let i = 1; i < sv.zmag.length - 1; i++) {
    if (sv.zmag[i] > sv.zmag[i - 1] &&
        sv.zmag[i] > sv.zmag[i + 1] &&
        sv.zmag[i] > d.Re * Z_PEAK_THRESHOLD) {
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
    flash(`⚠ Physics self-test FAILED (${failed}) — open console for details`);
  }

  window._selfTestDone = true;
  return { p1, p2, p3 };
}
