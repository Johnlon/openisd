/**
 * Physical constants.
 *
 * Air density and speed of sound at 20 °C, 1 atm:
 *   https://en.wikipedia.org/wiki/Speed_of_sound#Speed_of_sound_in_ideal_gases_and_air
 *
 * Reference sound pressure (0 dB SPL = 20 µPa):
 *   https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
 */

// 20 °C, 30 % RH, 101325 Pa — WinISD's own derived values (Advanced pane), at WinISD's own
// full precision. Directly observed twice: all eight `winisd-parity` goldens
// (packages/winisd/test/fixtures/winisd-parity/goldens/*.wpr) carry these values for `c`/`roo`
// identically across humidity legs, and `drivers/sample/winisd/john-all-defaults.wdr` (a
// WinISD-authored blank driver) carries them at ParState C — WinISD's own calculation, not
// something a human typed. The 6/5-significant-figure truncation previously here
// (`1.20095`/`343.68`) was 1.8e-6/1.2e-5 relative off and is documented as fixed in
// bugs/BUG_20260813_winisd-compatibility-air-returns-truncated-rho-and-c-not-winisds-own-pair.md.
export const RHO = 1.20095217714682;  // air density        kg/m³   (20 °C — WinISD, full precision)
export const C   = 343.684120962153;  // speed of sound      m/s     (20 °C — WinISD, full precision)
export const P0  = 20e-6;    // SPL reference       Pa RMS  (0 dB SPL)

// Standard acceleration of gravity, CGPM 1901 — the exact defined value, m/s².
// WinISD's `Gloss` (static cone sag as a fraction of Xmax) is g/((2π·Fs)²·Xmax), and 41
// probe samples fit that to 3.6e-15 relative only at this figure, not at 9.81 or 9.8.
export const G_STANDARD = 9.80665;

// Port end correction for a vent flanged at one end (baffle) and free at the other
// (open into the box) — WinISD's own default (Vents tab "End Correction" field;
// see docs/winisd/view_3_ported.png).
export const END_CORRECTION = 0.732;  // × vent diameter, per open (unflanged) end

// Default ceiling on the force-flat auto-EQ boost (WinISD Advanced: "Force flat response").
// A vented box rolls off at 24 dB/oct, so an unbounded inverse filter would demand 40+ dB of
// boost an octave below Fb — physically absurd (the excursion it implies exceeds any driver's
// Xmax by orders of magnitude). 20 dB is a 10× voltage boost: enough to flatten a realistic
// passband ripple, small enough that the result stays a design a real amplifier could drive.
export const FLAT_MAX_BOOST_DB = 20;
